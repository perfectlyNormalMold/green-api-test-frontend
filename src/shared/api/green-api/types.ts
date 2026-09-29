export type Credentials = {
  idInstance: string;
  apiTokenInstance: string;
  apiUrl: string;
};

export type InstanceState = string;

export type Settings = {
  webhookUrl?: string;
  incomingWebhook?: "yes" | "no";
  outgoingWebhook?: "yes" | "no";
  outgoingAPIMessageWebhook?: "yes" | "no";
  outgoingMessageWebhook?: "yes" | "no";
  stateWebhook?: "yes" | "no";
};

export type Notification = {
  receiptId: number;
  body: NotificationBody;
};

export type NotificationBody = {
  typeWebhook?: string;
  timestamp?: number;
  idMessage?: string;
  chatId?: string;
  status?: string;
  senderData?: { chatId?: string; senderName?: string; senderContactName?: string };
  messageData?: { typeMessage?: string; textMessageData?: { textMessage?: string } };

  instanceData?: { stateInstance?: InstanceState };
};

export type CheckAccountResult = {
  exist?: boolean;
  chatId?: string;
  username?: string;
  phoneNumber?: number;
  fromCache?: boolean;
  status?: false;
  reason?: string;
  data?: { reason?: string; retryAfter?: number };
};

export type ChatSummary = {
  chatId: string;
  name: string;
  type: string;
  phoneNumber: number;
  username: string;
};

export type ContactInfo = {
  chatId?: string;
  avatar?: string;
  name?: string;
  contactName?: string;
  username?: string;
};

export type ChatHistoryItem = {
  type: "incoming" | "outgoing";
  idMessage: string;
  timestamp: number;
  statusMessage?: string;
  typeMessage: string;
  chatId: string;
  senderName?: string;
  senderContactName?: string;
  textMessage?: string;
};

export type ApiParams = {
  credentials: Credentials;
  signal?: AbortSignal;
};
