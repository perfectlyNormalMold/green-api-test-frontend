import { createEvent, sample } from "effector";

import {
  outgoingMessageAdded,
  outgoingMessageConfirmed,
  outgoingMessageFailed,
} from "@/entities/chat/model";
import { $credentials, $sessionVersion } from "@/features/connect-instance/model";
import { createApiEffect } from "@/shared/api/create-api-effect";
import { sendMessage } from "@/shared/api/green-api";
import type { Credentials } from "@/shared/api/green-api";

export const messageSubmitted = createEvent<{ chatId: string; text: string }>();

type SendRequest = {
  chatId: string;
  text: string;
  localId: string;
  credentials: Credentials;
  sessionVersion: number;
};
const sendMessageFx = createApiEffect<SendRequest, { idMessage: string }, Error>(
  ({ credentials, chatId, text }) => sendMessage({ credentials, chatId, message: text }),
);

sample({
  source: { credentials: $credentials, sessionVersion: $sessionVersion },
  clock: messageSubmitted,
  filter: ({ credentials }, { text, chatId }) =>
    credentials !== null && Boolean(chatId && text.trim()) && text.trim().length <= 4096,
  fn: ({ credentials, sessionVersion }, { chatId, text }) => ({
    credentials: credentials!,
    sessionVersion,
    chatId,
    text: text.trim(),
    localId: crypto.randomUUID(),
  }),
  target: sendMessageFx,
});
sample({
  clock: sendMessageFx,
  fn: ({ chatId, text, localId }) => ({
    chatId,
    message: {
      localId,
      text,
      timestamp: Date.now(),
      direction: "outgoing" as const,
      status: "sending" as const,
    },
  }),
  target: outgoingMessageAdded,
});
sample({
  source: { credentials: $credentials, sessionVersion: $sessionVersion },
  clock: sendMessageFx.done,
  filter: ({ credentials, sessionVersion }, { params }) =>
    credentials === params.credentials && sessionVersion === params.sessionVersion,
  fn: (_, { params, result }) => ({ localId: params.localId, idMessage: result.idMessage }),
  target: outgoingMessageConfirmed,
});
sample({
  source: { credentials: $credentials, sessionVersion: $sessionVersion },
  clock: sendMessageFx.fail,
  filter: ({ credentials, sessionVersion }, { params }) =>
    credentials === params.credentials && sessionVersion === params.sessionVersion,
  fn: (_, { params, error }) => ({ localId: params.localId, error: error.message }),
  target: outgoingMessageFailed,
});
