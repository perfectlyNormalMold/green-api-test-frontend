import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "vite";

const storage = new Map();
globalThis.sessionStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};

const vite = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: "custom",
});
after(() => vite.close());
const model = await vite.ssrLoadModule("/src/entities/chat/model.ts");

before(() => {
  storage.clear();
  model.chatsCleared();
});

const chatId = "contact-1";
const history = [
  {
    localId: "history:4",
    idMessage: "4",
    text: "yes",
    timestamp: 1800001860,
    direction: "outgoing",
    status: "read",
  },
  {
    localId: "history:3",
    idMessage: "3",
    text: "10100110?",
    timestamp: 1800001860,
    direction: "incoming",
  },
  {
    localId: "history:2",
    idMessage: "2",
    text: "Privet",
    timestamp: 1800000120,
    direction: "outgoing",
    status: "delivered",
  },
  {
    localId: "history:1",
    idMessage: "1",
    text: "test",
    timestamp: 1800000120,
    direction: "incoming",
  },
];

void test("history restores both directions in chronological order without duplicating live messages", () => {
  model.chatAdded({ id: chatId, title: "Devtest" });
  model.incomingMessageAdded({ chatId, title: "Devtest", message: history[2] });
  model.incomingMessageAdded({ chatId, title: "Devtest", message: history[1] });
  model.chatHistoryLoaded?.({ chatId, messages: history });
  assert.deepEqual(
    model.$chats.getState()[0].messages.map(({ text }) => text),
    ["test", "Privet", "10100110?", "yes"],
  );
});

void test("history merged into local cache survives restore after reload", () => {
  model.chatsCleared();
  model.chatAdded({ id: chatId, title: "Devtest" });
  model.chatHistoryLoaded?.({ chatId, messages: history });
  model.chatsPersistenceRequested("instance-1");
  model.chatsCleared();
  model.chatsRestored({ instanceId: "instance-1" });
  assert.deepEqual(
    model.$chats.getState()[0].messages.map(({ text }) => text),
    ["test", "Privet", "10100110?", "yes"],
  );
});

void test("incoming notification stores the provider id and timestamp", async () => {
  model.chatsCleared();
  const connection = await vite.ssrLoadModule("/src/features/connect-instance/model.ts");
  const polling = await vite.ssrLoadModule("/src/features/receive-events/model.ts");
  connection.$credentials.setState({
    idInstance: "instance-1",
    apiTokenInstance: "test",
    apiUrl: "http://localhost",
  });
  const previousFetch = globalThis.fetch;
  let received = false;
  globalThis.fetch = async (_url, options) => {
    if (options.method === "DELETE") return new Response('{"result":true}');
    if (!received) {
      received = true;
      return new Response(
        JSON.stringify({
          receiptId: 42,
          body: {
            typeWebhook: "incomingMessageReceived",
            timestamp: 1800000120,
            idMessage: "provider-1",
            senderData: { chatId, senderName: "Devtest" },
            messageData: { typeMessage: "textMessage", textMessageData: { textMessage: "test" } },
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
  try {
    const receivedMessage = new Promise((resolve) => {
      const unsubscribe = model.incomingMessageAdded.watch((value) => {
        unsubscribe();
        resolve(value.message);
      });
    });
    polling.pollingStarted();
    const message = await receivedMessage;
    assert.equal(message.idMessage, "provider-1");
    assert.equal(message.timestamp, 1800000120 * 1000);
  } finally {
    polling.pollingStopped();
    globalThis.fetch = previousFetch;
  }
});

void test("opening a chat fetches remote history and merges both directions", async () => {
  model.chatsCleared();
  model.chatAdded({ id: chatId, title: "Devtest" });
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.match(url, /getChatHistory/);
    assert.deepEqual(JSON.parse(options.body), { chatId, count: 100 });
    return new Response(
      JSON.stringify(
        history.map((message) => ({
          type: message.direction,
          idMessage: message.idMessage,
          timestamp: message.timestamp / 1000,
          typeMessage: "textMessage",
          chatId,
          textMessage: message.text,
          statusMessage: message.status,
        })),
      ),
    );
  };
  try {
    const loader = await vite.ssrLoadModule("/src/features/load-chat-history/model.ts");
    const loaded = new Promise((resolve) => {
      const unsubscribe = model.chatHistoryLoaded.watch((value) => {
        unsubscribe();
        resolve(value);
      });
    });
    const connection = await vite.ssrLoadModule("/src/features/connect-instance/model.ts");
    loader.historyRequested({ chatId, credentials: connection.$credentials.getState() });
    await loaded;
    assert.deepEqual(
      model.$chats.getState()[0].messages.map(({ text }) => text),
      ["test", "Privet", "10100110?", "yes"],
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

void test("outgoing notification from another Telegram client appears live", async () => {
  model.chatsCleared();
  model.chatAdded({ id: chatId, title: "Devtest" });
  const polling = await vite.ssrLoadModule("/src/features/receive-events/model.ts");
  const previousFetch = globalThis.fetch;
  let received = false;
  globalThis.fetch = async (_url, options) => {
    if (options.method === "DELETE") return new Response('{"result":true}');
    if (!received) {
      received = true;
      return new Response(
        JSON.stringify({
          receiptId: 43,
          body: {
            typeWebhook: "outgoingMessageReceived",
            timestamp: 1800001860,
            idMessage: "provider-4",
            senderData: { chatId, senderName: "Devtest" },
            messageData: { typeMessage: "textMessage", textMessageData: { textMessage: "yes" } },
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
  try {
    polling.pollingStarted();
    await Promise.race([
      new Promise((resolve) => setTimeout(resolve, 300)),
      new Promise((resolve) => {
        const unsubscribe = model.outgoingMessageAdded.watch(() => {
          unsubscribe();
          resolve();
        });
      }),
    ]);
    assert.deepEqual(
      model.$chats.getState()[0].messages.map(({ text }) => text),
      ["yes"],
    );
  } finally {
    polling.pollingStopped();
    globalThis.fetch = previousFetch;
  }
});

void test("active chat loads history once without a second polling loop", async () => {
  const loader = await vite.ssrLoadModule("/src/features/load-chat-history/model.ts");
  const connection = await vite.ssrLoadModule("/src/features/connect-instance/model.ts");
  const previousFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => new Response("[]");
  const unwatch = loader.historyRequested.watch(() => {
    calls++;
  });
  try {
    loader.historyRequested({
      chatId,
      credentials: connection.$credentials.getState(),
    });
    assert.equal(calls, 1);
  } finally {
    unwatch();
    globalThis.fetch = previousFetch;
  }
});
