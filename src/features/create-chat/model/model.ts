import { createApiEffect } from "@/shared/api/create-api-effect";
import { chatAdded } from "@/entities/chat/model/model";
import { $credentials } from "@/features/connect-instance/model/model";
import { checkAccount } from "@/shared/api/green-api";
import { createEvent, createStore, sample } from "effector";
import { pending, reset } from "patronum";

export const newChatSubmitted = createEvent<string>();

const checkAccountFx = createApiEffect(checkAccount);
export const $newChatError = createStore<string | null>(null).on(checkAccountFx.failData, (_, error) => error.message);
export const $isNewChatPending = pending({ effects: [checkAccountFx] });

sample({
  source: $credentials,
  clock: newChatSubmitted,
  filter: (credentials, value) => credentials !== null && Boolean(value.trim()),
  fn: (credentials, value) => ({ credentials: credentials!, phoneNumber: value.replace(/\D/g, "") }),
  target: checkAccountFx,
});
sample({
  clock: checkAccountFx.doneData,
  filter: (result) => Boolean(result.exist && result.chatId),
  fn: (result) => ({ id: result.chatId ?? "", title: result.username || `+${result.phoneNumber ?? "Контакт"}`, subtitle: "Telegram" }),
  target: chatAdded,
});
sample({
  clock: checkAccountFx.doneData,
  filter: (result) => !result.exist || !result.chatId,
  fn: (result) => result.reason || result.data?.reason || "Telegram-аккаунт не найден или скрыт настройками приватности.",
  target: $newChatError,
});
reset({ clock: newChatSubmitted, target: [$newChatError] });
