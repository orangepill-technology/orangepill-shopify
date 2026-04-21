import Fastify from 'fastify';
import { createHmac, createHash } from 'crypto';

jest.mock('../../modules/db/client', () => ({
  prisma: {
    shopifyOrderPayment: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    orangepillWebhookEvent: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    shop: { findUnique: jest.fn() },
  },
}));

jest.mock('../../modules/shopify/transactions', () => ({
  markOrderPaid: jest.fn().mockResolvedValue({ transactionId: 'txn-123' }),
}));

import { orangepillWebhookRoutes } from '../../modules/orangepill/webhook-routes';
import { prisma } from '../../modules/db/client';
import { markOrderPaid } from '../../modules/shopify/transactions';

const OP_SECRET = process.env.ORANGEPILL_WEBHOOK_SECRET!;

function makeRequest(body: object, eventType = 'checkout.session.completed', eventId = 'evt-uid') {
  const bodyStr = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const sig = `sha256=${createHmac('sha256', OP_SECRET).update(`${timestamp}.${bodyStr}`).digest('hex')}`;
  return {
    method: 'POST' as const,
    url: '/webhooks/orangepill',
    payload: bodyStr,
    headers: {
      'content-type': 'application/json',
      'x-orangepill-signature': sig,
      'x-orangepill-timestamp': timestamp,
      'x-orangepill-event-id': eventId,
      'x-orangepill-delivery-id': 'del-uid',
      'x-orangepill-event': eventType,
    },
  };
}

const mockCreateEvent = prisma.orangepillWebhookEvent.create as jest.Mock;
const mockFindEvent = prisma.orangepillWebhookEvent.findUnique as jest.Mock;
const mockFindPayment = prisma.shopifyOrderPayment.findUnique as jest.Mock;
const mockUpdatePayment = prisma.shopifyOrderPayment.update as jest.Mock;
const mockUpdateManyPayments = prisma.shopifyOrderPayment.updateMany as jest.Mock;
const mockMarkOrderPaid = markOrderPaid as jest.Mock;

const PENDING_PAYMENT = {
  id: 'pay-id',
  shopId: 'shop-id',
  shopifyOrderId: '123',
  amount: '75.00',
  currency: 'COP',
  status: 'pending',
  shopifyTransactionId: null,
  shop: { shopDomain: 'store.myshopify.com' },
};

describe('POST /webhooks/orangepill', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(orangepillWebhookRoutes);
    await app.ready();
    jest.clearAllMocks();
    mockCreateEvent.mockResolvedValue({});
    mockMarkOrderPaid.mockResolvedValue({ transactionId: 'txn-123' });
  });

  afterEach(() => app.close());

  // ── Signature verification ─────────────────────────────────────────────────

  it('returns 401 for invalid signature', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/orangepill',
      payload: '{}',
      headers: {
        'content-type': 'application/json',
        'x-orangepill-signature': 'sha256=badsig',
        'x-orangepill-timestamp': '1000000000',
        'x-orangepill-event-id': 'evt-1',
        'x-orangepill-delivery-id': 'del-1',
      },
    });
    expect(res.statusCode).toBe(401);
  });

  // ── Fix 2: payload hash deduplication ─────────────────────────────────────

  it('returns 200 without calling handler on true duplicate (same eventId + same hash)', async () => {
    mockCreateEvent.mockRejectedValue({ code: 'P2002' });
    const body = JSON.stringify({ event_type: 'checkout.session.completed', session_id: 'sess-1', merchant_id: 'm', tenant_id: 't' });
    mockFindEvent.mockResolvedValue({
      eventId: 'evt-uid',
      payloadHash: createHash('sha256').update(body).digest('hex'),
    });

    const res = await app.inject(makeRequest(JSON.parse(body)));
    expect(res.statusCode).toBe(200);
    expect(mockFindPayment).not.toHaveBeenCalled();
  });

  it('logs anomaly and skips handler on hash mismatch (same eventId, different body)', async () => {
    mockCreateEvent.mockRejectedValue({ code: 'P2002' });
    mockFindEvent.mockResolvedValue({
      eventId: 'evt-uid',
      payloadHash: 'completely-different-hash',
    });

    const res = await app.inject(makeRequest({ event_type: 'checkout.session.completed', session_id: 'sess-x', merchant_id: 'm', tenant_id: 't' }));
    expect(res.statusCode).toBe(200);
    expect(mockFindPayment).not.toHaveBeenCalled();
  });

  // ── Fix 3: shopifyTransactionId idempotency ────────────────────────────────

  it('skips Shopify call if shopifyTransactionId is already set', async () => {
    mockFindPayment.mockResolvedValue({ ...PENDING_PAYMENT, status: 'paid', shopifyTransactionId: 'existing-txn' });

    const body = { event_type: 'checkout.session.completed', session_id: 'sess-1', merchant_id: 'm', tenant_id: 't' };
    await app.inject(makeRequest(body));
    await new Promise((r) => setImmediate(r));

    expect(mockMarkOrderPaid).not.toHaveBeenCalled();
  });

  // ── Fix 4: amount validation ───────────────────────────────────────────────

  it('aborts and does not mark paid when webhook amount mismatches stored amount', async () => {
    mockFindPayment.mockResolvedValue(PENDING_PAYMENT);
    mockUpdateManyPayments.mockResolvedValue({ count: 1 });

    const body = {
      event_type: 'checkout.session.completed',
      session_id: 'sess-1',
      merchant_id: 'm',
      tenant_id: 't',
      data: { amount: '999.99' }, // stored is 75.00
    };

    await app.inject(makeRequest(body));
    await new Promise((r) => setImmediate(r));
    expect(mockMarkOrderPaid).not.toHaveBeenCalled();
  });

  // ── Fix 5: currency validation ─────────────────────────────────────────────

  it('aborts and does not mark paid when webhook currency mismatches stored currency', async () => {
    mockFindPayment.mockResolvedValue(PENDING_PAYMENT);
    mockUpdateManyPayments.mockResolvedValue({ count: 1 });

    const body = {
      event_type: 'checkout.session.completed',
      session_id: 'sess-1',
      merchant_id: 'm',
      tenant_id: 't',
      data: { currency: 'USD' }, // stored is COP
    };

    await app.inject(makeRequest(body));
    await new Promise((r) => setImmediate(r));
    expect(mockMarkOrderPaid).not.toHaveBeenCalled();
  });

  // ── Fix 6: concurrency — atomic claim via 'processing' ────────────────────

  it('does not call Shopify when the atomic claim returns 0 rows (concurrent worker won)', async () => {
    mockFindPayment.mockResolvedValue(PENDING_PAYMENT);
    mockUpdateManyPayments.mockResolvedValue({ count: 0 }); // someone else claimed it

    const body = { event_type: 'checkout.session.completed', session_id: 'sess-1', merchant_id: 'm', tenant_id: 't' };
    await app.inject(makeRequest(body));
    await new Promise((r) => setImmediate(r));
    expect(mockMarkOrderPaid).not.toHaveBeenCalled();
  });

  it('releases the processing lock (resets to pending) when Shopify API fails', async () => {
    mockFindPayment.mockResolvedValue(PENDING_PAYMENT);
    mockUpdateManyPayments.mockResolvedValue({ count: 1 });
    mockMarkOrderPaid.mockRejectedValue(new Error('Shopify 503'));
    mockUpdatePayment.mockResolvedValue({});

    const body = { event_type: 'checkout.session.completed', session_id: 'sess-1', merchant_id: 'm', tenant_id: 't' };
    await app.inject(makeRequest(body));
    await new Promise((r) => setImmediate(r));

    expect(mockUpdatePayment).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'pending' } }),
    );
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('marks order paid and stores transactionId on success', async () => {
    mockFindPayment.mockResolvedValue(PENDING_PAYMENT);
    mockUpdateManyPayments.mockResolvedValue({ count: 1 });
    mockUpdatePayment.mockResolvedValue({});

    const body = {
      event_type: 'checkout.session.completed',
      session_id: 'sess-1',
      merchant_id: 'm',
      tenant_id: 't',
      data: { payment_id: 'op-pay-id', amount: '75.00', currency: 'COP' },
    };

    const res = await app.inject(makeRequest(body));
    expect(res.statusCode).toBe(200);
    await new Promise((r) => setImmediate(r));

    expect(mockMarkOrderPaid).toHaveBeenCalledWith('store.myshopify.com', '123', '75.00', 'COP');
    expect(mockUpdatePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'paid',
          shopifyTransactionId: 'txn-123',
          orangepillPaymentId: 'op-pay-id',
        }),
      }),
    );
  });

  // ── Failed / expired ───────────────────────────────────────────────────────

  it('marks payment failed on checkout.session.failed', async () => {
    mockUpdateManyPayments.mockResolvedValue({ count: 1 });
    const body = { event_type: 'checkout.session.failed', session_id: 'sess-2', merchant_id: 'm', tenant_id: 't' };
    await app.inject(makeRequest(body, 'checkout.session.failed'));
    await new Promise((r) => setImmediate(r));
    expect(mockUpdateManyPayments).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'failed' } }));
  });

  it('marks payment expired on checkout.session.expired', async () => {
    mockUpdateManyPayments.mockResolvedValue({ count: 1 });
    const body = { event_type: 'checkout.session.expired', session_id: 'sess-3', merchant_id: 'm', tenant_id: 't' };
    await app.inject(makeRequest(body, 'checkout.session.expired'));
    await new Promise((r) => setImmediate(r));
    expect(mockUpdateManyPayments).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'expired' } }));
  });
});
