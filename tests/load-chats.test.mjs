import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createServer } from "vite";

const vite = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: "custom",
});
after(() => vite.close());

const chat = await vite.ssrLoadModule("/src/entities/chat/model.ts");
const connection = await vite.ssrLoadModule("/src/features/connect-instance/model.ts");

void test("a new session loads remote chats with contact names and avatars", async () => {
  chat.chatsCleared();
  chat.chatAdded({ id: "old-chat", title: "old-chat" });
  connection.$credentials.setState({
    idInstance: "fixture-id",
    apiTokenInstance: "fixture-token",
    apiUrl: "https://example.test",
  });
  const previousFetch = globalThis.fetch;
  let activeRequests = 0;
  let maxActiveRequests = 0;
  let incomingAttempts = 0;
  const delayedResponse = (body) =>
    new Promise((resolve) => {
      activeRequests++;
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
      setTimeout(() => {
        activeRequests--;
        resolve(new Response(JSON.stringify(body)));
      }, 5);
    });
  globalThis.fetch = async (url, options) => {
    if (/getChats/.test(url)) {
      assert.equal(options.method, "GET");
      return delayedResponse([
        { chatId: "old-chat", phoneNumber: 0 },
        { chatId: "group-chat", phoneNumber: 0 },
      ]);
    }
    if (/getContactInfo/.test(url)) {
      assert.equal(options.method, "POST");
      const { chatId } = JSON.parse(options.body);
      return delayedResponse({
        chatId,
        name: chatId === "old-chat" ? "Старый контакт" : "Рабочая группа",
        username: chatId === "old-chat" ? "@old" : "@work",
        avatar: `https://example.test/${chatId}.jpg`,
      });
    }
    if (/lastIncomingMessages/.test(url)) {
      assert.equal(options.method, "GET");
      incomingAttempts++;
      if (incomingAttempts === 1)
        return new Response(JSON.stringify({ retryAfter: 0 }), { status: 429 });
      return delayedResponse([
        {
          type: "incoming",
          idMessage: "last:old-chat",
          timestamp: 1_800_000_000,
          typeMessage: "textMessage",
          textMessage: "Последнее входящее old-chat",
          chatId: "old-chat",
        },
      ]);
    }
    if (/lastOutgoingMessages/.test(url)) {
      assert.equal(options.method, "GET");
      return delayedResponse([
        {
          type: "outgoing",
          idMessage: "last:group-chat",
          timestamp: 1_800_000_010,
          typeMessage: "textMessage",
          textMessage: "Последнее исходящее group-chat",
          chatId: "group-chat",
        },
      ]);
    }
    assert.fail("Unexpected request");
  };
  try {
    const loader = await vite.ssrLoadModule("/src/features/load-chats/model.ts");
    const loaded = new Promise((resolve) => {
      const unsubscribe = chat.$chats.watch(() => {
        if (chat.$chats.getState().some((item) => item.id === "group-chat")) {
          unsubscribe();
          resolve();
        }
      });
    });
    loader.chatsRequested({ credentials: connection.$credentials.getState() });
    await loaded;
    assert.equal(maxActiveRequests, 1);
    assert.equal(incomingAttempts, 2);
    assert.deepEqual(
      chat.$chats.getState().map(({ id, title, avatarUrl, messages }) => ({
        id,
        title,
        avatarUrl,
        lastMessage: messages.at(-1)?.text,
      })),
      [
        {
          id: "old-chat",
          title: "Старый контакт",
          avatarUrl: "https://example.test/old-chat.jpg",
          lastMessage: "Последнее входящее old-chat",
        },
        {
          id: "group-chat",
          title: "Рабочая группа",
          avatarUrl: "https://example.test/group-chat.jpg",
          lastMessage: "Последнее исходящее group-chat",
        },
      ],
    );
  } finally {
    globalThis.fetch = previousFetch;
    connection.disconnectRequested();
  }
});

void test("a newly created chat is enriched with its contact name and avatar", async () => {
  chat.chatsCleared();
  connection.$credentials.setState({
    idInstance: "fixture-id",
    apiTokenInstance: "fixture-token",
    apiUrl: "https://example.test",
  });
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.match(url, /getContactInfo/);
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(options.body), { chatId: "new-chat" });
    return new Response(
      JSON.stringify({
        chatId: "new-chat",
        name: "Новый контакт",
        avatar: "https://example.test/new-chat.jpg",
      }),
    );
  };
  try {
    await vite.ssrLoadModule("/src/features/load-chats/model.ts");
    const enriched = new Promise((resolve) => {
      const unsubscribe = chat.$chats.watch((chats) => {
        const newChat = chats.find(({ id }) => id === "new-chat");
        if (newChat?.avatarUrl) {
          unsubscribe();
          resolve();
        }
      });
    });
    chat.chatAdded({ id: "new-chat", title: "new-chat" });
    await Promise.race([
      enriched,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("New chat was not enriched")), 100),
      ),
    ]);
    assert.deepEqual(
      chat.$chats.getState().map(({ id, title, avatarUrl }) => ({ id, title, avatarUrl })),
      [
        {
          id: "new-chat",
          title: "Новый контакт",
          avatarUrl: "https://example.test/new-chat.jpg",
        },
      ],
    );
  } finally {
    globalThis.fetch = previousFetch;
    connection.disconnectRequested();
  }
});
