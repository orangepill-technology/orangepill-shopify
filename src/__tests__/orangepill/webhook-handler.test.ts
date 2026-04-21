import Fastify from 'fastify';
import { createHmac } from 'crypto';

jest.mock('../../modules/db/client', () => ({
  prisma: {
    shopifyOrderPayment: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    orangepillWebhookEvent: {
      create: jest.fn(),
    },
    shop: { findUnique: jest.fn() },
  },
}));

jest.mock('../../modules/shopify/transactions', () => ({
  markOrderPaid: jest.fn().mockResolvedValue(undefined),
}));

import { orangepillWebhookRoutes } from '../../modules/orangepill/webhook-routes';
import { prisma } from '../../modules/db/client';
import { markOrderPaid } from '../../modules/shopify/transactions';

const OP_SECRET = process.env.ORANGEPILL_WEBHOOK_SECRET!;

function signedRequest(body: object, eventType = 'checkout.session.completed') {
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
      'x-orangepill-event-id': 'evt-unique-id',
      'x-orangepill-delivery-id': 'del-unique-id',
      'x-orangepill-event': eventType,
    },
  };
}

const mockCreateEvent = prisma.orangepillWebhookEvent.create as jest.Mock;
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
  });

  afterEach(() => app.close());

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

  it('returns 200 and skips handler for duplicate eventId', async () => {
    const uniqueErr = { code: 'P2002' };
    mockCreateEvent.mockRejectedValue(uniqueErr);

    const body = { event_type: 'checkout.session.completed', session_id: 'sess-1', merchant_id: 'm', tenant_id: 't' };
    const res = await app.inject(signedRequest(body));

    expect(res.statusCode).toBe(200);
    expect(mockFindPayment).not.toHaveBeenCalled();
  });

  it('marks Shopify order paid on checkout.session.completed', async () => {
    mockFindPayment.mockResolvedValue(PENDING_PAYMENT);
    mockUpdatePayment.mockResolvedValue({ ...PENDING_PAYMENT, status: 'paid' });

    const body = {
      event_type: 'checkout.session.completed',
      session_id: 'sess-1',
      merchant_id: 'm',
      tenant_id: 't',
      data: { payment_id: 'pay-op-id' },
    };

    const res = await app.inject(signedRequest(body));
    expect(res.statusCode).toBe(200);

    // give void promise a tick
    await new Promise((r) => setImmediate(r));
    expect(mockMarkOrderPaid).toHaveBeenCalledWith('store.myshopify.com', '123', '75.00', 'COP');
    expect(mockUpdatePayment).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'pay-id' }, data: expect.objectContaining({ status: 'paid' }) }),
    );
  });

  it('does not mark order paid twice (idempotency guard)', async () => {
    mockFindPayment.mockResolvedValue({ ...PENDING_PAYMENT, status: 'paid' });

    const body = { event_type: 'checkout.session.completed', session_id: 'sess-1', merchant_id: 'm', tenant_id: 't' };
    await app.inject(signedRequest(body));

    await new Promise((r) => setImmediate(r));
    expect(mockMarkOrderPaid).not.toHaveBeenCalled();
  });

  it('marks payment as failed on checkout.session.failed', async () => {
    mockUpdateManyPayments.mockResolvedValue({ count: 1 });

    const body = { event_type: 'checkout.session.failed', session_id: 'sess-2', merchant_id: 'm', tenant_id: 't' };
    await app.inject(signedRequest(body, 'checkout.session.failed'));

    await new Promise((r) => setImmediate(r));
    expect(mockUpdateManyPayments).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'failed' } }),
    );
  });

  it('marks payment as expired on checkout.session.expired', async () => {
    mockUpdateManyPayments.mockResolvedValue({ count: 1 });

    const body = { event_type: 'checkout.session.expired', session_id: 'sess-3', merchant_id: 'm', tenant_id: 't' };
    await app.inject(signedRequest(body, 'checkout.session.expired'));

    await new Promise((r) => setImmediate(r));
    expect(mockUpdateManyPayments).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'expired' } }),
    );
  });
});
