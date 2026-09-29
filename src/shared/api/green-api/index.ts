export { GreenApiError } from "./errors";
export {
  checkAccount,
  deleteNotification,
  getChatHistory,
  getChats,
  getContactInfo,
  getSettings,
  getStateInstance,
  lastIncomingMessages,
  lastOutgoingMessages,
  receiveNotification,
  sendMessage,
  setSettings,
} from "./methods";
export type {
  ApiParams,
  ChatHistoryItem,
  ChatSummary,
  CheckAccountResult,
  ContactInfo,
  Credentials,
  Notification,
  NotificationBody,
  Settings,
} from "./types";
