import { GreenApiError } from "./errors";
import type { Credentials } from "./types";

type RequestOptions = {
  credentials: Credentials;
  method: "GET" | "POST" | "DELETE";
  endpoint: string;
  path?: string;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
};

function buildUrl(credentials: Credentials, endpoint: string, path?: string) {
  const baseUrl = credentials.apiUrl.replace(/\/$/, "");
  const [method, query] = endpoint.split("?", 2);
  return `${baseUrl}/waInstance${credentials.idInstance}/${method}/${credentials.apiTokenInstance}${path ? `/${encodeURIComponent(path)}` : ""}${query ? `?${query}` : ""}`;
}

function getErrorMessage(payload: unknown, status: number) {
  if (typeof payload === "object" && payload !== null) {
    const candidate = payload as { message?: unknown; description?: unknown; reason?: unknown };
    for (const value of [candidate.message, candidate.description, candidate.reason]) {
      if (typeof value === "string" && value) return value;
    }
  }
  return `GREEN-API вернул ошибку ${status}.`;
}

export async function request<Result>({
  credentials,
  method,
  endpoint,
  path,
  body,
  signal,
  timeoutMs = endpoint.startsWith("receiveNotification") ? 30_000 : 15_000,
}: RequestOptions): Promise<Result> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  if (signal?.aborted) controller.abort();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  let rejectAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(new DOMException("Aborted", "AbortError"));
  });
  controller.signal.addEventListener("abort", rejectAbort, { once: true });
  if (controller.signal.aborted) rejectAbort();
  let response: Response;
  let text: string;
  try {
    response = await Promise.race([
      fetch(buildUrl(credentials, endpoint, path), {
        method,
        signal: controller.signal,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      aborted,
    ]);
    text = await Promise.race([response.text(), aborted]);
  } catch (error) {
    if (timedOut) throw new GreenApiError("Превышено время ожидания ответа GREEN-API.");
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new GreenApiError(
      "Не удалось подключиться к GREEN-API. Проверьте интернет и повторите попытку.",
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
    controller.signal.removeEventListener("abort", rejectAbort);
  }

  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = text;
    }
  }

  if (!response.ok)
    throw new GreenApiError(getErrorMessage(payload, response.status), response.status, payload);
  if (text && typeof payload === "string")
    throw new GreenApiError("GREEN-API вернул некорректный JSON.");
  return payload as Result;
}
