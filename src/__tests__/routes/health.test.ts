jest.mock('../../modules/db/client', () => ({
  prisma: {
    shopifySyncEvent: {
      groupBy: jest.fn(),
      findFirst: jest.fn(),
    },
    shopifyOrderPayment: {
      groupBy: jest.fn(),
    },
  },
}));

import Fastify from 'fastify';
import { healthRoutes } from '../../routes/health';
import { prisma } from '../../modules/db/client';

const mockSyncGroupBy = prisma.shopifySyncEvent.groupBy as jest.Mock;
const mockSyncFindFirst = prisma.shopifySyncEvent.findFirst as jest.Mock;
const mockPaymentGroupBy = prisma.shopifyOrderPayment.groupBy as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockSyncFindFirst.mockResolvedValue(null);
  mockPaymentGroupBy.mockResolvedValue([]);
});

describe('GET /health', () => {
  it('returns ok with retry and dead-letter counts', async () => {
    mockSyncGroupBy.mockResolvedValue([
      { status: 'sent', _count: { id: 10 } },
      { status: 'failed', _count: { id: 2 } },
      { status: 'retry_scheduled', _count: { id: 3 } },
      { status: 'dead_letter', _count: { id: 1 } },
    ]);

    const app = Fastify({ logger: false });
    await app.register(healthRoutes);
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.stats.syncEvents.sent).toBe(10);
    expect(body.stats.syncEvents.failed).toBe(2);
    expect(body.stats.syncEvents.retryScheduled).toBe(3);
    expect(body.stats.syncEvents.deadLetter).toBe(1);

    await app.close();
  });

  it('defaults missing statuses to zero', async () => {
    mockSyncGroupBy.mockResolvedValue([]);

    const app = Fastify({ logger: false });
    await app.register(healthRoutes);
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/health' });
    const body = res.json();

    expect(body.stats.syncEvents.retryScheduled).toBe(0);
    expect(body.stats.syncEvents.deadLetter).toBe(0);

    await app.close();
  });
});
