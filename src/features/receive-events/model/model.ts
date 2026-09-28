import { createApiEffect } from "@/shared/api/create-api-effect";
import { incomingMessageAdded, messageStatusUpdated } from "@/entities/chat/model/model";
import { $credentials, disconnectRequested } from "@/features/connect-instance/model/model";
import { deleteNotification, GreenApiError, receiveNotification, type ApiParams, type Credentials, type Notification, type NotificationBody } from "@/shared/api/green-api";
import { createEffect, createEvent, createStore, sample } from "effector";

const receiveNotificationFx = createApiEffect<ApiParams, Notification | null, Error>(receiveNotification);
const deleteNotificationFx = createApiEffect<ApiParams & { receiptId: number }, { result: boolean }, Error>(deleteNotification);
const waitFx = createEffect<number, void>((ms) => new Promise((resolve) => window.setTimeout(resolve, ms)));

export const pollingStarted = createEvent();
export const pollingStopped = createEvent();
const pollNext = createEvent<Credentials>();
const notificationHandled = createEvent<NotificationBody>();
const notificationReceived = createEvent<Notification>();

export const $pollingStatus = createStore<"idle" | "online" | "reconnecting" | "stopped">("idle")
  .on(pollingStarted, () => "online")
  .on(receiveNotificationFx.fail, () => "reconnecting")
  .on(pollingStopped, () => "stopped");

function messageStatus(status: string | undefined) {
  if (status === "read") return "read" as const;
  if (status === "delivered") return "delivered" as const;
  return "sent" as const;
}

sample({ source: $credentials, clock: pollingStarted, filter: (credentials): credentials is Credentials => credentials !== null, target: pollNext });
sample({ clock: pollNext, fn: (credentials) => ({ credentials }), target: receiveNotificationFx });
sample({
  clock: receiveNotificationFx.doneData,
  filter: (notification) => notification !== null,
  fn: (notification) => notification as Notification,
  target: notificationReceived,
});
sample({ clock: notificationReceived, fn: (notification) => notification.body, target: notificationHandled });
sample({ source: $credentials, clock: notificationReceived, filter: (credentials) => credentials !== null, fn: (credentials, notification) => ({ credentials: credentials!, receiptId: notification.receiptId }), target: deleteNotificationFx });
sample({ source: $credentials, clock: receiveNotificationFx.doneData, filter: (credentials, notification) => credentials !== null && notification === null, fn: (credentials) => credentials!, target: pollNext });
sample({ source: $credentials, clock: deleteNotificationFx.done, filter: (credentials) => credentials !== null, fn: (credentials) => credentials!, target: pollNext });
sample({ clock: receiveNotificationFx.failData, filter: (error) => !(error instanceof GreenApiError && error.isUnauthorized), fn: () => 2_000, target: waitFx });
sample({ source: $credentials, clock: waitFx.done, filter: (credentials): credentials is Credentials => credentials !== null, target: pollNext });
sample({ clock: receiveNotificationFx.failData, filter: (error) => error instanceof GreenApiError && error.isUnauthorized, target: pollingStopped });
sample({ clock: disconnectRequested, target: pollingStopped });

sample({
  clock: notificationHandled,
  filter: (body) => body.typeWebhook === "incomingMessageReceived" && body.messageData?.typeMessage === "textMessage" && Boolean(body.senderData?.chatId),
  fn: (body) => ({
    chatId: body.senderData?.chatId ?? "",
    title: body.senderData?.senderContactName || body.senderData?.senderName || "Telegram contact",
    message: {
      localId: body.idMessageData?.idMessage || crypto.randomUUID(),
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
  filter: (body) => body.typeWebhook === "outgoingMessageStatus" && Boolean(body.senderData?.chatId && body.idMessageData?.idMessage),
  fn: (body) => ({ chatId: body.senderData?.chatId ?? "", idMessage: body.idMessageData?.idMessage ?? "", status: messageStatus(body.idMessageData?.status) }),
  target: messageStatusUpdated,
});
