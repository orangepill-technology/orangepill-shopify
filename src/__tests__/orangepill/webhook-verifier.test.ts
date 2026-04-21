import { createHmac } from 'crypto';
import { verifyOrangepillWebhook } from '../../modules/orangepill/webhook-verifier';

const SECRET = 'test-orangepill-webhook-secret';

function sign(rawBody: string, timestamp: string): string {
  const sig = createHmac('sha256', SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
  return `sha256=${sig}`;
}

describe('verifyOrangepillWebhook', () => {
  const body = Buffer.from('{"event_type":"checkout.session.completed","session_id":"sess-1"}');
  const timestamp = '1713707123';

  it('returns true for a valid signature', () => {
    const sig = sign(body.toString(), timestamp);
    expect(verifyOrangepillWebhook(body, timestamp, sig, SECRET)).toBe(true);
  });

  it('accepts signature without sha256= prefix', () => {
    const rawHex = createHmac('sha256', SECRET)
      .update(`${timestamp}.${body.toString()}`)
      .digest('hex');
    expect(verifyOrangepillWebhook(body, timestamp, rawHex, SECRET)).toBe(true);
  });

  it('returns false for tampered body', () => {
    const sig = sign(body.toString(), timestamp);
    const tampered = Buffer.from('{"event_type":"checkout.session.failed","session_id":"sess-1"}');
    expect(verifyOrangepillWebhook(tampered, timestamp, sig, SECRET)).toBe(false);
  });

  it('returns false for wrong timestamp', () => {
    const sig = sign(body.toString(), timestamp);
    expect(verifyOrangepillWebhook(body, '9999999999', sig, SECRET)).toBe(false);
  });

  it('returns false for wrong secret', () => {
    const sig = sign(body.toString(), timestamp);
    expect(verifyOrangepillWebhook(body, timestamp, sig, 'wrong-secret')).toBe(false);
  });

  it('returns false for missing timestamp', () => {
    const sig = sign(body.toString(), timestamp);
    expect(verifyOrangepillWebhook(body, '', sig, SECRET)).toBe(false);
  });

  it('returns false for missing signature', () => {
    expect(verifyOrangepillWebhook(body, timestamp, '', SECRET)).toBe(false);
  });
});
