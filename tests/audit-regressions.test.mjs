import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { createServer } from "vite";

const storage = new Map();
globalThis.sessionStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
const vite = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: "custom",
});
after(() => vite.close());
const api = await vite.ssrLoadModule("/src/shared/api/green-api/methods.ts");
const chat = await vite.ssrLoadModule("/src/entities/chat/model.ts");
const connection = await vite.ssrLoadModule("/src/features/connect-instance/model.ts");
const createChat = await vite.ssrLoadModule("/src/features/create-chat/model.ts");
const sender = await vite.ssrLoadModule("/src/features/send-message/model.ts");
const loader = await vite.ssrLoadModule("/src/features/load-chat-history/model.ts");
const polling = await vite.ssrLoadModule("/src/features/receive-events/model.ts");
const credentials = {
  idInstance: "fixture",
  apiTokenInstance: "fixture-token",
  apiUrl: "https://fixture.invalid",
};
beforeEach(() => {
  chat.chatsCleared();
  connection.disconnectRequested();
  storage.clear();
});

void test("deleteNotification puts receipt after token", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(
      url,
      "https://fixture.invalid/waInstancefixture/deleteNotification/fixture-token/42",
    );
    assert.equal(options.method, "DELETE");
    return new Response('{"result":true}');
  };
  try {
    await api.deleteNotification({ credentials, receiptId: 42 });
  } finally {
    globalThis.fetch = original;
  }
});

void test("status webhook reads top-level fields and does not regress read", async () => {
  connection.$credentials.setState(credentials);
  chat.chatAdded({ id: "contact", title: "Contact" });
  chat.outgoingMessageAdded({
    chatId: "contact",
    message: {
      localId: "local",
      idMessage: "provider",
      text: "hello",
      timestamp: 1,
      direction: "outgoing",
      status: "read",
    },
  });
  const original = globalThis.fetch;
  let received = false;
  const deleted = new Promise((resolve) => {
    globalThis.fetch = async (url, options) => {
      if (options.method === "DELETE") {
        resolve(url);
        return new Response('{"result":true}');
      }
      if (!received) {
        received = true;
        return new Response(
          JSON.stringify({
            receiptId: 7,
            body: {
              typeWebhook: "outgoingMessageStatus",
              chatId: "contact",
              idMessage: "provider",
              status: "delivered",
            },
          }),
        );
      }
      return new Promise((_resolve, reject) =>
        options.signal.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        ),
      );
    };
  });
  try {
    polling.pollingStarted();
    assert.equal(
      await deleted,
      "https://fixture.invalid/waInstancefixture/deleteNotification/fixture-token/7",
    );
    assert.equal(chat.$chats.getState()[0].messages[0].status, "read");
  } finally {
    polling.pollingStopped();
    globalThis.fetch = original;
  }
});

void test("polling receives, processes, acknowledges, then receives again", async () => {
  connection.$credentials.setState(credentials);
  const original = globalThis.fetch;
  const calls = [];
  let nextReceive;
  globalThis.fetch = async (url, options) => {
    const method = options.method;
    calls.push([method, url]);
    if (method === "DELETE") return new Response('{"result":true}');
    if (calls.length === 1)
      return new Response(
        JSON.stringify({
          receiptId: 88,
          body: {
            typeWebhook: "incomingMessageReceived",
            idMessage: "msg",
            senderData: { chatId: "contact" },
            messageData: { typeMessage: "textMessage", textMessageData: { textMessage: "hello" } },
          },
        }),
      );
    nextReceive?.();
    return new Promise((_resolve, reject) =>
      options.signal.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      ),
    );
  };
  try {
    const next = new Promise((resolve) => {
      nextReceive = resolve;
    });
    polling.pollingStarted();
    await next;
    assert.deepEqual(
      calls.map(([method]) => method),
      ["GET", "DELETE", "GET"],
    );
    assert.equal(
      calls[1][1],
      "https://fixture.invalid/waInstancefixture/deleteNotification/fixture-token/88",
    );
    assert.equal(chat.$chats.getState()[0].messages[0].text, "hello");
  } finally {
    polling.pollingStopped();
    globalThis.fetch = original;
  }
});

void test("late checkAccount cannot add chat after logout", async () => {
  connection.$credentials.setState(credentials);
  createChat.newChatOpened();
  const original = globalThis.fetch;
  let respond;
  globalThis.fetch = () =>
    new Promise((resolve) => {
      respond = resolve;
    });
  try {
    createChat.newChatSubmitted("79991234567");
    connection.disconnectRequested();
    respond(new Response(JSON.stringify({ exist: true, chatId: "old-session", username: "Old" })));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(chat.$chats.getState().length, 0);
  } finally {
    globalThis.fetch = original;
  }
});

void test("late connect result cannot reconnect after logout", async () => {
  const original = globalThis.fetch;
  let respond;
  globalThis.fetch = (url) =>
    url.includes("getStateInstance")
      ? new Promise((resolve) => {
          respond = resolve;
        })
      : Promise.resolve(new Response('{"webhookUrl":"","incomingWebhook":"yes"}'));
  try {
    connection.connectRequested(credentials);
    connection.disconnectRequested();
    respond(new Response('{"stateInstance":"authorized"}'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(connection.$credentials.getState(), null);
    assert.equal(storage.has("green-api:connection"), false);
  } finally {
    globalThis.fetch = original;
  }
});

void test("settings fix confirms persisted settings before dismissing notice", async () => {
  connection.$credentials.setState(credentials);
  connection.$settings.setState({ webhookUrl: "https://old.invalid", incomingWebhook: "no" });
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push([url, options.method]);
    if (url.includes("setSettings")) return new Response('{"saveSettings":true}');
    if (url.includes("getStateInstance")) return new Response('{"stateInstance":"authorized"}');
    return new Response(
      '{"webhookUrl":"","incomingWebhook":"yes","outgoingWebhook":"yes","outgoingAPIMessageWebhook":"yes"}',
    );
  };
  try {
    const complete = new Promise((resolve) => {
      const unwatch = connection.$settings.watch((value) => {
        if (value?.incomingWebhook === "yes") {
          unwatch();
          resolve();
        }
      });
    });
    connection.settingsFixRequested();
    await complete;
    assert.equal(connection.$connectionStatus.getState(), "ready");
    assert.equal(calls.length, 3);
  } finally {
    globalThis.fetch = original;
    connection.disconnectRequested();
  }
});

void test("confirmation reconciles history copy and preserves its later status", () => {
  chat.chatAdded({ id: "contact", title: "Contact" });
  chat.outgoingMessageAdded({
    chatId: "contact",
    message: {
      localId: "local",
      text: "hello",
      timestamp: 1,
      direction: "outgoing",
      status: "sending",
    },
  });
  chat.chatHistoryLoaded({
    chatId: "contact",
    messages: [
      {
        localId: "history:provider",
        idMessage: "provider",
        text: "hello",
        timestamp: 2,
        direction: "outgoing",
        status: "delivered",
      },
    ],
  });
  chat.outgoingMessageConfirmed({ localId: "local", idMessage: "provider" });
  const messages = chat.$chats.getState()[0].messages;
  assert.equal(messages.length, 1);
  assert.equal(messages[0].status, "delivered");
});

void test("selected chat clears unread and incoming to active chat stays read", () => {
  chat.chatAdded({ id: "other", title: "Other" });
  chat.chatAdded({ id: "contact", title: "Contact" });
  chat.chatSelected("other");
  const incoming = { localId: "one", text: "hi", timestamp: 1, direction: "incoming" };
  chat.incomingMessageAdded({ chatId: "contact", title: "Contact", message: incoming });
  assert.equal(chat.$chats.getState().find((c) => c.id === "contact").unreadCount, 1);
  chat.chatSelected("contact");
  assert.equal(chat.$chats.getState().find((c) => c.id === "contact").unreadCount, 0);
  chat.incomingMessageAdded({
    chatId: "contact",
    title: "Contact",
    message: { ...incoming, localId: "two" },
  });
  assert.equal(chat.$chats.getState().find((c) => c.id === "contact").unreadCount, 0);
});

void test("provider delivery can resolve an uncertain failed send", () => {
  chat.chatAdded({ id: "contact", title: "Contact" });
  chat.outgoingMessageAdded({
    chatId: "contact",
    message: {
      localId: "local",
      idMessage: "provider",
      text: "hi",
      timestamp: 1,
      direction: "outgoing",
      status: "failed",
    },
  });
  chat.messageStatusUpdated({ chatId: "contact", idMessage: "provider", status: "delivered" });
  assert.equal(chat.$chats.getState()[0].messages[0].status, "delivered");
});

void test("late send response cannot repopulate a cleared session", async () => {
  connection.$credentials.setState(credentials);
  chat.chatAdded({ id: "contact", title: "Contact" });
  const original = globalThis.fetch;
  let respond;
  globalThis.fetch = () =>
    new Promise((resolve) => {
      respond = resolve;
    });
  try {
    sender.messageSubmitted({ chatId: "contact", text: "hello" });
    const pending = chat.$chats.getState()[0].messages[0];
    connection.disconnectRequested();
    chat.chatsCleared();
    chat.chatAdded({ id: "contact", title: "New session" });
    chat.outgoingMessageAdded({ chatId: "contact", message: { ...pending } });
    respond(new Response('{"idMessage":"provider"}'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(chat.$chats.getState()[0].messages[0].idMessage, undefined);
  } finally {
    globalThis.fetch = original;
  }
});

void test("malformed history is reported rather than silently replacing messages", async () => {
  connection.$credentials.setState(credentials);
  chat.chatAdded({ id: "contact", title: "Contact" });
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("[{}]");
  try {
    const failed = new Promise((resolve) => {
      const unwatch = loader.$historyError.watch((value) => {
        if (value) {
          unwatch();
          resolve(value);
        }
      });
    });
    loader.historyRequested({ chatId: "contact", credentials });
    assert.match(
      await Promise.race([
        failed,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("History error was not reported")), 200),
        ),
      ]),
      /истори/i,
    );
    assert.deepEqual(chat.$chats.getState()[0].messages, []);
  } finally {
    globalThis.fetch = original;
  }
});

void test("late history error from A is not shown in the selected chat B", async () => {
  connection.$credentials.setState(credentials);
  chat.chatAdded({ id: "A", title: "A" });
  chat.chatAdded({ id: "B", title: "B" });
  const original = globalThis.fetch;
  const pending = new Map();
  globalThis.fetch = (_url, options) =>
    new Promise((resolve, reject) => {
      pending.set(JSON.parse(options.body).chatId, { resolve, reject });
    });
  try {
    chat.chatSelected("A");
    loader.historyRequested({ chatId: "A", credentials });
    chat.chatSelected("B");
    loader.historyRequested({ chatId: "B", credentials });
    pending.get("B").resolve(new Response("[]"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    pending.get("A").reject(new Error("offline"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(loader.$historyLoading.getState(), false);
    assert.equal(loader.$historyError.getState(), null);
  } finally {
    globalThis.fetch = original;
  }
});

void test("corrupt cache is discarded and interrupted sends are marked uncertain", () => {
  storage.set("green-api:chats:corrupt", "[{}]");
  chat.chatsRestored({ instanceId: "corrupt" });
  assert.deepEqual(chat.$chats.getState(), []);
  storage.set(
    "green-api:chats:corrupt",
    JSON.stringify([
      {
        id: "contact",
        title: "Contact",
        unreadCount: 0,
        messages: [
          { localId: "local", text: "hi", timestamp: 1, direction: "outgoing", status: "sending" },
        ],
      },
    ]),
  );
  chat.chatsRestored({ instanceId: "corrupt" });
  assert.equal(chat.$chats.getState()[0].messages[0].status, "failed");
});
