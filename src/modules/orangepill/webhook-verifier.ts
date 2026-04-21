import { createHmac } from 'crypto';
import { timingSafeStringEqual } from '../auth/crypto';

// Orangepill signs webhooks with HMAC-SHA256 of `{timestamp}.{rawBody}` in hex,
// prefixed with `sha256=`. Timestamp is Unix seconds.
export function verifyOrangepillWebhook(
  rawBody: Buffer,
  timestampHeader: string,
  signatureHeader: string,
  secret: string,
): boolean {
  if (!timestampHeader || !signatureHeader) return false;

  const sig = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice(7)
    : signatureHeader;

  const sigPayload = `${timestampHeader}.${rawBody.toString('utf8')}`;
  const computed = createHmac('sha256', secret).update(sigPayload).digest('hex');

  return timingSafeStringEqual(computed, sig);
}
