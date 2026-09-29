import { combine, createEffect, createEvent, createStore, sample } from "effector";

import type { ChatHistoryItem } from "@/shared/api/green-api";

export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "failed";

export type ChatMessage = {
  localId: string;
  idMessage?: string;
  text: string;
  timestamp: number;
  direction: "incoming" | "outgoing";
  status?: MessageStatus;
  error?: string;
};

export type Chat = {
  id: string;
  title: string;
  subtitle?: string;
  avatarUrl?: string;
  messages: ChatMessage[];
  unreadCount: number;
};

export function chatMessageFromHistory(item: ChatHistoryItem): ChatMessage | null {
  if (
    !item ||
    item.typeMessage !== "textMessage" ||
    typeof item.textMessage !== "string" ||
    typeof item.idMessage !== "string" ||
    typeof item.timestamp !== "number" ||
    (item.type !== "incoming" && item.type !== "outgoing")
  )
    return null;
  const status: MessageStatus | undefined =
    item.type === "outgoing"
      ? item.statusMessage === "read" || item.statusMessage === "delivered"
        ? item.statusMessage
        : "sent"
      : undefined;

  return {
    localId: `history:${item.idMessage}`,
    idMessage: item.idMessage,
    text: item.textMessage,
    timestamp: item.timestamp * 1000,
    direction: item.type,
    status,
  };
}

const storageKey = (instanceId: string) => `green-api:chats:${instanceId}`;

function restoreChats(instanceId: string) {
  try {
    const raw = sessionStorage.getItem(storageKey(instanceId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) &&
      parsed.every(
        (chat) =>
          chat &&
          typeof chat.id === "string" &&
          typeof chat.title === "string" &&
          (chat.avatarUrl === undefined || typeof chat.avatarUrl === "string") &&
          Number.isInteger(chat.unreadCount) &&
          Array.isArray(chat.messages) &&
          chat.messages.every(
            (message: ChatMessage) =>
              message &&
              typeof message.localId === "string" &&
              typeof message.text === "string" &&
              typeof message.timestamp === "number" &&
              (message.direction === "incoming" || message.direction === "outgoing"),
          ),
      )
      ? (parsed as Chat[]).map((chat) => ({
          ...chat,
          messages: chat.messages.map((message) =>
            message.status === "sending"
              ? {
                  ...message,
                  status: "failed" as const,
                  error: "Отправка прервана перезагрузкой. Проверьте доставку перед повтором.",
                }
              : message,
          ),
        }))
      : [];
  } catch {
    return [];
  }
}

export const chatsRestored = createEvent<{ instanceId: string }>();
export const chatsCleared = createEvent();
export const chatSelected = createEvent<string>();
export const chatAdded = createEvent<Pick<Chat, "id" | "title" | "subtitle" | "avatarUrl">>();
export const chatsLoaded =
  createEvent<
    Array<Pick<Chat, "id" | "title" | "subtitle" | "avatarUrl"> & { messages?: ChatMessage[] }>
  >();
export const incomingMessageAdded = createEvent<{
  chatId: string;
  title: string;
  message: ChatMessage;
}>();
export const outgoingMessageAdded = createEvent<{ chatId: string; message: ChatMessage }>();
export const outgoingMessageConfirmed = createEvent<{ localId: string; idMessage: string }>();
export const messageStatusUpdated = createEvent<{
  chatId: string;
  idMessage: string;
  status: MessageStatus;
}>();
export const outgoingMessageFailed = createEvent<{ localId: string; error?: string }>();
export const chatHistoryLoaded = createEvent<{ chatId: string; messages: ChatMessage[] }>();
const incomingApplied = createEvent<{
  chatId: string;
  title: string;
  message: ChatMessage;
  active: boolean;
}>();
export const $activeChatId = createStore<string | null>(null)
  .on(chatSelected, (_, chatId) => chatId)
  .on(chatAdded, (_, chat) => chat.id)
  .on(chatsCleared, () => null);
sample({
  source: $activeChatId,
  clock: incomingMessageAdded,
  fn: (activeChatId, payload) => ({ ...payload, active: activeChatId === payload.chatId }),
  target: incomingApplied,
});

function laterStatus(current?: MessageStatus, next?: MessageStatus): MessageStatus | undefined {
  if (next === "failed") return current === "read" || current === "delivered" ? current : "failed";
  if (current === "failed") return next && next !== "sending" ? next : current;
  const order = ["sending", "sent", "delivered", "read"];
  return order.indexOf(current ?? "") > order.indexOf(next ?? "") ? current : next;
}

function mergeMessages(existing: ChatMessage[], history: ChatMessage[]) {
  const messages = history.toReversed().map((message) => {
    const current = existing.find((item) => item.idMessage === message.idMessage);
    return current
      ? {
          ...current,
          ...message,
          localId: current.localId,
          status: laterStatus(current.status, message.status),
        }
      : message;
  });
  messages.push(
    ...existing.filter(
      (message) =>
        !message.idMessage || !history.some((item) => item.idMessage === message.idMessage),
    ),
  );
  return messages.sort((a, b) => a.timestamp - b.timestamp);
}

export const $chats = createStore<Chat[]>([])
  .on(chatsRestored, (_, { instanceId }) => restoreChats(instanceId))
  .on(chatsCleared, () => [])
  .on(chatAdded, (chats, chat) =>
    chats.some(({ id }) => id === chat.id)
      ? chats
      : [{ ...chat, messages: [], unreadCount: 0 }, ...chats],
  )
  .on(chatsLoaded, (chats, loadedChats) => {
    const loadedIds = new Set(loadedChats.map(({ id }) => id));
    return [
      ...loadedChats.map((chat) => {
        const existing = chats.find(({ id }) => id === chat.id);
        return existing
          ? {
              ...existing,
              title: chat.title,
              subtitle: chat.subtitle ?? existing.subtitle,
              avatarUrl: chat.avatarUrl ?? existing.avatarUrl,
              messages: chat.messages?.length
                ? mergeMessages(existing.messages, chat.messages)
                : existing.messages,
            }
          : { ...chat, messages: chat.messages ?? [], unreadCount: 0 };
      }),
      ...chats.filter(({ id }) => !loadedIds.has(id)),
    ];
  })
  .on(chatSelected, (chats, chatId) =>
    chats.map((chat) =>
      chat.id === chatId && chat.unreadCount ? { ...chat, unreadCount: 0 } : chat,
    ),
  )
  .on(incomingApplied, (chats, { chatId, title, message, active }) => {
    const existing = chats.find(({ id }) => id === chatId);
    if (!existing)
      return [{ id: chatId, title, messages: [message], unreadCount: active ? 0 : 1 }, ...chats];
    if (
      existing.messages.some(
        (existingMessage) =>
          existingMessage.localId === message.localId ||
          (Boolean(message.idMessage) && existingMessage.idMessage === message.idMessage),
      )
    ) {
      return chats;
    }
    return chats.map((chat) =>
      chat.id === chatId
        ? {
            ...chat,
            title: chat.title || title,
            messages: [...chat.messages, message],
            unreadCount: active ? 0 : chat.unreadCount + 1,
          }
        : chat,
    );
  })
  .on(outgoingMessageAdded, (chats, { chatId, message }) =>
    chats.map((chat) =>
      chat.id === chatId &&
      !chat.messages.some(
        (item) =>
          item.localId === message.localId ||
          (message.idMessage && item.idMessage === message.idMessage),
      )
        ? { ...chat, messages: [...chat.messages, message] }
        : chat,
    ),
  )
  .on(chatHistoryLoaded, (chats, { chatId, messages }) =>
    chats.map((chat) =>
      chat.id === chatId ? { ...chat, messages: mergeMessages(chat.messages, messages) } : chat,
    ),
  )
  .on(outgoingMessageConfirmed, (chats, { localId, idMessage }) =>
    chats.map((chat) => {
      const optimistic = chat.messages.find((message) => message.localId === localId);
      if (!optimistic) return chat;
      const serverCopy = chat.messages.find(
        (message) => message.idMessage === idMessage && message.localId !== localId,
      );
      return {
        ...chat,
        messages: chat.messages
          .filter((message) => message !== serverCopy)
          .map((message) =>
            message.localId === localId
              ? {
                  ...message,
                  idMessage,
                  status: laterStatus(message.status, serverCopy?.status ?? "sent"),
                  error: undefined,
                }
              : message,
          ),
      };
    }),
  )
  .on(outgoingMessageFailed, (chats, { localId, error }) =>
    chats.map((chat) => ({
      ...chat,
      messages: chat.messages.map((message) =>
        message.localId === localId ? { ...message, status: "failed", error } : message,
      ),
    })),
  )
  .on(messageStatusUpdated, (chats, { chatId, idMessage, status }) =>
    chats.map((chat) =>
      chat.id !== chatId
        ? chat
        : {
            ...chat,
            messages: chat.messages.map((message) =>
              message.idMessage === idMessage
                ? { ...message, status: laterStatus(message.status, status) }
                : message,
            ),
          },
    ),
  );

export const $activeChat = combine(
  $chats,
  $activeChatId,
  (chats, activeChatId) => chats.find(({ id }) => id === activeChatId) ?? null,
);

const persistChatsFx = createEffect<{ instanceId: string; chats: Chat[] }, void>(
  ({ instanceId, chats }) => {
    sessionStorage.setItem(storageKey(instanceId), JSON.stringify(chats));
  },
);

export const chatsPersistenceRequested = createEvent<string>();
sample({
  source: $chats,
  clock: chatsPersistenceRequested,
  fn: (chats, instanceId) => ({ chats, instanceId }),
  target: persistChatsFx,
});
