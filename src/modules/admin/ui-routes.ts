import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../db/client';
import { listSyncEvents, listPayments, getHealthStats } from './queries';
import { replay } from '../sync/replay';
import { isValidShopDomain } from '../auth/service';
import {
  renderOverview,
  renderEvents,
  renderFailedEvents,
  renderPayments,
  renderReplayResult,
} from './html';

async function resolveShop(
  shopDomain: string,
  reply: FastifyReply,
): Promise<{ id: string } | null> {
  if (!shopDomain || !isValidShopDomain(shopDomain)) {
    reply.code(400).type('text/html').send('<p>Missing or invalid shop parameter</p>');
    return null;
  }
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true },
  });
  if (!shop) {
    reply.code(404).type('text/html').send('<p>Shop not installed</p>');
    return null;
  }
  return shop;
}

export async function adminUiRoutes(fastify: FastifyInstance): Promise<void> {
  // Shopify sends form POSTs — need formbody parser scoped to this plugin
  await fastify.register(import('@fastify/formbody'));

  fastify.get('/app', async (request: FastifyRequest, reply: FastifyReply) => {
    const { shop } = request.query as { shop?: string };
    const resolved = await resolveShop(shop ?? '', reply);
    if (!resolved) return;

    const [stats, recentEvents] = await Promise.all([
      getHealthStats(),
      listSyncEvents({ shopId: resolved.id, limit: 5 }),
    ]);

    return reply.type('text/html').send(renderOverview(shop!, stats, recentEvents));
  });

  fastify.get('/app/events', async (request: FastifyRequest, reply: FastifyReply) => {
    const q = request.query as Record<string, string>;
    const resolved = await resolveShop(q.shop ?? '', reply);
    if (!resolved) return;

    const limit = 50;
    const rows = await listSyncEvents({
      shopId: resolved.id,
      status: q.status,
      eventType: q.eventType,
      cursor: q.cursor,
      limit,
    });

    const hasMore = rows.length > limit;
    const events = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? events[events.length - 1].id : null;

    return reply
      .type('text/html')
      .send(renderEvents(q.shop!, events, q.status ?? '', q.eventType ?? '', nextCursor));
  });

  fastify.get('/app/events/failed', async (request: FastifyRequest, reply: FastifyReply) => {
    const q = request.query as Record<string, string>;
    const resolved = await resolveShop(q.shop ?? '', reply);
    if (!resolved) return;

    const events = await listSyncEvents({ shopId: resolved.id, status: 'failed', limit: 200 });
    return reply.type('text/html').send(renderFailedEvents(q.shop!, events));
  });

  // Replay form action — POST from the UI replay buttons
  fastify.post('/app/events/replay', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { eventId?: string; shop?: string };
    const shop = body.shop ?? '';
    const eventId = body.eventId ?? '';

    if (!eventId) {
      return reply.type('text/html').send(renderReplayResult(shop, false, 'Missing eventId'));
    }

    const result = await replay(eventId);
    return reply.type('text/html').send(renderReplayResult(shop, result.ok, result.error));
  });

  fastify.get('/app/payments', async (request: FastifyRequest, reply: FastifyReply) => {
    const q = request.query as Record<string, string>;
    const resolved = await resolveShop(q.shop ?? '', reply);
    if (!resolved) return;

    const limit = 50;
    const rows = await listPayments({ shopId: resolved.id, cursor: q.cursor, limit });
    const hasMore = rows.length > limit;
    const payments = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? payments[payments.length - 1].id : null;

    return reply.type('text/html').send(renderPayments(q.shop!, payments, nextCursor));
  });
}
