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
const createChat = await vite.ssrLoadModule("/src/features/create-chat/model.ts");
const messenger = await vite.ssrLoadModule("/src/pages/messenger/model/mobile-chat.ts");

void test("phone formatter groups international numbers without changing submitted digits", () => {
  assert.equal(createChat.formatPhoneInput("79991234567"), "+7 999 123 45 67");
  assert.equal(createChat.formatPhoneInput("+1 (202) 555-0123"), "+1 202 555 0123");
  assert.equal(
    createChat.normalizePhone(createChat.formatPhoneInput("+7 999 123 45 67")),
    "79991234567",
  );
  assert.equal(createChat.formatPhoneInput("+7 999a", "+7 999"), "+7 999");
});

void test("phone formatter keeps an incomplete international prefix editable", () => {
  assert.equal(createChat.formatPhoneInput("+"), "+");
  assert.equal(createChat.formatPhoneInput("+7"), "+7");
  assert.equal(createChat.formatPhoneInput(""), "");
});

void test("phone formatter keeps the cursor next to the edited digit", () => {
  const formatted = "+7 999 123 45 67";
  assert.equal(createChat.phoneCaretPosition(formatted, 4), formatted.indexOf("123") - 1);
  assert.equal(createChat.phoneCaretPosition(formatted, 0), 1);
  assert.equal(createChat.phoneCaretPosition(formatted, 11), formatted.length);
});

void test("backspace over formatting removes the preceding digit", () => {
  const value = "+7 999 123";
  const result = createChat.erasePhoneDigitBeforeSeparator(value, value.indexOf("123"));
  assert.equal(result.value, createChat.formatPhoneInput("+7 99123"));
  assert.equal(result.caret, createChat.phoneCaretPosition(result.value, 3));
  assert.equal(createChat.erasePhoneDigitBeforeSeparator(value, value.length), null);
});

void test("chat selection and mobile back action update the page state", () => {
  chat.chatsCleared();
  assert.equal(messenger.$mobileChatOpen.getState(), false);
  chat.chatAdded({ id: "test@c.us", title: "Test" });
  assert.equal(messenger.$mobileChatOpen.getState(), true);
  messenger.mobileChatsShown();
  assert.equal(messenger.$mobileChatOpen.getState(), false);
  chat.chatSelected("test@c.us");
  assert.equal(messenger.$mobileChatOpen.getState(), true);
  chat.chatsCleared();
  assert.equal(messenger.$mobileChatOpen.getState(), false);
});

void test("new-chat form resets on reopen and logout", () => {
  createChat.newChatOpened();
  createChat.newChatPhoneChanged("79991234567");
  assert.equal(createChat.$newChatOpen.getState(), true);
  assert.equal(createChat.$newChatPhone.getState(), "+7 999 123 45 67");
  createChat.newChatClosed();
  createChat.newChatOpened();
  assert.equal(createChat.$newChatPhone.getState(), "");
  connection.disconnectRequested();
  assert.equal(createChat.$newChatOpen.getState(), false);
  assert.equal(createChat.$newChatPhone.getState(), "");
});

void test("closing and reopening new-chat dialog releases a stuck account check", async () => {
  const previousFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = () => new Promise((resolve) => requests.push(resolve));
  try {
    connection.$credentials.setState({
      idInstance: "fixture-id",
      apiTokenInstance: "fixture-token",
      apiUrl: "https://example.test",
    });
    createChat.newChatOpened();
    createChat.newChatSubmitted("79991234567");
    createChat.newChatClosed();
    createChat.newChatOpened();
    assert.equal(createChat.$isNewChatPending.getState(), false);
    createChat.newChatSubmitted("12025550123");
    assert.equal(requests.length, 2);
    const closed = new Promise((resolve) => {
      const unwatch = createChat.newChatClosed.watch(() => {
        unwatch();
        resolve();
      });
    });
    requests[1](new Response('{"exist":true,"chatId":"new@c.us"}'));
    await closed;
    assert.equal(chat.$activeChatId.getState(), "new@c.us");
    requests[0](new Response('{"exist":true,"chatId":"old@c.us"}'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(chat.$activeChatId.getState(), "new@c.us");
  } finally {
    connection.disconnectRequested();
    requests.forEach((resolve) => resolve(new Response("{}")));
    globalThis.fetch = previousFetch;
  }
});

void test("closing new-chat dialog aborts the account check", () => {
  const previousFetch = globalThis.fetch;
  let signal;
  globalThis.fetch = (_url, options) => {
    signal = options.signal;
    return new Promise((_resolve, reject) =>
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
        once: true,
      }),
    );
  };
  try {
    connection.$credentials.setState({
      idInstance: "fixture-id",
      apiTokenInstance: "fixture-token",
      apiUrl: "https://example.test",
    });
    createChat.newChatOpened();
    createChat.newChatSubmitted("79991234567");
    assert.equal(signal.aborted, false);
    createChat.newChatClosed();
    assert.equal(signal.aborted, true);
    assert.equal(createChat.$isNewChatPending.getState(), false);
  } finally {
    connection.disconnectRequested();
    globalThis.fetch = previousFetch;
  }
});

void test("successful chat creation closes the dialog and selects the chat", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ exist: true, chatId: "new@c.us", username: "New" }), {
      status: 200,
    });
  try {
    connection.$credentials.setState({
      idInstance: "fixture-id",
      apiTokenInstance: "fixture-token",
      apiUrl: "https://example.test",
    });
    createChat.newChatOpened();
    const closed = new Promise((resolve) => {
      const unsubscribe = createChat.newChatClosed.watch(() => {
        unsubscribe();
        resolve();
      });
    });
    createChat.newChatSubmitted("1234567890");
    await closed;
    assert.equal(createChat.$newChatOpen.getState(), false);
    assert.equal(chat.$activeChatId.getState(), "new@c.us");
  } finally {
    globalThis.fetch = previousFetch;
    connection.disconnectRequested();
  }
});
