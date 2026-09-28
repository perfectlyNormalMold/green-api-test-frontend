import { request } from "./request";
import type { ApiParams, CheckAccountResult, Notification, Settings } from "./types";

type CheckAccountParams = ApiParams & { phoneNumber?: string; username?: string };
type SendMessageParams = ApiParams & { chatId: string; message: string };
type DeleteNotificationParams = ApiParams & { receiptId: number };
type SetSettingsParams = ApiParams & { settings: Settings };

export const getStateInstance = ({ credentials, signal }: ApiParams) =>
  request<{ stateInstance: string }>({ credentials, signal, method: "GET", endpoint: "getStateInstance" });

export const getSettings = ({ credentials, signal }: ApiParams) =>
  request<Settings>({ credentials, signal, method: "GET", endpoint: "getSettings" });

export const setSettings = ({ credentials, settings, signal }: SetSettingsParams) =>
  request<{ saveSettings: boolean }>({ credentials, signal, method: "POST", endpoint: "setSettings", body: settings });

export const checkAccount = ({ credentials, phoneNumber, username, signal }: CheckAccountParams) =>
  request<CheckAccountResult>({
    credentials,
    signal,
    method: "POST",
    endpoint: "checkAccount",
    body: phoneNumber ? { phoneNumber: Number(phoneNumber) } : { username },
  });

export const sendMessage = ({ credentials, chatId, message, signal }: SendMessageParams) =>
  request<{ idMessage: string }>({ credentials, signal, method: "POST", endpoint: "sendMessage", body: { chatId, message } });

export const receiveNotification = ({ credentials, signal }: ApiParams) =>
  request<Notification | null>({ credentials, signal, method: "GET", endpoint: "receiveNotification?receiveTimeout=20" });

export const deleteNotification = ({ credentials, receiptId, signal }: DeleteNotificationParams) =>
  request<{ result: boolean }>({ credentials, signal, method: "DELETE", endpoint: `deleteNotification/${receiptId}` });
