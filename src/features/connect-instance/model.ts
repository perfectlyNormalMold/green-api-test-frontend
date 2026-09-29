import { createEvent, createStore, sample } from "effector";
import { reset } from "patronum";

import { createApiEffect } from "@/shared/api/create-api-effect";
import {
  getSettings,
  getStateInstance,
  setSettings,
  type Credentials,
  type Settings,
} from "@/shared/api/green-api";

export type ConnectionStatus = "idle" | "checking" | "ready" | "restarting" | "error";

type ConnectionResult = { credentials: Credentials; settings: Settings };

const defaultApiUrl = "https://4100.api.green-api.com";
const connectionStorageKey = "green-api:connection";

function restoreCredentials(): Credentials | null {
  try {
    const raw = sessionStorage.getItem(connectionStorageKey);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const candidate = value as Partial<Credentials>;
    return typeof candidate.idInstance === "string" &&
      typeof candidate.apiTokenInstance === "string" &&
      typeof candidate.apiUrl === "string"
      ? {
          idInstance: candidate.idInstance,
          apiTokenInstance: candidate.apiTokenInstance,
          apiUrl: candidate.apiUrl,
        }
      : null;
  } catch {
    return null;
  }
}

export const connectRequested = createEvent<{
  idInstance: string;
  apiTokenInstance: string;
  apiUrl?: string;
}>();
export const sessionRestoreRequested = createEvent();
const storedCredentialsFound = createEvent<Credentials | null>();
export const disconnectRequested = createEvent();
export const settingsFixRequested = createEvent();
export const $sessionVersion = createStore(0).on(
  [connectRequested, disconnectRequested],
  (version) => version + 1,
);
const connected = createEvent<ConnectionResult>();
const settingsFixed = createEvent<Settings>();
const connectionFailed = createEvent<string>();
let connectController: AbortController | null = null;
let settingsController: AbortController | null = null;
const abortRequests = () => {
  connectController?.abort();
  settingsController?.abort();
};
connectRequested.watch(abortRequests);
disconnectRequested.watch(abortRequests);

function waitForRetry(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, 2_000);
    signal.addEventListener("abort", abort, { once: true });
  });
}

const connectFx = createApiEffect<
  { credentials: Credentials; version: number },
  ConnectionResult,
  Error
>(async ({ credentials }) => {
  const controller = new AbortController();
  connectController?.abort();
  connectController = controller;
  try {
    const [{ stateInstance }, settings] = await Promise.all([
      getStateInstance({ credentials, signal: controller.signal }),
      getSettings({ credentials, signal: controller.signal }),
    ]);
    if (stateInstance !== "authorized")
      throw new Error(`Инстанс не авторизован. Текущее состояние: ${stateInstance}.`);
    return { credentials, settings };
  } finally {
    if (connectController === controller) connectController = null;
  }
});

const setSettingsFx = createApiEffect<
  { credentials: Credentials; version: number },
  Settings,
  Error
>(async ({ credentials }) => {
  const controller = new AbortController();
  settingsController?.abort();
  settingsController = controller;
  try {
    const { signal } = controller;
    const result = await setSettings({
      credentials,
      signal,
      settings: {
        webhookUrl: "",
        incomingWebhook: "yes",
        outgoingWebhook: "yes",
        outgoingAPIMessageWebhook: "yes",
      },
    });
    if (result?.saveSettings !== true)
      throw new Error("GREEN-API не сохранил настройки уведомлений.");
    for (let attempt = 0; attempt < 6; attempt++) {
      if (attempt) await waitForRetry(signal);
      const [{ stateInstance }, settings] = await Promise.all([
        getStateInstance({ credentials, signal }),
        getSettings({ credentials, signal }),
      ]);
      if (
        stateInstance === "authorized" &&
        settings.webhookUrl === "" &&
        settings.incomingWebhook === "yes" &&
        settings.outgoingWebhook === "yes" &&
        settings.outgoingAPIMessageWebhook === "yes"
      )
        return settings;
    }
    throw new Error(
      "Настройки ещё не применились. Проверьте состояние инстанса и повторите проверку позже.",
    );
  } finally {
    if (settingsController === controller) settingsController = null;
  }
});

export const $credentials = createStore<Credentials | null>(null);
export const $settings = createStore<Settings | null>(null)
  .on(connected, (_, { settings }) => settings)
  .on(settingsFixed, (_, settings) => settings)
  .reset(disconnectRequested);
export const $connectionStatus = createStore<ConnectionStatus>("idle")
  .on(connectRequested, () => "checking")
  .on(connected, () => "ready")
  .on(setSettingsFx, () => "restarting")
  .on(settingsFixed, () => "ready")
  .on(connectionFailed, () => "error")
  .reset(disconnectRequested);
export const $connectionError = createStore<string | null>(null)
  .on(connectionFailed, (_, error) => error)
  .reset(connectRequested, connected, settingsFixRequested, settingsFixed, disconnectRequested);
export const $isConnectionPending = $connectionStatus.map(
  (status) => status === "checking" || status === "restarting",
);

sample({
  source: $sessionVersion,
  clock: connectRequested,
  fn: (version, { idInstance, apiTokenInstance, apiUrl }) => ({
    version,
    credentials: {
      idInstance: idInstance.trim(),
      apiTokenInstance: apiTokenInstance.trim(),
      apiUrl: apiUrl?.trim() || defaultApiUrl,
    },
  }),
  target: connectFx,
});
sample({
  source: $sessionVersion,
  clock: connectFx.done,
  filter: (version, { params }) => version === params.version,
  fn: (_, { result }) => result,
  target: connected,
});
sample({ clock: connected, fn: ({ credentials }) => credentials, target: $credentials });
sample({
  source: $sessionVersion,
  clock: connectFx.fail,
  filter: (version, { params }) => version === params.version,
  fn: (_, { error }) => error.message,
  target: connectionFailed,
});
sample({ clock: sessionRestoreRequested, fn: restoreCredentials, target: storedCredentialsFound });
sample({
  source: $isConnectionPending,
  clock: storedCredentialsFound,
  filter: (isPending, credentials) => !isPending && credentials !== null,
  fn: (_, credentials) => credentials!,
  target: connectRequested,
});
connected.watch(({ credentials }) => {
  try {
    sessionStorage.setItem(connectionStorageKey, JSON.stringify(credentials));
  } catch {
    // Storage may be disabled; the active connection still works.
  }
});
disconnectRequested.watch(() => {
  try {
    sessionStorage.removeItem(connectionStorageKey);
  } catch {
    // Logout must still work when browser storage is unavailable.
  }
});
sample({
  source: { credentials: $credentials, version: $sessionVersion, pending: $isConnectionPending },
  clock: settingsFixRequested,
  filter: ({ credentials, pending }) => credentials !== null && !pending,
  fn: ({ credentials, version }) => ({ credentials: credentials as Credentials, version }),
  target: setSettingsFx,
});
sample({
  source: $sessionVersion,
  clock: setSettingsFx.done,
  filter: (version, { params }) => version === params.version,
  fn: (_, { result }) => result,
  target: settingsFixed,
});
sample({
  source: $sessionVersion,
  clock: setSettingsFx.fail,
  filter: (version, { params }) => version === params.version,
  fn: (_, { error }) => error.message,
  target: connectionFailed,
});

reset({ clock: disconnectRequested, target: [$credentials] });
