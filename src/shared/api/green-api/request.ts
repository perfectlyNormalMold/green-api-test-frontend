import { GreenApiError } from "./errors";
import type { Credentials } from "./types";

type RequestOptions = {
  credentials: Credentials;
  method: "GET" | "POST" | "DELETE";
  endpoint: string;
  body?: unknown;
  signal?: AbortSignal;
};

function buildUrl(credentials: Credentials, endpoint: string) {
  const baseUrl = credentials.apiUrl.replace(/\/$/, "");
  const [method, query] = endpoint.split("?", 2);
  return `${baseUrl}/waInstance${credentials.idInstance}/${method}/${credentials.apiTokenInstance}${query ? `?${query}` : ""}`;
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

export async function request<Result>({ credentials, method, endpoint, body, signal }: RequestOptions): Promise<Result> {
  let response: Response;

  try {
    response = await fetch(buildUrl(credentials, endpoint), {
      method,
      signal,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new GreenApiError("Не удалось подключиться к GREEN-API. Проверьте интернет и повторите попытку.");
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = text;
    }
  }

  if (!response.ok) throw new GreenApiError(getErrorMessage(payload, response.status), response.status, payload);
  return payload as Result;
}
