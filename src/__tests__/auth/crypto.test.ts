import { encrypt, decrypt, hmacSha256Hex, hmacSha256Base64, timingSafeStringEqual } from '../../modules/auth/crypto';
import { createHmac } from 'crypto';

describe('encrypt / decrypt', () => {
  it('round-trips plaintext', () => {
    const plaintext = 'shpat_abc123secrettoken';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it('produces different ciphertext each call (random IV)', () => {
    const plaintext = 'same-plaintext';
    expect(encrypt(plaintext)).not.toBe(encrypt(plaintext));
  });

  it('throws on tampered ciphertext', () => {
    const ct = encrypt('hello');
    const parts = ct.split(':');
    // Flip the last byte of the auth tag (valid hex, wrong value)
    const lastByte = parts[2].slice(-2);
    const flipped = lastByte === 'ff' ? '00' : 'ff';
    parts[2] = parts[2].slice(0, -2) + flipped;
    expect(() => decrypt(parts.join(':'))).toThrow();
  });
});

describe('hmacSha256Hex', () => {
  it('produces expected hex digest', () => {
    const expected = createHmac('sha256', 'secret').update('message').digest('hex');
    expect(hmacSha256Hex('message', 'secret')).toBe(expected);
  });
});

describe('hmacSha256Base64', () => {
  it('produces expected base64 digest', () => {
    const body = Buffer.from('{"id":1}');
    const expected = createHmac('sha256', 'secret').update(body).digest('base64');
    expect(hmacSha256Base64(body, 'secret')).toBe(expected);
  });
});

describe('timingSafeStringEqual', () => {
  it('returns true for equal strings', () => {
    expect(timingSafeStringEqual('abc', 'abc')).toBe(true);
  });

  it('returns false for different strings of same length', () => {
    expect(timingSafeStringEqual('abc', 'xyz')).toBe(false);
  });

  it('returns false for different lengths', () => {
    expect(timingSafeStringEqual('abc', 'abcd')).toBe(false);
  });
});
