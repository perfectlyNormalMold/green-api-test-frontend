import { createApiEffect } from "@/shared/api/create-api-effect";
import { outgoingMessageAdded, outgoingMessageConfirmed, outgoingMessageFailed } from "@/entities/chat/model/model";
import { $credentials } from "@/features/connect-instance/model/model";
import { sendMessage } from "@/shared/api/green-api";
import type { Credentials } from "@/shared/api/green-api";
import { createEvent, sample } from "effector";

export const messageSubmitted = createEvent<{ chatId: string; text: string }>();

type SendRequest = { chatId: string; text: string; localId: string; credentials: Credentials };
const sendMessageFx = createApiEffect<SendRequest, { idMessage: string }, Error>(({ credentials, chatId, text }) =>
  sendMessage({ credentials, chatId, message: text }),
);

sample({
  source: $credentials,
  clock: messageSubmitted,
  filter: (credentials, { text }) => credentials !== null && Boolean(text.trim()),
  fn: (credentials, { chatId, text }) => ({ credentials: credentials!, chatId, text: text.trim(), localId: crypto.randomUUID() }),
  target: sendMessageFx,
});
sample({
  clock: sendMessageFx,
  fn: ({ chatId, text, localId }) => ({ chatId, message: { localId, text, timestamp: Date.now(), direction: "outgoing" as const, status: "sending" as const } }),
  target: outgoingMessageAdded,
});
sample({
  clock: sendMessageFx.done,
  fn: ({ params, result }) => ({ localId: params.localId, idMessage: result.idMessage }),
  target: outgoingMessageConfirmed,
});
sample({ clock: sendMessageFx.fail, fn: ({ params }) => ({ localId: params.localId }), target: outgoingMessageFailed });
