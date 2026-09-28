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
  senderData?: { chatId?: string; senderName?: string; senderContactName?: string };
  messageData?: { typeMessage?: string; textMessageData?: { textMessage?: string } };
  idMessageData?: { idMessage?: string; timestamp?: number; status?: string; sendByApi?: boolean };
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

export type ApiParams = {
  credentials: Credentials;
  signal?: AbortSignal;
};
