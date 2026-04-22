jest.mock('../../modules/db/client', () => ({
  prisma: {
    shop: { findUnique: jest.fn() },
    shopifyOrderPayment: { findUnique: jest.fn() },
  },
}));

import Fastify from 'fastify';
import { checkoutUxRoutes } from '../../modules/checkout/ux-routes';
import { prisma } from '../../modules/db/client';

const mockShopFind = prisma.shop.findUnique as jest.Mock;
const mockPaymentFind = prisma.shopifyOrderPayment.findUnique as jest.Mock;

function makePayment(overrides = {}) {
  return {
    status: 'paid',
    amount: '100000.00',
    currency: 'COP',
    orderAmount: '25.00',
    orderCurrency: 'USD',
    ...overrides,
  };
}

describe('GET /checkout/status', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(checkoutUxRoutes);
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(() => app.close());

  it('returns paid status with amounts', async () => {
    mockShopFind.mockResolvedValue({ id: 'shop-1' });
    mockPaymentFind.mockResolvedValue(makePayment());

    const res = await app.inject({
      method: 'GET',
      url: '/checkout/status?shop=test.myshopify.com&orderId=123',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('paid');
    expect(body.amount).toBe('100000.00');
    expect(body.currency).toBe('COP');
    expect(body.originalAmount).toBe('25.00');
    expect(body.originalCurrency).toBe('USD');
  });

  it('maps processing → pending (internal lock state hidden from UX)', async () => {
    mockShopFind.mockResolvedValue({ id: 'shop-1' });
    mockPaymentFind.mockResolvedValue(makePayment({ status: 'processing' }));

    const res = await app.inject({
      method: 'GET',
      url: '/checkout/status?shop=test.myshopify.com&orderId=123',
    });

    expect(res.json().status).toBe('pending');
  });

  it('returns failed status', async () => {
    mockShopFind.mockResolvedValue({ id: 'shop-1' });
    mockPaymentFind.mockResolvedValue(makePayment({ status: 'failed' }));

    const res = await app.inject({
      method: 'GET',
      url: '/checkout/status?shop=test.myshopify.com&orderId=123',
    });

    expect(res.json().status).toBe('failed');
  });

  it('returns expired status', async () => {
    mockShopFind.mockResolvedValue({ id: 'shop-1' });
    mockPaymentFind.mockResolvedValue(makePayment({ status: 'expired' }));

    expect((await app.inject({
      method: 'GET',
      url: '/checkout/status?shop=test.myshopify.com&orderId=123',
    })).json().status).toBe('expired');
  });

  it('returns unknown for missing order', async () => {
    mockShopFind.mockResolvedValue({ id: 'shop-1' });
    mockPaymentFind.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: '/checkout/status?shop=test.myshopify.com&orderId=999',
    });

    expect(res.json().status).toBe('unknown');
  });

  it('returns unknown for unknown shop (no cross-tenant leakage)', async () => {
    mockShopFind.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: '/checkout/status?shop=evil.myshopify.com&orderId=123',
    });

    expect(res.json().status).toBe('unknown');
    expect(mockPaymentFind).not.toHaveBeenCalled();
  });

  it('scopes lookup to the correct shop (no cross-shop leakage)', async () => {
    mockShopFind.mockResolvedValue({ id: 'shop-2' });
    mockPaymentFind.mockResolvedValue(null); // order belongs to shop-1, not shop-2

    const res = await app.inject({
      method: 'GET',
      url: '/checkout/status?shop=other.myshopify.com&orderId=123',
    });

    expect(res.json().status).toBe('unknown');
    expect(mockPaymentFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shopId_shopifyOrderId: { shopId: 'shop-2', shopifyOrderId: '123' } },
      }),
    );
  });

  it('returns 400 for invalid shop domain', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/checkout/status?shop=not-a-shopify-domain&orderId=123',
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when orderId is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/checkout/status?shop=test.myshopify.com',
    });

    expect(res.statusCode).toBe(400);
  });

  it('omits originalAmount when order currency matches payment currency', async () => {
    mockShopFind.mockResolvedValue({ id: 'shop-1' });
    mockPaymentFind.mockResolvedValue(makePayment({ orderAmount: null, orderCurrency: null }));

    const body = (await app.inject({
      method: 'GET',
      url: '/checkout/status?shop=test.myshopify.com&orderId=123',
    })).json();

    expect(body.originalAmount).toBeUndefined();
    expect(body.originalCurrency).toBeUndefined();
  });
});
