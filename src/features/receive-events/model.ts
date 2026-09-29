import { createEffect, createEvent, createStore, sample } from "effector";

import {
  incomingMessageAdded,
  messageStatusUpdated,
  outgoingMessageAdded,
} from "@/entities/chat/model";
import { $credentials, disconnectRequested } from "@/features/connect-instance/model";
import {
  deleteNotification,
  GreenApiError,
  receiveNotification,
  type Credentials,
  type NotificationBody,
} from "@/shared/api/green-api";

const MIN_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

let pollingController: AbortController | null = null;

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const done = () => {
      signal.removeEventListener("abort", abort);
      resolve();
    };
    const abort = () => {
      window.clearTimeout(timer);
      done();
    };
    const timer = window.setTimeout(done, ms);
    signal.addEventListener("abort", abort, { once: true });
  });

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

export const pollingStarted = createEvent();
export const pollingStopped = createEvent();
const pollingOnline = createEvent();
const pollingRetrying = createEvent();
const notificationHandled = createEvent<{ receiptId: number; body: NotificationBody }>();

export const $pollingStatus = createStore<"idle" | "online" | "reconnecting" | "stopped">("idle")
  .on(pollingOnline, () => "online")
  .on(pollingRetrying, () => "reconnecting")
  .on(pollingStopped, () => "stopped");
export const $pollingError = createStore<string | null>(null)
  .on(pollingStarted, () => null)
  .on(pollingOnline, () => null)
  .on(pollingStopped, () => null);
const pollingErrorOccurred = createEvent<string>();
$pollingError.on(pollingErrorOccurred, (_, error) => error);

const stopPollingFx = createEffect(() => {
  pollingController?.abort();
  pollingController = null;
});

const pollingRunFx = createEffect<Credentials, void>(async (credentials) => {
  pollingController?.abort();
  const controller = new AbortController();
  pollingController = controller;
  const { signal } = controller;
  let retryDelay = MIN_RETRY_MS;

  try {
    while (!signal.aborted) {
      try {
        const notification = await receiveNotification({ credentials, signal });
        if (notification) {
          if (
            typeof notification.receiptId !== "number" ||
            !notification.body ||
            typeof notification.body.typeWebhook !== "string"
          )
            throw new Error("Некорректное уведомление GREEN-API.");
          if (signal.aborted) return;
          notificationHandled({ receiptId: notification.receiptId, body: notification.body });
          const ack = await deleteNotification({
            credentials,
            receiptId: notification.receiptId,
            signal,
          });
          if (ack?.result !== true)
            throw new Error("GREEN-API не подтвердил удаление уведомления.");
          if (signal.aborted) return;
        }
        pollingOnline();
        retryDelay = MIN_RETRY_MS;
      } catch (error) {
        if (signal.aborted || isAbortError(error)) return;
        if (error instanceof GreenApiError && error.isUnauthorized) {
          pollingStopped();
          pollingErrorOccurred(
            "Доступ к уведомлениям отклонён. Отключитесь и проверьте данные инстанса.",
          );
          return;
        }

        pollingRetrying();
        await wait(retryDelay, signal);
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_MS);
      }
    }
  } finally {
    if (pollingController === controller) pollingController = null;
  }
});

function messageStatus(status: string | undefined) {
  if (status === "read") return "read" as const;
  if (status === "delivered") return "delivered" as const;
  if (status === "sent") return "sent" as const;
  if (status === "failed" || status === "noAccount") return "failed" as const;
  return null;
}

sample({
  source: $credentials,
  clock: pollingStarted,
  filter: (credentials) => credentials !== null,
  fn: (credentials) => credentials!,
  target: pollingRunFx,
});
sample({ clock: pollingStopped, target: stopPollingFx });
sample({ clock: disconnectRequested, target: pollingStopped });

sample({
  clock: notificationHandled,
  filter: ({ body }) =>
    body.typeWebhook === "incomingMessageReceived" &&
    body.messageData?.typeMessage === "textMessage" &&
    Boolean(body.senderData?.chatId),
  fn: ({ receiptId, body }) => ({
    chatId: body.senderData?.chatId ?? "",
    title: body.senderData?.senderContactName || body.senderData?.senderName || "Telegram contact",
    message: {
      localId: `incoming:${receiptId}`,
      idMessage: body.idMessage,
      text: body.messageData?.textMessageData?.textMessage ?? "",
      timestamp: (body.timestamp ?? Math.floor(Date.now() / 1000)) * 1000,
      direction: "incoming" as const,
    },
  }),
  target: incomingMessageAdded,
});
sample({
  clock: notificationHandled,
  filter: ({ body }) =>
    body.typeWebhook === "outgoingMessageReceived" &&
    body.messageData?.typeMessage === "textMessage" &&
    Boolean(body.senderData?.chatId),
  fn: ({ receiptId, body }) => ({
    chatId: body.senderData?.chatId ?? "",
    message: {
      localId: `outgoing:${receiptId}`,
      idMessage: body.idMessage,
      text: body.messageData?.textMessageData?.textMessage ?? "",
      timestamp: (body.timestamp ?? Math.floor(Date.now() / 1000)) * 1000,
      direction: "outgoing" as const,
      status: "sent" as const,
    },
  }),
  target: outgoingMessageAdded,
});
sample({
  clock: notificationHandled,
  filter: ({ body }) =>
    body.typeWebhook === "outgoingMessageStatus" &&
    Boolean(body.chatId && body.idMessage && messageStatus(body.status)),
  fn: ({ body }) => ({
    chatId: body.chatId ?? "",
    idMessage: body.idMessage ?? "",
    status: messageStatus(body.status)!,
  }),
  target: messageStatusUpdated,
});
