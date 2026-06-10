import Fastify from 'fastify';
import { createHmac } from 'crypto';

jest.mock('../../modules/db/client', () => ({
  prisma: {
    shop: { findUnique: jest.fn() },
    shopifySyncEvent: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../../modules/sync/journal', () => ({
  recordEvent: jest.fn(),
}));

jest.mock('../../modules/orangepill/emitter', () => ({
  emitter: { emit: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../modules/auth/service', () => ({
  uninstallShop: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../modules/attribution/service', () => ({
  getOrderAttribution: jest.fn().mockResolvedValue(null),
}));

import { webhookRoutes } from '../../modules/webhooks/routes';
import { prisma } from '../../modules/db/client';
import { recordEvent } from '../../modules/sync/journal';
import { emitter } from '../../modules/orangepill/emitter';

const SHOPIFY_SECRET = process.env.SHOPIFY_API_SECRET!;

function signedRequest(body: object, topic: string, shopDomain = 'test.myshopify.com') {
  const bodyStr = JSON.stringify(body);
  const hmac = createHmac('sha256', SHOPIFY_SECRET).update(bodyStr).digest('base64');
  return {
    method: 'POST' as const,
    url: '/webhooks/shopify',
    payload: bodyStr,
    headers: {
      'content-type': 'application/json',
      'x-shopify-hmac-sha256': hmac,
      'x-shopify-shop-domain': shopDomain,
      'x-shopify-topic': topic,
    },
  };
}

const mockFindShop = prisma.shop.findUnique as jest.Mock;
const mockRecordEvent = recordEvent as jest.MockedFunction<typeof recordEvent>;
const mockEmit = emitter.emit as jest.Mock;

const ACTIVE_SHOP = { id: 'shop-id', uninstalledAt: null };
const MOCK_ENTRY = {
  id: 'evt-id',
  shopId: 'shop-id',
  direction: 'shopify_to_op',
  eventType: 'order.finalized',
  resourceId: '123',
  payloadJson: {},
  endpoint: 'https://api.orangepill.cloud/v4/...',
  idempotencyKey: 'shopify:123:order.finalized',
  status: 'pending',
  attemptCount: 0,
  lastError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('POST /webhooks/shopify', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(webhookRoutes);
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(() => app.close());

  it('returns 401 for missing HMAC', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/shopify',
      payload: '{}',
      headers: {
        'content-type': 'application/json',
        'x-shopify-shop-domain': 'test.myshopify.com',
        'x-shopify-topic': 'orders/paid',
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 for invalid HMAC', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/shopify',
      payload: '{"id":1}',
      headers: {
        'content-type': 'application/json',
        'x-shopify-hmac-sha256': 'invalidsignature',
        'x-shopify-shop-domain': 'test.myshopify.com',
        'x-shopify-topic': 'orders/paid',
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 404 for unknown shop', async () => {
    mockFindShop.mockResolvedValue(null);
    const order = { id: 1, total_price: '10.00', currency: 'USD', email: null, phone: null };
    const res = await app.inject(signedRequest(order, 'orders/paid'));
    expect(res.statusCode).toBe(404);
  });

  it('records event and fires emitter for orders/paid', async () => {
    mockFindShop.mockResolvedValue(ACTIVE_SHOP);
    mockRecordEvent.mockResolvedValue({ entry: MOCK_ENTRY as any, isNew: true });

    const order = {
      id: 123,
      total_price: '99.99',
      currency: 'USD',
      email: 'buyer@test.com',
      phone: null,
      customer: { id: 9 },
    };

    const res = await app.inject(signedRequest(order, 'orders/paid'));

    expect(res.statusCode).toBe(200);
    expect(mockRecordEvent).toHaveBeenCalledWith(
      'shop-id',
      'order.finalized',
      '123',
      expect.objectContaining({ event: 'order.finalized', shopify_order_id: 123 }),
      'shopify:123:order.finalized',
    );
    // give the void promise a tick to register
    await new Promise((r) => setImmediate(r));
    expect(mockEmit).toHaveBeenCalledWith(MOCK_ENTRY);
  });

  it('does NOT call emitter for duplicate order (isNew=false)', async () => {
    mockFindShop.mockResolvedValue(ACTIVE_SHOP);
    mockRecordEvent.mockResolvedValue({ entry: MOCK_ENTRY as any, isNew: false });

    const order = { id: 123, total_price: '99.99', currency: 'USD', email: null, phone: null };
    const res = await app.inject(signedRequest(order, 'orders/paid'));

    expect(res.statusCode).toBe(200);
    await new Promise((r) => setImmediate(r));
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('records refund event for refunds/create', async () => {
    mockFindShop.mockResolvedValue(ACTIVE_SHOP);
    mockRecordEvent.mockResolvedValue({ entry: MOCK_ENTRY as any, isNew: true });

    const refund = {
      id: 55,
      order_id: 123,
      transactions: [{ amount: '10.00', currency: 'USD' }],
    };

    const res = await app.inject(signedRequest(refund, 'refunds/create'));

    expect(res.statusCode).toBe(200);
    expect(mockRecordEvent).toHaveBeenCalledWith(
      'shop-id',
      'order.refunded',
      '123',
      expect.objectContaining({ event: 'order.refunded', refund_id: 55 }),
      'shopify:123:refund:55',
    );
  });

  it('returns 200 even when emitter fails', async () => {
    mockFindShop.mockResolvedValue(ACTIVE_SHOP);
    mockRecordEvent.mockResolvedValue({ entry: MOCK_ENTRY as any, isNew: true });
    mockEmit.mockRejectedValue(new Error('Orangepill unreachable'));

    const order = { id: 1, total_price: '5.00', currency: 'USD', email: null, phone: null };
    const res = await app.inject(signedRequest(order, 'orders/paid'));

    expect(res.statusCode).toBe(200);
  });
});
