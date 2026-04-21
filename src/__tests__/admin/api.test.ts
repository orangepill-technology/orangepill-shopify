jest.mock('../../modules/db/client', () => ({
  prisma: {
    shopifySyncEvent: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      groupBy: jest.fn(),
    },
    shopifyOrderPayment: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}));

jest.mock('../../modules/sync/replay', () => ({
  replay: jest.fn(),
}));

import Fastify from 'fastify';
import { adminApiRoutes } from '../../modules/admin/api-routes';
import { prisma } from '../../modules/db/client';
import { replay } from '../../modules/sync/replay';

const ADMIN_KEY = process.env.ADMIN_API_KEY!;
const AUTH = { authorization: `Bearer ${ADMIN_KEY}` };

const mockFindEvents = prisma.shopifySyncEvent.findMany as jest.Mock;
const mockFindEvent = prisma.shopifySyncEvent.findUnique as jest.Mock;
const mockFindPayments = prisma.shopifyOrderPayment.findMany as jest.Mock;
const mockGroupEvents = prisma.shopifySyncEvent.groupBy as jest.Mock;
const mockGroupPayments = prisma.shopifyOrderPayment.groupBy as jest.Mock;
const mockReplay = replay as jest.MockedFunction<typeof replay>;

function makeEvent(overrides = {}) {
  return {
    id: 'evt-1',
    shopId: 'shop-1',
    eventType: 'order.finalized',
    resourceId: '123',
    idempotencyKey: 'shopify:123:order.finalized',
    status: 'failed',
    attemptCount: 2,
    lastError: 'timeout',
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:05:00Z'),
    ...overrides,
  };
}

describe('Admin JSON API', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(adminApiRoutes);
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(() => app.close());

  // ── Auth ──────────────────────────────────────────────────────────────────

  it('returns 401 without admin key', async () => {
    const res = await app.inject({ method: 'GET', url: '/internal/events' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 with wrong admin key', async () => {
    const res = await app.inject({
      method: 'GET', url: '/internal/events',
      headers: { authorization: 'Bearer wrong-key' },
    });
    expect(res.statusCode).toBe(401);
  });

  // ── GET /internal/events ──────────────────────────────────────────────────

  it('returns paginated events', async () => {
    mockFindEvents.mockResolvedValue([makeEvent(), makeEvent({ id: 'evt-2' })]);

    const res = await app.inject({ method: 'GET', url: '/internal/events', headers: AUTH });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.events).toHaveLength(2);
    expect(body.nextCursor).toBeNull();
  });

  it('returns nextCursor when more results exist', async () => {
    // Return limit+1 rows to signal there's a next page
    const rows = Array.from({ length: 51 }, (_, i) => makeEvent({ id: `evt-${i}` }));
    mockFindEvents.mockResolvedValue(rows);

    const res = await app.inject({ method: 'GET', url: '/internal/events?limit=50', headers: AUTH });
    const body = res.json();
    expect(body.events).toHaveLength(50);
    expect(body.nextCursor).toBe('evt-49');
  });

  it('filters by status', async () => {
    mockFindEvents.mockResolvedValue([makeEvent()]);

    await app.inject({ method: 'GET', url: '/internal/events?status=failed', headers: AUTH });
    expect(mockFindEvents).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'failed' }) }),
    );
  });

  it('filters by eventType', async () => {
    mockFindEvents.mockResolvedValue([]);

    await app.inject({ method: 'GET', url: '/internal/events?eventType=order.refunded', headers: AUTH });
    expect(mockFindEvents).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ eventType: 'order.refunded' }) }),
    );
  });

  it('caps limit at 200', async () => {
    mockFindEvents.mockResolvedValue([]);

    await app.inject({ method: 'GET', url: '/internal/events?limit=9999', headers: AUTH });
    expect(mockFindEvents).toHaveBeenCalledWith(
      expect.objectContaining({ take: 201 }), // 200 + 1 for hasMore probe
    );
  });

  // ── GET /internal/events/:id ──────────────────────────────────────────────

  it('returns full event by id', async () => {
    mockFindEvent.mockResolvedValue({ ...makeEvent(), payloadJson: { event: 'order.finalized' } });

    const res = await app.inject({ method: 'GET', url: '/internal/events/evt-1', headers: AUTH });
    expect(res.statusCode).toBe(200);
    expect(res.json().event.id).toBe('evt-1');
  });

  it('returns 404 for unknown event id', async () => {
    mockFindEvent.mockResolvedValue(null);

    const res = await app.inject({ method: 'GET', url: '/internal/events/nope', headers: AUTH });
    expect(res.statusCode).toBe(404);
  });

  // ── POST /internal/events/:id/replay ─────────────────────────────────────

  it('replays event successfully', async () => {
    mockReplay.mockResolvedValue({ ok: true });

    const res = await app.inject({ method: 'POST', url: '/internal/events/evt-1/replay', headers: AUTH });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
    expect(mockReplay).toHaveBeenCalledWith('evt-1');
  });

  it('returns 404 on replay of missing event', async () => {
    mockReplay.mockResolvedValue({ ok: false, error: 'Event not found' });

    const res = await app.inject({ method: 'POST', url: '/internal/events/ghost/replay', headers: AUTH });
    expect(res.statusCode).toBe(404);
  });

  it('returns 500 on replay failure', async () => {
    mockReplay.mockResolvedValue({ ok: false, error: 'Orangepill unreachable' });

    const res = await app.inject({ method: 'POST', url: '/internal/events/evt-1/replay', headers: AUTH });
    expect(res.statusCode).toBe(500);
  });

  // ── GET /internal/payments ────────────────────────────────────────────────

  it('returns paginated payments', async () => {
    mockFindPayments.mockResolvedValue([
      { id: 'pay-1', shopId: 'shop-1', shopifyOrderId: '123', orangepillSessionId: 'sess-1',
        orangepillPaymentId: null, shopifyTransactionId: 'txn-1', amount: '75.00', currency: 'COP',
        status: 'paid', createdAt: new Date(), updatedAt: new Date() },
    ]);

    const res = await app.inject({ method: 'GET', url: '/internal/payments', headers: AUTH });
    expect(res.statusCode).toBe(200);
    expect(res.json().payments).toHaveLength(1);
  });

  it('filters payments by status', async () => {
    mockFindPayments.mockResolvedValue([]);

    await app.inject({ method: 'GET', url: '/internal/payments?status=failed', headers: AUTH });
    expect(mockFindPayments).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'failed' }) }),
    );
  });
});
