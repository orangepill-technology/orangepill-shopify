import { hmacSha256Base64, timingSafeStringEqual } from '../auth/crypto';

// Shopify signs webhooks with HMAC-SHA256 of the raw body, base64-encoded.
// Must verify against raw bytes before JSON parsing.
export function verifyShopifyWebhook(
  rawBody: Buffer,
  hmacHeader: string,
  secret: string,
): boolean {
  if (!hmacHeader) return false;
  const computed = hmacSha256Base64(rawBody, secret);
  return timingSafeStringEqual(computed, hmacHeader);
}
