import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Clock, RetryPolicy, Transport } from "../src/lib/probe.ts";
import { backoffMs, isHealthyStatus, runProbe, shouldRetry } from "../src/lib/probe.ts";

const POLICY: RetryPolicy = { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1_000 };

/** A clock that advances only when told to, so tests never actually wait. */
function fakeClock(stepMs = 50): Clock & { slept: number[] } {
  let current = 1_000;
  const slept: number[] = [];
  return {
    slept,
    now() {
      const value = current;
      current += stepMs;
      return value;
    },
    async sleep(ms: number) {
      slept.push(ms);
    },
  };
}

function transportReturning(...statuses: (number | Error)[]): Transport & { calls: number } {
  let index = 0;
  const transport = async () => {
    const next = statuses[Math.min(index, statuses.length - 1)];
    index += 1;
    transport.calls = index;
    if (next instanceof Error) throw next;
    return { status: next ?? 200 };
  };
  transport.calls = 0;
  return transport;
}

describe("shouldRetry", () => {
  it("retries while attempts remain", () => {
    assert.equal(shouldRetry(1, POLICY), true);
    assert.equal(shouldRetry(2, POLICY), true);
  });

  it("stops on the final attempt", () => {
    assert.equal(
      shouldRetry(3, POLICY),
      false,
      "maxAttempts counts the first try; `<=` here would make every policy do one extra request",
    );
  });

  it("never retries when maxAttempts is 1", () => {
    assert.equal(shouldRetry(1, { ...POLICY, maxAttempts: 1 }), false);
  });
});

describe("backoffMs", () => {
  it("doubles each attempt", () => {
    assert.equal(backoffMs(1, POLICY), 100);
    assert.equal(backoffMs(2, POLICY), 200);
    assert.equal(backoffMs(3, POLICY), 400);
  });

  it("caps at maxDelayMs", () => {
    assert.equal(backoffMs(10, POLICY), 1_000);
  });

  it("rejects an attempt below 1", () => {
    assert.throws(() => backoffMs(0, POLICY), RangeError);
  });
});

describe("isHealthyStatus", () => {
  it("accepts 2xx and 3xx", () => {
    for (const status of [200, 201, 204, 301, 302, 399]) {
      assert.equal(isHealthyStatus(status), true, `${status} should be healthy`);
    }
  });

  it("rejects 4xx and 5xx", () => {
    for (const status of [400, 401, 404, 418, 500, 503]) {
      assert.equal(isHealthyStatus(status), false, `${status} should be unhealthy`);
    }
  });

  it("treats 404 as down", () => {
    assert.equal(isHealthyStatus(404), false, "a monitored URL that 404s is not up");
  });
});

describe("runProbe", () => {
  it("succeeds on the first attempt without sleeping", async () => {
    const transport = transportReturning(200);
    const clock = fakeClock();
    const outcome = await runProbe(transport, POLICY, clock);

    assert.equal(outcome.ok, true);
    assert.equal(outcome.status, 200);
    assert.equal(outcome.attempts, 1);
    assert.equal(transport.calls, 1);
    assert.deepEqual(clock.slept, [], "a first-attempt success must not back off");
  });

  it("measures a response time", async () => {
    const outcome = await runProbe(transportReturning(200), POLICY, fakeClock(50));
    assert.equal(outcome.responseMs, 50);
  });

  it("retries a connection failure and reports the attempt count", async () => {
    const transport = transportReturning(new Error("ECONNREFUSED"), 200);
    const clock = fakeClock();
    const outcome = await runProbe(transport, POLICY, clock);

    assert.equal(outcome.ok, true);
    assert.equal(outcome.attempts, 2);
    assert.deepEqual(clock.slept, [100], "one backoff between two attempts");
  });

  it("makes exactly maxAttempts requests when everything fails", async () => {
    const transport = transportReturning(new Error("ECONNREFUSED"));
    const clock = fakeClock();
    const outcome = await runProbe(transport, POLICY, clock);

    assert.equal(outcome.ok, false);
    assert.equal(outcome.attempts, 3);
    assert.equal(transport.calls, 3, "not 4 — the final attempt must not be followed by a retry");
    assert.deepEqual(clock.slept, [100, 200], "no backoff after the last attempt");
  });

  it("reports null latency when nothing ever answered", async () => {
    const outcome = await runProbe(transportReturning(new Error("timeout")), POLICY, fakeClock());
    assert.equal(outcome.responseMs, null, "a failed connection has no latency");
    assert.equal(outcome.status, null);
    assert.equal(outcome.error, "timeout");
  });

  it("retries an unhealthy status and keeps the last one", async () => {
    const transport = transportReturning(503);
    const outcome = await runProbe(transport, POLICY, fakeClock());

    assert.equal(outcome.ok, false);
    assert.equal(outcome.status, 503, "the status is known even though the probe failed");
    assert.equal(outcome.attempts, 3);
    assert.match(outcome.error ?? "", /503/);
  });

  it("makes exactly one request when maxAttempts is 1", async () => {
    const transport = transportReturning(new Error("ECONNREFUSED"));
    const clock = fakeClock();
    const outcome = await runProbe(transport, { ...POLICY, maxAttempts: 1 }, clock);

    assert.equal(transport.calls, 1);
    assert.equal(outcome.attempts, 1);
    assert.deepEqual(clock.slept, []);
  });

  it("rejects a policy that would make no attempts", async () => {
    await assert.rejects(
      () => runProbe(transportReturning(200), { ...POLICY, maxAttempts: 0 }, fakeClock()),
      RangeError,
    );
  });

  it("recovers on the final allowed attempt", async () => {
    const transport = transportReturning(new Error("a"), new Error("b"), 200);
    const outcome = await runProbe(transport, POLICY, fakeClock());
    assert.equal(outcome.ok, true);
    assert.equal(outcome.attempts, 3);
  });
});
