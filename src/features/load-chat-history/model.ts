import { combine, createEvent, createStore, sample } from "effector";

import {
  $activeChatId,
  chatMessageFromHistory,
  chatHistoryLoaded,
  type ChatMessage,
} from "@/entities/chat/model";
import {
  $credentials,
  $sessionVersion,
  disconnectRequested,
} from "@/features/connect-instance/model";
import { createApiEffect } from "@/shared/api/create-api-effect";
import { getChatHistory, type ChatHistoryItem, type Credentials } from "@/shared/api/green-api";

type HistoryRequest = { chatId: string; credentials: Credentials; sessionVersion?: number };

export const historyRequested = createEvent<HistoryRequest>();

const loadHistoryFx = createApiEffect<HistoryRequest, ChatHistoryItem[], Error>(
  async ({ chatId, credentials }) => {
    const result = await getChatHistory({ chatId, credentials, count: 100 });
    if (
      !Array.isArray(result) ||
      !result.every(
        (item) =>
          item &&
          (item.type === "incoming" || item.type === "outgoing") &&
          typeof item.idMessage === "string" &&
          typeof item.timestamp === "number" &&
          typeof item.typeMessage === "string",
      )
    )
      throw new Error("GREEN-API вернул некорректную историю сообщений.");
    return result;
  },
);

const $historyState = createStore<{
  request: HistoryRequest | null;
  loading: boolean;
  error: string | null;
}>({ request: null, loading: false, error: null })
  .on(loadHistoryFx, (_, request) => ({ request, loading: true, error: null }))
  .on(loadHistoryFx.done, (state, { params }) =>
    state.request === params ? { ...state, loading: false } : state,
  )
  .on(loadHistoryFx.fail, (state, { params, error }) =>
    state.request === params ? { ...state, loading: false, error: error.message } : state,
  )
  .reset(disconnectRequested);
export const $historyLoading = combine(
  $historyState,
  $activeChatId,
  (state, chatId) => state.request?.chatId === chatId && state.loading,
);
export const $historyError = combine($historyState, $activeChatId, (state, chatId) =>
  state.request?.chatId === chatId ? state.error : null,
);
sample({
  source: $sessionVersion,
  clock: historyRequested,
  fn: (sessionVersion, request) => ({ ...request, sessionVersion }),
  target: loadHistoryFx,
});
sample({
  source: { credentials: $credentials, sessionVersion: $sessionVersion },
  clock: loadHistoryFx.done,
  filter: ({ credentials, sessionVersion }, { params }) =>
    credentials === params.credentials && sessionVersion === params.sessionVersion,
  fn: (_, { params, result }) => ({
    chatId: params.chatId,
    messages: result
      .map(chatMessageFromHistory)
      .filter((message): message is ChatMessage => message !== null),
  }),
  target: chatHistoryLoaded,
});
