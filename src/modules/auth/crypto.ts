import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { config } from '../../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LEN = 12;

// Derive a consistent 32-byte key from the configured secret
const KEY = createHash('sha256').update(config.ENCRYPTION_KEY).digest();

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${enc.toString('hex')}:${tag.toString('hex')}`;
}

export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid ciphertext format');
  const [ivHex, encHex, tagHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

export function hmacSha256Hex(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

export function hmacSha256Base64(data: Buffer | string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64');
}

// Timing-safe comparison that handles different-length inputs safely.
// For HMAC verification both sides produce fixed-length output, so length
// mismatch is itself a valid "not equal" signal (no oracle leaked).
export function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.byteLength !== bufB.byteLength) return false;
  return timingSafeEqual(bufA, bufB);
}
