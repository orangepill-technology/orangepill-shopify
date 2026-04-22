const NON_RETRYABLE_CODES = new Set([400, 401, 403, 404, 422]);
const RETRYABLE_CODES = new Set([429, 500, 502, 503, 504]);

const NON_RETRYABLE_PATTERNS = [
  'invalid credentials',
  'invalid integration',
  'amount mismatch',
  'currency mismatch',
  'hash mismatch',
  'malformed',
  'missing target',
  'unauthorized',
  'forbidden',
];

export function isRetryable(error: string, statusCode?: number): boolean {
  if (statusCode !== undefined && NON_RETRYABLE_CODES.has(statusCode)) return false;
  if (statusCode !== undefined && RETRYABLE_CODES.has(statusCode)) return true;
  const lower = error.toLowerCase();
  return !NON_RETRYABLE_PATTERNS.some((p) => lower.includes(p));
}
