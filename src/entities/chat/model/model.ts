import { createEffect, createEvent, createStore, sample } from "effector";

export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "failed";

export type ChatMessage = {
  localId: string;
  idMessage?: string;
  text: string;
  timestamp: number;
  direction: "incoming" | "outgoing";
  status?: MessageStatus;
};

export type Chat = {
  id: string;
  title: string;
  subtitle?: string;
  messages: ChatMessage[];
  unreadCount: number;
};

const storageKey = (instanceId: string) => `green-api:chats:${instanceId}`;

function restoreChats(instanceId: string) {
  try {
    const raw = sessionStorage.getItem(storageKey(instanceId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Chat[]) : [];
  } catch {
    return [];
  }
}

export const chatsRestored = createEvent<{ instanceId: string }>();
export const chatsCleared = createEvent();
export const chatSelected = createEvent<string>();
export const chatAdded = createEvent<Pick<Chat, "id" | "title" | "subtitle">>();
export const incomingMessageAdded = createEvent<{ chatId: string; title: string; message: ChatMessage }>();
export const outgoingMessageAdded = createEvent<{ chatId: string; message: ChatMessage }>();
export const outgoingMessageConfirmed = createEvent<{ localId: string; idMessage: string }>();
export const messageStatusUpdated = createEvent<{ chatId: string; idMessage: string; status: MessageStatus }>();
export const outgoingMessageFailed = createEvent<{ localId: string }>();

export const $chats = createStore<Chat[]>([])
  .on(chatsRestored, (_, { instanceId }) => restoreChats(instanceId))
  .on(chatsCleared, () => [])
  .on(chatAdded, (chats, chat) =>
    chats.some(({ id }) => id === chat.id) ? chats : [{ ...chat, messages: [], unreadCount: 0 }, ...chats],
  )
  .on(incomingMessageAdded, (chats, { chatId, title, message }) => {
    const existing = chats.find(({ id }) => id === chatId);
    if (!existing) return [{ id: chatId, title, messages: [message], unreadCount: 1 }, ...chats];
    if (existing.messages.some(({ idMessage }) => idMessage && idMessage === message.idMessage)) return chats;
    return chats.map((chat) =>
      chat.id === chatId
        ? { ...chat, title: chat.title || title, messages: [...chat.messages, message], unreadCount: chat.unreadCount + 1 }
        : chat,
    );
  })
  .on(outgoingMessageAdded, (chats, { chatId, message }) =>
    chats.map((chat) => (chat.id === chatId ? { ...chat, messages: [...chat.messages, message] } : chat)),
  )
  .on(outgoingMessageConfirmed, (chats, { localId, idMessage }) =>
    chats.map((chat) => ({
      ...chat,
      messages: chat.messages.map((message) => (message.localId === localId ? { ...message, idMessage, status: "sent" } : message)),
    })),
  )
  .on(outgoingMessageFailed, (chats, { localId }) =>
    chats.map((chat) => ({
      ...chat,
      messages: chat.messages.map((message) => (message.localId === localId ? { ...message, status: "failed" } : message)),
    })),
  )
  .on(messageStatusUpdated, (chats, { chatId, idMessage, status }) =>
    chats.map((chat) =>
      chat.id !== chatId
        ? chat
        : { ...chat, messages: chat.messages.map((message) => (message.idMessage === idMessage ? { ...message, status } : message)) },
    ),
  );

export const $activeChatId = createStore<string | null>(null)
  .on(chatSelected, (_, chatId) => chatId)
  .on(chatAdded, (_, chat) => chat.id)
  .on(chatsCleared, () => null);

export const $activeChat = createStore<Chat | null>(null);
$activeChat.on($chats, (activeChat, chats) => (activeChat ? chats.find(({ id }) => id === activeChat.id) ?? null : null));
sample({ source: { chats: $chats, activeChatId: $activeChatId }, fn: ({ chats, activeChatId }) => chats.find(({ id }) => id === activeChatId) ?? null, target: $activeChat });

const persistChatsFx = createEffect<{ instanceId: string; chats: Chat[] }, void>(({ instanceId, chats }) => {
  sessionStorage.setItem(storageKey(instanceId), JSON.stringify(chats));
});

export const chatsPersistenceRequested = createEvent<string>();
sample({ source: $chats, clock: chatsPersistenceRequested, fn: (chats, instanceId) => ({ chats, instanceId }), target: persistChatsFx });
