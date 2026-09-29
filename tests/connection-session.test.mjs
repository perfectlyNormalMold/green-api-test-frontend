import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createServer } from "vite";

const storage = new Map();
globalThis.sessionStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};

const vite = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: "custom",
});
after(() => vite.close());
const connection = await vite.ssrLoadModule("/src/features/connect-instance/model.ts");
const transport = await vite.ssrLoadModule("/src/shared/api/green-api/request.ts");
const credentials = {
  idInstance: "fixture-id",
  apiTokenInstance: "fixture-token",
  apiUrl: "https://fixture.invalid",
};

function awaitConnection() {
  return new Promise((resolve) => {
    const unwatch = connection.$credentials.watch((value) => {
      if (!value) return;
      unwatch();
      resolve(value);
    });
  });
}

const isStateRequest = (url) =>
  (url instanceof Request ? url.url : url instanceof URL ? url.href : url).includes(
    "getStateInstance",
  );

void test("successful connection is remembered for this browser session", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url) =>
    new Response(
      JSON.stringify(
        isStateRequest(url)
          ? { stateInstance: "authorized" }
          : { webhookUrl: "", incomingWebhook: "yes" },
      ),
    );
  try {
    const connected = awaitConnection();
    connection.connectRequested(credentials);
    await connected;
    assert.deepEqual(JSON.parse(storage.get("green-api:connection")), credentials);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

void test("session restore reconnects and logout forgets credentials", async () => {
  connection.disconnectRequested();
  storage.set("green-api:connection", JSON.stringify(credentials));
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url) =>
    new Response(
      JSON.stringify(
        isStateRequest(url)
          ? { stateInstance: "authorized" }
          : { webhookUrl: "", incomingWebhook: "yes" },
      ),
    );
  try {
    const connected = awaitConnection();
    connection.sessionRestoreRequested();
    assert.deepEqual(await connected, credentials);
    connection.disconnectRequested();
    assert.equal(storage.has("green-api:connection"), false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

void test("logout releases connection UI while settings request is stuck", async () => {
  connection.$credentials.setState(credentials);
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url.includes("setSettings")) return new Promise(() => {});
    return new Response(
      JSON.stringify(
        isStateRequest(url)
          ? { stateInstance: "authorized" }
          : { webhookUrl: "", incomingWebhook: "yes" },
      ),
    );
  };
  try {
    connection.settingsFixRequested();
    assert.equal(connection.$isConnectionPending.getState(), true);
    connection.disconnectRequested();
    assert.equal(connection.$isConnectionPending.getState(), false);
    const connected = awaitConnection();
    connection.connectRequested(credentials);
    assert.deepEqual(await connected, credentials);
  } finally {
    connection.disconnectRequested();
    globalThis.fetch = previousFetch;
  }
});

void test("short API request times out instead of leaving the UI pending", async () => {
  const previousFetch = globalThis.fetch;
  let signal;
  globalThis.fetch = (_url, options) => {
    signal = options.signal;
    return new Promise((_resolve, reject) =>
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
        once: true,
      }),
    );
  };
  try {
    await assert.rejects(
      Promise.race([
        transport.request({ credentials, method: "GET", endpoint: "getSettings", timeoutMs: 10 }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Request never timed out")), 150),
        ),
      ]),
      /время ожидания/i,
    );
    assert.equal(signal.aborted, true);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

void test("logout aborts in-flight settings request", async () => {
  connection.$credentials.setState(credentials);
  const previousFetch = globalThis.fetch;
  let signal;
  globalThis.fetch = (_url, options) => {
    signal = options.signal;
    return new Promise((_resolve, reject) =>
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
        once: true,
      }),
    );
  };
  try {
    connection.settingsFixRequested();
    assert.equal(signal.aborted, false);
    connection.disconnectRequested();
    assert.equal(signal.aborted, true);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
