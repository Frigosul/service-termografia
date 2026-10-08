import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { AxiosError, type AxiosAdapter } from "axios";
import { httpInstance, MAX_RETRIES, REQUEST_TIMEOUT_MS, RETRY_DELAY_MS } from "./instance";

async function flushUntilSettled(promise: Promise<unknown>) {
  let settled = false;
  promise.then(() => (settled = true), () => (settled = true));
  for (let i = 0; i < 100 && !settled; i++) {
    await new Promise((resolve) => setImmediate(resolve));
    mock.timers.tick(RETRY_DELAY_MS);
  }
  return settled;
}

test("requests have a finite timeout", () => {
  assert.ok(REQUEST_TIMEOUT_MS > 0);
  assert.equal(httpInstance.defaults.timeout, REQUEST_TIMEOUT_MS);
});

test("network errors are retried a bounded number of times, then rejected", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  const adapter: AxiosAdapter = async (config) => {
    calls++;
    throw new AxiosError("timeout", "ECONNABORTED", config);
  };

  try {
    const request = httpInstance.get("instruments", { adapter });
    const settled = await flushUntilSettled(request);

    assert.equal(settled, true);
    await assert.rejects(request);
    assert.equal(calls, 1 + MAX_RETRIES);
  } finally {
    mock.timers.reset();
  }
});

test("a retry that succeeds resolves the request", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  const adapter: AxiosAdapter = async (config) => {
    calls++;
    if (calls < 3) throw new AxiosError("timeout", "ECONNABORTED", config);
    return { data: { ok: true }, status: 200, statusText: "OK", headers: {}, config };
  };

  try {
    const request = httpInstance.get("instruments", { adapter });
    await flushUntilSettled(request);

    assert.deepEqual((await request).data, { ok: true });
    assert.equal(calls, 3);
  } finally {
    mock.timers.reset();
  }
});

test("HTTP 400 is mapped to an instrument without communication", async () => {
  const adapter: AxiosAdapter = async (config) => {
    throw new AxiosError("bad request", "ERR_BAD_REQUEST", config, null, {
      data: {}, status: 400, statusText: "Bad Request", headers: {}, config,
    });
  };

  const response = await httpInstance.get("instruments/38/values", { adapter });

  assert.deepEqual(response.data, {
    id: "38",
    error: "Instrument without communication at moment",
  });
});
