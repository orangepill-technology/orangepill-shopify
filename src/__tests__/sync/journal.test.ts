jest.mock('../../modules/db/client', () => ({
  prisma: {
    shopifySyncEvent: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { recordEvent, markSent, markFailed } from '../../modules/sync/journal';
import { prisma } from '../../modules/db/client';

const mockCreate = prisma.shopifySyncEvent.create as jest.Mock;
const mockFindUnique = prisma.shopifySyncEvent.findUnique as jest.Mock;
const mockUpdate = prisma.shopifySyncEvent.update as jest.Mock;

const PAYLOAD = {
  event: 'order.finalized' as const,
  shopify_order_id: 123,
  status: 'paid' as const,
  order_total: '99.99',
  currency: 'USD',
  customer: { email: null, phone: null, shopify_customer_id: null },
  metadata: { channel: 'shopify' as const, shop_domain: 'test.myshopify.com' },
};

const MOCK_ENTRY = {
  id: 'evt-uuid-1',
  shopId: 'shop-uuid',
  direction: 'shopify_to_op',
  eventType: 'order.finalized',
  resourceId: '123',
  payloadJson: PAYLOAD,
  endpoint: 'https://api.orangepill.cloud/v4/commerce/integrations/00000000-0000-0000-0000-000000000001/events',
  idempotencyKey: 'shopify:123:order.finalized',
  status: 'pending',
  attemptCount: 0,
  lastError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe('recordEvent', () => {
  it('creates a new entry and returns isNew=true', async () => {
    mockCreate.mockResolvedValue(MOCK_ENTRY);

    const { entry, isNew } = await recordEvent(
      'shop-uuid',
      'order.finalized',
      '123',
      PAYLOAD,
      'shopify:123:order.finalized',
    );

    expect(isNew).toBe(true);
    expect(entry.id).toBe('evt-uuid-1');
    expect(entry.status).toBe('pending');
  });

  it('returns existing entry and isNew=false on duplicate idempotency key', async () => {
    const uniqueErr = { code: 'P2002', meta: { target: ['direction', 'eventType', 'idempotencyKey'] } };
    mockCreate.mockRejectedValue(uniqueErr);
    mockFindUnique.mockResolvedValue(MOCK_ENTRY);

    const { entry, isNew } = await recordEvent(
      'shop-uuid',
      'order.finalized',
      '123',
      PAYLOAD,
      'shopify:123:order.finalized',
    );

    expect(isNew).toBe(false);
    expect(entry.id).toBe('evt-uuid-1');
  });

  it('re-throws non-unique errors', async () => {
    mockCreate.mockRejectedValue(new Error('DB connection refused'));

    await expect(
      recordEvent('shop-uuid', 'order.finalized', '123', PAYLOAD, 'key'),
    ).rejects.toThrow('DB connection refused');
  });
});

describe('markSent', () => {
  it('updates status to sent', async () => {
    mockUpdate.mockResolvedValue({ ...MOCK_ENTRY, status: 'sent' });
    await markSent('evt-uuid-1');
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'evt-uuid-1' },
      data: { status: 'sent' },
    });
  });
});

describe('markFailed', () => {
  it('updates status to failed with error and increments attemptCount', async () => {
    mockUpdate.mockResolvedValue({ ...MOCK_ENTRY, status: 'failed' });
    await markFailed('evt-uuid-1', 'timeout');
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'evt-uuid-1' },
      data: {
        status: 'failed',
        lastError: 'timeout',
        attemptCount: { increment: 1 },
      },
    });
  });
});
