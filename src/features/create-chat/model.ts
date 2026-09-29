import { createEvent, createStore, sample } from "effector";
import { AsYouType } from "libphonenumber-js/min";
import { reset } from "patronum";

import { chatAdded } from "@/entities/chat/model";
import {
  $credentials,
  $sessionVersion,
  disconnectRequested,
} from "@/features/connect-instance/model";
import { createApiEffect } from "@/shared/api/create-api-effect";
import { checkAccount, type Credentials } from "@/shared/api/green-api";

export const newChatSubmitted = createEvent<string>();
export const newChatOpened = createEvent();
export const newChatClosed = createEvent();
export const newChatPhoneChanged = createEvent<string>();
const $dialogVersion = createStore(0).on(
  [newChatOpened, newChatClosed, disconnectRequested],
  (v) => v + 1,
);
export function normalizePhone(value: string) {
  if (!/^\+?[\d\s()-]+$/.test(value.trim())) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? digits : null;
}
export function formatPhoneInput(value: string, previous = "") {
  const trimmed = value.trim();
  if (!/^\+?[\d\s()-]*$/.test(trimmed)) return previous;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length > 15) return previous;
  if (!digits) return trimmed === "+" ? "+" : "";
  return new AsYouType().input(`+${digits}`);
}
export function phoneCaretPosition(formatted: string, digitsBeforeCaret: number) {
  if (digitsBeforeCaret === 0) return formatted.startsWith("+") ? 1 : 0;
  let digits = 0;
  for (let index = 0; index < formatted.length; index++) {
    if (/\d/.test(formatted[index]) && ++digits === digitsBeforeCaret) return index + 1;
  }
  return formatted.length;
}
export function erasePhoneDigitBeforeSeparator(value: string, caret: number) {
  if (caret < 2 || /\d/.test(value[caret - 1])) return null;
  let index = caret - 2;
  while (index >= 0 && !/\d/.test(value[index])) index--;
  if (index < 0) return null;
  const formatted = formatPhoneInput(value.slice(0, index) + value.slice(index + 1));
  const digitsBeforeCaret = value.slice(0, index).replace(/\D/g, "").length;
  return { value: formatted, caret: phoneCaretPosition(formatted, digitsBeforeCaret) };
}
export const $newChatOpen = createStore(false)
  .on(newChatOpened, () => true)
  .on(newChatClosed, () => false)
  .reset(disconnectRequested);
export const $newChatPhone = createStore("")
  .on(newChatOpened, () => "")
  .on(newChatPhoneChanged, (previous, value) => formatPhoneInput(value, previous))
  .reset(disconnectRequested);

type CheckRequest = {
  credentials: Credentials;
  phoneNumber: string;
  sessionVersion: number;
  dialogVersion: number;
};
let accountController: AbortController | null = null;
const abortAccountCheck = () => accountController?.abort();
newChatOpened.watch(abortAccountCheck);
newChatClosed.watch(abortAccountCheck);
disconnectRequested.watch(abortAccountCheck);
const checkAccountFx = createApiEffect<
  CheckRequest,
  Awaited<ReturnType<typeof checkAccount>>,
  Error
>(async ({ credentials, phoneNumber }) => {
  const controller = new AbortController();
  accountController?.abort();
  accountController = controller;
  try {
    return await checkAccount({ credentials, phoneNumber, signal: controller.signal });
  } finally {
    if (accountController === controller) accountController = null;
  }
});
const context = {
  credentials: $credentials,
  sessionVersion: $sessionVersion,
  dialogVersion: $dialogVersion,
  open: $newChatOpen,
};
const validResult = sample({
  source: context,
  clock: checkAccountFx.done,
  filter: ({ credentials, sessionVersion, dialogVersion, open }, { params }) =>
    open &&
    credentials === params.credentials &&
    sessionVersion === params.sessionVersion &&
    dialogVersion === params.dialogVersion,
  fn: (_, { result }) => result,
});
const validFailure = sample({
  source: context,
  clock: checkAccountFx.fail,
  filter: ({ credentials, sessionVersion, dialogVersion, open }, { params }) =>
    open &&
    credentials === params.credentials &&
    sessionVersion === params.sessionVersion &&
    dialogVersion === params.dialogVersion,
  fn: (_, { error }) => error,
});
export const $newChatError = createStore<string | null>(null).on(
  validFailure,
  (_, error) => error.message,
);
const $activeCheck = createStore<CheckRequest | null>(null)
  .on(checkAccountFx, (_, request) => request)
  .on([validResult, validFailure], () => null)
  .reset(newChatOpened, newChatClosed, disconnectRequested);
export const $isNewChatPending = $activeCheck.map((request) => request !== null);

sample({
  source: { ...context, pending: $isNewChatPending },
  clock: newChatSubmitted,
  filter: ({ credentials, pending }, value) =>
    credentials !== null && !pending && normalizePhone(value) !== null,
  fn: ({ credentials, sessionVersion, dialogVersion }, value) => ({
    credentials: credentials!,
    sessionVersion,
    dialogVersion,
    phoneNumber: normalizePhone(value)!,
  }),
  target: checkAccountFx,
});
sample({
  clock: validResult,
  filter: (result) => Boolean(result.exist && result.chatId),
  fn: (result) => ({
    id: result.chatId ?? "",
    title: result.username || `+${result.phoneNumber ?? "Контакт"}`,
    subtitle: "Telegram",
  }),
  target: chatAdded,
});
sample({
  clock: validResult,
  filter: (result) => Boolean(result.exist && result.chatId),
  fn: () => undefined,
  target: newChatClosed,
});
sample({
  clock: validResult,
  filter: (result) => !result.exist || !result.chatId,
  fn: (result) =>
    result.reason ||
    result.data?.reason ||
    "Telegram-аккаунт не найден или скрыт настройками приватности.",
  target: $newChatError,
});
reset({
  clock: [newChatSubmitted, newChatOpened, newChatClosed, disconnectRequested],
  target: [$newChatError],
});
