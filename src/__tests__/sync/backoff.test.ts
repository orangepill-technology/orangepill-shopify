import { computeNextRetryAt, isExhausted, MAX_ATTEMPTS } from '../../modules/sync/backoff';

describe('computeNextRetryAt', () => {
  it('attempt 1 → +1 min', () => {
    const before = Date.now();
    const next = computeNextRetryAt(1);
    const diff = next.getTime() - before;
    expect(diff).toBeGreaterThanOrEqual(59_900);
    expect(diff).toBeLessThanOrEqual(60_500);
  });

  it('attempt 2 → +5 min', () => {
    const before = Date.now();
    const next = computeNextRetryAt(2);
    const diff = next.getTime() - before;
    expect(diff).toBeGreaterThanOrEqual(5 * 60_000 - 100);
    expect(diff).toBeLessThanOrEqual(5 * 60_000 + 500);
  });

  it('attempt 3 → +15 min', () => {
    const before = Date.now();
    expect(computeNextRetryAt(3).getTime() - before).toBeGreaterThanOrEqual(15 * 60_000 - 100);
  });

  it('attempt 4 → +60 min', () => {
    const before = Date.now();
    expect(computeNextRetryAt(4).getTime() - before).toBeGreaterThanOrEqual(60 * 60_000 - 100);
  });

  it('attempt 5 → +360 min', () => {
    const before = Date.now();
    expect(computeNextRetryAt(5).getTime() - before).toBeGreaterThanOrEqual(360 * 60_000 - 100);
  });

  it('clamps at max backoff for attempt > 5', () => {
    const a5 = computeNextRetryAt(5).getTime();
    const a9 = computeNextRetryAt(9).getTime();
    expect(Math.abs(a5 - a9)).toBeLessThan(200);
  });
});

describe('isExhausted', () => {
  it('returns false below MAX_ATTEMPTS', () => {
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      expect(isExhausted(i)).toBe(false);
    }
  });

  it('returns true at MAX_ATTEMPTS', () => {
    expect(isExhausted(MAX_ATTEMPTS)).toBe(true);
  });

  it('returns true above MAX_ATTEMPTS', () => {
    expect(isExhausted(MAX_ATTEMPTS + 3)).toBe(true);
  });
});
