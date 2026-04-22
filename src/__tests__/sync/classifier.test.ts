import { isRetryable } from '../../modules/sync/classifier';

describe('isRetryable — status code rules', () => {
  it('5xx codes are retryable', () => {
    expect(isRetryable('Internal Server Error', 500)).toBe(true);
    expect(isRetryable('Bad Gateway', 502)).toBe(true);
    expect(isRetryable('Service Unavailable', 503)).toBe(true);
    expect(isRetryable('Gateway Timeout', 504)).toBe(true);
  });

  it('429 rate-limit is retryable', () => {
    expect(isRetryable('Too Many Requests', 429)).toBe(true);
  });

  it('401 / 403 are non-retryable', () => {
    expect(isRetryable('Unauthorized', 401)).toBe(false);
    expect(isRetryable('Forbidden', 403)).toBe(false);
  });

  it('400 / 404 / 422 are non-retryable', () => {
    expect(isRetryable('Bad Request', 400)).toBe(false);
    expect(isRetryable('Not Found', 404)).toBe(false);
    expect(isRetryable('Unprocessable Entity', 422)).toBe(false);
  });
});

describe('isRetryable — message pattern rules', () => {
  it('network timeout (no status) is retryable', () => {
    expect(isRetryable('ETIMEDOUT')).toBe(true);
    expect(isRetryable('connect ECONNRESET')).toBe(true);
  });

  it('invalid credentials message is non-retryable', () => {
    expect(isRetryable('invalid credentials provided')).toBe(false);
  });

  it('invalid integration message is non-retryable', () => {
    expect(isRetryable('invalid integration id')).toBe(false);
  });

  it('amount mismatch is non-retryable', () => {
    expect(isRetryable('amount mismatch detected')).toBe(false);
  });

  it('currency mismatch is non-retryable', () => {
    expect(isRetryable('currency mismatch')).toBe(false);
  });

  it('hash mismatch is non-retryable', () => {
    expect(isRetryable('hash mismatch anomaly')).toBe(false);
  });

  it('generic upstream error (no status) is retryable', () => {
    expect(isRetryable('upstream connection refused')).toBe(true);
  });
});
