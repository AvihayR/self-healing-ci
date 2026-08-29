/**
 * Probe execution and its retry policy.
 *
 * Everything here takes its clock and its transport as arguments. That is not
 * ceremony: it is what lets the retry tests run in microseconds and without a
 * network, and it means the one genuinely flaky thing in this project later on
 * will be flaky because we made it so, not by accident.
 */

export interface RetryPolicy {
  /** Total attempts, including the first. `1` means no retry. */
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_RETRY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 200,
  maxDelayMs: 2_000,
};

export interface ProbeOutcome {
  ok: boolean;
  status: number | null;
  responseMs: number | null;
  /** How many attempts were actually made, 1-based. */
  attempts: number;
  error?: string;
}

/** One transport attempt. Resolves with a status, or rejects if nothing answered. */
export type Transport = () => Promise<{ status: number }>;

export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * Should another attempt be made after `attempt` has failed?
 *
 * `attempt` is 1-based, and `maxAttempts` counts the first try. So with
 * maxAttempts = 3: after attempt 1 retry, after attempt 2 retry, after
 * attempt 3 stop. The comparison is `<` and it is load-bearing — `<=` here
 * would silently make every policy do one more request than it advertises.
 */
export function shouldRetry(attempt: number, policy: RetryPolicy): boolean {
  return attempt < policy.maxAttempts;
}

/**
 * Delay before the attempt following `attempt`. Exponential, capped.
 *
 * Deliberately free of jitter. Real systems want jitter; this one wants a
 * backoff schedule a test can assert exactly.
 */
export function backoffMs(attempt: number, policy: RetryPolicy): number {
  if (attempt < 1) throw new RangeError(`attempt must be >= 1, got ${attempt}`);
  const raw = policy.baseDelayMs * 2 ** (attempt - 1);
  return Math.min(raw, policy.maxDelayMs);
}

/** A 2xx or 3xx is up. Everything else, including 4xx, is down. */
export function isHealthyStatus(status: number): boolean {
  return status >= 200 && status < 400;
}

export async function runProbe(
  transport: Transport,
  policy: RetryPolicy = DEFAULT_RETRY,
  clock: Clock = systemClock,
): Promise<ProbeOutcome> {
  if (!Number.isInteger(policy.maxAttempts) || policy.maxAttempts < 1) {
    throw new RangeError(`maxAttempts must be a positive integer, got ${policy.maxAttempts}`);
  }

  let lastError = "no attempt was made";

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    const startedAt = clock.now();
    try {
      const { status } = await transport();
      const responseMs = clock.now() - startedAt;
      if (isHealthyStatus(status)) {
        return { ok: true, status, responseMs, attempts: attempt };
      }
      lastError = `unhealthy status ${status}`;
      if (!shouldRetry(attempt, policy)) {
        return { ok: false, status, responseMs, attempts: attempt, error: lastError };
      }
    } catch (cause) {
      lastError = cause instanceof Error ? cause.message : String(cause);
      if (!shouldRetry(attempt, policy)) {
        return { ok: false, status: null, responseMs: null, attempts: attempt, error: lastError };
      }
    }
    await clock.sleep(backoffMs(attempt, policy));
  }

  /* c8 ignore next -- the loop always returns; this satisfies the type checker. */
  return { ok: false, status: null, responseMs: null, attempts: policy.maxAttempts, error: lastError };
}
