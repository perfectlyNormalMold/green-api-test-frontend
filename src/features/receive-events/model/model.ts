import { incomingMessageAdded, messageStatusUpdated } from "@/entities/chat/model/model";
import { $credentials, disconnectRequested } from "@/features/connect-instance/model/model";
import {
  deleteNotification,
  GreenApiError,
  receiveNotification,
  type Credentials,
  type NotificationBody,
} from "@/shared/api/green-api";
import { createEffect, createEvent, createStore, sample } from "effector";

const MIN_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

let pollingController: AbortController | null = null;

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

const isAbortError = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

export const pollingStarted = createEvent();
export const pollingStopped = createEvent();
const pollingOnline = createEvent();
const pollingRetrying = createEvent();
const notificationHandled = createEvent<{ receiptId: number; body: NotificationBody }>();

export const $pollingStatus = createStore<"idle" | "online" | "reconnecting" | "stopped">("idle")
  .on(pollingOnline, () => "online")
  .on(pollingRetrying, () => "reconnecting")
  .on(pollingStopped, () => "stopped");

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
        pollingOnline();
        retryDelay = MIN_RETRY_MS;
        if (!notification) continue;

        notificationHandled({ receiptId: notification.receiptId, body: notification.body });
        await deleteNotification({ credentials, receiptId: notification.receiptId, signal });
      } catch (error) {
        if (signal.aborted || isAbortError(error)) return;
        if (error instanceof GreenApiError && error.isUnauthorized) {
          pollingStopped();
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
  return "sent" as const;
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
      idMessage: body.idMessageData?.idMessage,
      text: body.messageData?.textMessageData?.textMessage ?? "",
      timestamp: (body.idMessageData?.timestamp ?? Math.floor(Date.now() / 1000)) * 1000,
      direction: "incoming" as const,
    },
  }),
  target: incomingMessageAdded,
});
sample({
  clock: notificationHandled,
  filter: ({ body }) =>
    body.typeWebhook === "outgoingMessageStatus" &&
    Boolean(body.senderData?.chatId && body.idMessageData?.idMessage),
  fn: ({ body }) => ({
    chatId: body.senderData?.chatId ?? "",
    idMessage: body.idMessageData?.idMessage ?? "",
    status: messageStatus(body.idMessageData?.status),
  }),
  target: messageStatusUpdated,
});