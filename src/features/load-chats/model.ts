import { createEvent, sample } from "effector";

import {
  chatAdded,
  chatMessageFromHistory,
  chatsLoaded,
  type ChatMessage,
} from "@/entities/chat/model";
import { $credentials, $sessionVersion } from "@/features/connect-instance/model";
import { createApiEffect } from "@/shared/api/create-api-effect";
import {
  getChats,
  getChatHistory,
  getContactInfo,
  GreenApiError,
  lastIncomingMessages,
  lastOutgoingMessages,
  type ChatSummary,
  type ChatHistoryItem,
  type ContactInfo,
  type Credentials,
} from "@/shared/api/green-api";

type ChatsRequest = { credentials: Credentials; sessionVersion?: number };
type ChatDetailsRequest = {
  chatId: string;
  fallbackTitle: string;
  credentials: Credentials;
  sessionVersion: number;
};
type ChatSource = Pick<ChatSummary, "chatId"> & Partial<Omit<ChatSummary, "chatId">>;
type LoadedChat = {
  id: string;
  title: string;
  subtitle: string;
  avatarUrl?: string;
  messages: ChatMessage[];
};

function toLoadedChat(
  chat: ChatSource,
  contact?: ContactInfo,
  history: ChatHistoryItem[] = [],
): LoadedChat | null {
  if (!chat || typeof chat.chatId !== "string" || !chat.chatId) return null;
  const title =
    (typeof contact?.name === "string" && contact.name.trim()) ||
    (typeof contact?.contactName === "string" && contact.contactName.trim()) ||
    (typeof chat.name === "string" && chat.name.trim()) ||
    (typeof contact?.username === "string" && contact.username.trim()) ||
    (typeof chat.username === "string" && chat.username.trim()) ||
    chat.chatId;
  return {
    id: chat.chatId,
    title,
    subtitle: "Telegram",
    avatarUrl: typeof contact?.avatar === "string" && contact.avatar ? contact.avatar : undefined,
    messages: history
      .map(chatMessageFromHistory)
      .filter((message): message is ChatMessage => message !== null),
  };
}

async function mapSequentially<Input, Output>(
  values: Input[],
  worker: (value: Input) => Promise<Output>,
) {
  const results: Output[] = [];
  for (const value of values) results.push(await worker(value));
  return results;
}

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function rateLimitDelay(error: unknown) {
  if (!(error instanceof GreenApiError) || error.status !== 429) return null;
  if (typeof error.details !== "object" || error.details === null) return 1_000;
  const details = error.details as { retryAfter?: unknown; data?: { retryAfter?: unknown } };
  const retryAfter = details.retryAfter ?? details.data?.retryAfter;
  return typeof retryAfter === "number" && retryAfter >= 0 ? retryAfter : 1_000;
}

async function retryOnRateLimit<Result>(request: () => Promise<Result>) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await request();
    } catch (error) {
      const delay = rateLimitDelay(error);
      if (delay === null || attempt === 2) throw error;
      await wait(delay);
    }
  }
}

export const chatsRequested = createEvent<ChatsRequest>();

const loadChatsFx = createApiEffect<ChatsRequest, LoadedChat[], Error>(async ({ credentials }) => {
  const chats = await retryOnRateLimit(() => getChats({ credentials }));
  if (!Array.isArray(chats)) throw new Error("GREEN-API вернул некорректный список чатов.");
  const recentMessagesByChatId = new Map<string, ChatHistoryItem>();
  for (const messages of [
    await retryOnRateLimit(() => lastIncomingMessages({ credentials })),
    await retryOnRateLimit(() => lastOutgoingMessages({ credentials })),
  ]) {
    for (const message of messages) {
      if (!chatMessageFromHistory(message)) continue;
      const current = recentMessagesByChatId.get(message.chatId);
      if (!current || message.timestamp > current.timestamp)
        recentMessagesByChatId.set(message.chatId, message);
    }
  }
  const details = await mapSequentially(chats, async (chat) => {
    const contact = await retryOnRateLimit(() =>
      getContactInfo({ credentials, chatId: chat.chatId }),
    ).catch(() => null);
    const preview = recentMessagesByChatId.get(chat.chatId);
    const history = preview
      ? [preview]
      : await retryOnRateLimit(() =>
          getChatHistory({ credentials, chatId: chat.chatId, count: 1 }),
        ).catch(() => []);
    return { contact, history: Array.isArray(history) ? history : [] };
  });
  return chats
    .map((chat, index) =>
      toLoadedChat(chat, details[index].contact ?? undefined, details[index].history),
    )
    .filter((chat): chat is LoadedChat => chat !== null);
});

const loadChatDetailsFx = createApiEffect<ChatDetailsRequest, LoadedChat, Error>(
  async ({ chatId, fallbackTitle, credentials }) => {
    const contact = await retryOnRateLimit(() => getContactInfo({ credentials, chatId })).catch(
      () => null,
    );
    return toLoadedChat({ chatId, name: fallbackTitle }, contact ?? undefined) as LoadedChat;
  },
);

sample({
  source: $sessionVersion,
  clock: chatsRequested,
  fn: (sessionVersion, request) => ({ ...request, sessionVersion }),
  target: loadChatsFx,
});

sample({
  source: { credentials: $credentials, sessionVersion: $sessionVersion },
  clock: loadChatsFx.done,
  filter: ({ credentials, sessionVersion }, { params }) =>
    credentials === params.credentials && sessionVersion === params.sessionVersion,
  fn: (_, { result }) => result,
  target: chatsLoaded,
});

sample({
  source: { credentials: $credentials, sessionVersion: $sessionVersion },
  clock: chatAdded,
  filter: ({ credentials }) => credentials !== null,
  fn: ({ credentials, sessionVersion }, chat) => ({
    chatId: chat.id,
    fallbackTitle: chat.title,
    credentials: credentials!,
    sessionVersion,
  }),
  target: loadChatDetailsFx,
});

sample({
  source: { credentials: $credentials, sessionVersion: $sessionVersion },
  clock: loadChatDetailsFx.done,
  filter: ({ credentials, sessionVersion }, { params }) =>
    credentials === params.credentials && sessionVersion === params.sessionVersion,
  fn: (_, { result }) => [result],
  target: chatsLoaded,
});
