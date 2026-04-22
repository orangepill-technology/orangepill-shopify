export const MAX_ATTEMPTS = 5;

// Explicit schedule (minutes) indexed by attempt count after the current failure.
// attempt 1 → 1 min, attempt 2 → 5 min, ..., attempt 5 → 360 min
const BACKOFF_MINUTES = [1, 5, 15, 60, 360];

export function computeNextRetryAt(attemptCount: number): Date {
  const idx = Math.min(attemptCount - 1, BACKOFF_MINUTES.length - 1);
  return new Date(Date.now() + BACKOFF_MINUTES[idx] * 60_000);
}

export function isExhausted(attemptCount: number): boolean {
  return attemptCount >= MAX_ATTEMPTS;
}
