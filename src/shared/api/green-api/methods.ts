import { request } from "./request";
import type {
  ApiParams,
  ChatHistoryItem,
  ChatSummary,
  CheckAccountResult,
  ContactInfo,
  Notification,
  Settings,
} from "./types";

type CheckAccountParams = ApiParams & { phoneNumber?: string; username?: string };
type SendMessageParams = ApiParams & { chatId: string; message: string };
type DeleteNotificationParams = ApiParams & { receiptId: number };
type SetSettingsParams = ApiParams & { settings: Settings };
type GetChatHistoryParams = ApiParams & { chatId: string; count?: number };
type GetContactInfoParams = ApiParams & { chatId: string };
type LastMessagesParams = ApiParams & { minutes?: number };

export const getStateInstance = ({ credentials, signal }: ApiParams) =>
  request<{ stateInstance: string }>({
    credentials,
    signal,
    method: "GET",
    endpoint: "getStateInstance",
  });

export const getSettings = ({ credentials, signal }: ApiParams) =>
  request<Settings>({ credentials, signal, method: "GET", endpoint: "getSettings" });

export const setSettings = ({ credentials, settings, signal }: SetSettingsParams) =>
  request<{ saveSettings: boolean }>({
    credentials,
    signal,
    method: "POST",
    endpoint: "setSettings",
    body: settings,
  });

export const checkAccount = ({ credentials, phoneNumber, username, signal }: CheckAccountParams) =>
  request<CheckAccountResult>({
    credentials,
    signal,
    method: "POST",
    endpoint: "checkAccount",
    body: phoneNumber ? { phoneNumber: Number(phoneNumber) } : { username },
  });

export const getChats = ({ credentials, signal }: ApiParams) =>
  request<ChatSummary[]>({ credentials, signal, method: "GET", endpoint: "getChats" });

export const getContactInfo = ({ credentials, chatId, signal }: GetContactInfoParams) =>
  request<ContactInfo>({
    credentials,
    signal,
    method: "POST",
    endpoint: "getContactInfo",
    body: { chatId },
  });

export const getChatHistory = ({
  credentials,
  chatId,
  count = 100,
  signal,
}: GetChatHistoryParams) =>
  request<ChatHistoryItem[]>({
    credentials,
    signal,
    method: "POST",
    endpoint: "getChatHistory",
    body: { chatId, count },
  });

export const lastIncomingMessages = ({
  credentials,
  minutes = 43_200,
  signal,
}: LastMessagesParams) =>
  request<ChatHistoryItem[]>({
    credentials,
    signal,
    method: "GET",
    endpoint: `lastIncomingMessages?minutes=${minutes}`,
  });

export const lastOutgoingMessages = ({
  credentials,
  minutes = 43_200,
  signal,
}: LastMessagesParams) =>
  request<ChatHistoryItem[]>({
    credentials,
    signal,
    method: "GET",
    endpoint: `lastOutgoingMessages?minutes=${minutes}`,
  });

export const sendMessage = ({ credentials, chatId, message, signal }: SendMessageParams) =>
  request<{ idMessage: string }>({
    credentials,
    signal,
    method: "POST",
    endpoint: "sendMessage",
    body: { chatId, message },
  });

export const receiveNotification = ({ credentials, signal }: ApiParams) =>
  request<Notification | null>({
    credentials,
    signal,
    method: "GET",
    endpoint: "receiveNotification?receiveTimeout=20",
  });

export const deleteNotification = ({ credentials, receiptId, signal }: DeleteNotificationParams) =>
  request<{ result: boolean }>({
    credentials,
    signal,
    method: "DELETE",
    endpoint: "deleteNotification",
    path: String(receiptId),
  });
