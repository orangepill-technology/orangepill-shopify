import { createHmac } from 'crypto';
import { verifyShopifyWebhook } from '../../modules/webhooks/verifier';

const SECRET = 'test-webhook-secret';

function sign(body: Buffer): string {
  return createHmac('sha256', SECRET).update(body).digest('base64');
}

describe('verifyShopifyWebhook', () => {
  it('returns true for a valid signature', () => {
    const body = Buffer.from('{"id":1,"total_price":"99.99"}');
    expect(verifyShopifyWebhook(body, sign(body), SECRET)).toBe(true);
  });

  it('returns false when body is tampered', () => {
    const body = Buffer.from('{"id":1}');
    const hmac = sign(body);
    const tampered = Buffer.from('{"id":2}');
    expect(verifyShopifyWebhook(tampered, hmac, SECRET)).toBe(false);
  });

  it('returns false for wrong secret', () => {
    const body = Buffer.from('{"id":1}');
    const hmac = createHmac('sha256', 'wrong-secret').update(body).digest('base64');
    expect(verifyShopifyWebhook(body, hmac, SECRET)).toBe(false);
  });

  it('returns false for empty hmac header', () => {
    const body = Buffer.from('{"id":1}');
    expect(verifyShopifyWebhook(body, '', SECRET)).toBe(false);
  });

  it('returns false for corrupted base64 hmac', () => {
    const body = Buffer.from('{"id":1}');
    expect(verifyShopifyWebhook(body, 'not-valid-base64!!!', SECRET)).toBe(false);
  });
});
