import { createApiEffect } from "@/shared/api/create-api-effect";
import { getSettings, getStateInstance, setSettings, type Credentials, type Settings } from "@/shared/api/green-api";
import { createEvent, createStore, sample } from "effector";
import { pending, reset } from "patronum";

export type ConnectionStatus = "idle" | "checking" | "ready" | "restarting" | "error";

type ConnectionResult = { credentials: Credentials; settings: Settings };

const defaultApiUrl = "https://4100.api.green-api.com";

export const connectRequested = createEvent<{ idInstance: string; apiTokenInstance: string; apiUrl?: string }>();
export const disconnectRequested = createEvent();
export const settingsFixRequested = createEvent();

const connectFx = createApiEffect<{ credentials: Credentials }, ConnectionResult, Error>(async ({ credentials }) => {
  const [{ stateInstance }, settings] = await Promise.all([getStateInstance({ credentials }), getSettings({ credentials })]);
  if (stateInstance !== "authorized") throw new Error(`Инстанс не авторизован. Текущее состояние: ${stateInstance}.`);
  return { credentials, settings };
});

const setSettingsFx = createApiEffect<{ credentials: Credentials }, void, Error>(async ({ credentials }) => {
  await setSettings({
    credentials,
    settings: { webhookUrl: "", incomingWebhook: "yes", outgoingWebhook: "yes", outgoingAPIMessageWebhook: "yes", stateWebhook: "yes" },
  });
});

export const $credentials = createStore<Credentials | null>(null);
export const $settings = createStore<Settings | null>(null)
  .on(connectFx.doneData, (_, { settings }) => settings)
  .reset(disconnectRequested);
export const $connectionStatus = createStore<ConnectionStatus>("idle")
  .on(connectRequested, () => "checking")
  .on(connectFx.done, () => "ready")
  .on(settingsFixRequested, () => "restarting")
  .on(setSettingsFx.done, () => "checking")
  .on([connectFx.fail, setSettingsFx.fail], () => "error")
  .reset(disconnectRequested);
export const $connectionError = createStore<string | null>(null)
  .on([connectFx.failData, setSettingsFx.failData], (_, error) => error.message)
  .reset(connectRequested, connectFx.done, settingsFixRequested, disconnectRequested);
export const $isConnectionPending = pending({ effects: [connectFx, setSettingsFx] });

sample({
  clock: connectRequested,
  fn: ({ idInstance, apiTokenInstance, apiUrl }) => ({ credentials: { idInstance: idInstance.trim(), apiTokenInstance: apiTokenInstance.trim(), apiUrl: apiUrl?.trim() || defaultApiUrl } }),
  target: connectFx,
});
sample({ clock: connectFx.doneData, fn: ({ credentials }) => credentials, target: $credentials });
sample({ source: $credentials, clock: settingsFixRequested, filter: (credentials) => credentials !== null, fn: (credentials) => ({ credentials: credentials as Credentials }), target: setSettingsFx });

reset({ clock: disconnectRequested, target: [$credentials] });
