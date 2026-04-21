import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../config';
import { listSyncEvents, getSyncEvent, listPayments, getHealthStats } from './queries';
import { replay } from '../sync/replay';

function requireAdminKey(request: FastifyRequest, reply: FastifyReply): boolean {
  const auth = request.headers.authorization ?? '';
  if (auth !== `Bearer ${config.ADMIN_API_KEY}`) {
    reply.code(401).send({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

function paginate<T extends { id: string }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;
  return { items, nextCursor };
}

export async function adminApiRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /internal/events
  fastify.get('/internal/events', async (request, reply) => {
    if (!requireAdminKey(request, reply)) return;

    const q = request.query as Record<string, string>;
    const limit = Math.min(parseInt(q.limit ?? '50', 10) || 50, 200);

    const rows = await listSyncEvents({
      status: q.status,
      eventType: q.eventType,
      shopId: q.shopId,
      cursor: q.cursor,
      limit,
    });

    const { items, nextCursor } = paginate(rows, limit);
    return reply.send({ events: items, nextCursor });
  });

  // GET /internal/events/:id
  fastify.get<{ Params: { id: string } }>('/internal/events/:id', async (request, reply) => {
    if (!requireAdminKey(request, reply)) return;

    const event = await getSyncEvent(request.params.id);
    if (!event) return reply.code(404).send({ error: 'Event not found' });
    return reply.send({ event });
  });

  // POST /internal/events/:id/replay  (reuses PR-1 replay service)
  fastify.post<{ Params: { id: string } }>('/internal/events/:id/replay', async (request, reply) => {
    if (!requireAdminKey(request, reply)) return;

    const result = await replay(request.params.id);
    if (result.ok) return reply.send({ ok: true });
    return reply.code(result.error === 'Event not found' ? 404 : 500).send({ error: result.error });
  });

  // GET /internal/payments
  fastify.get('/internal/payments', async (request, reply) => {
    if (!requireAdminKey(request, reply)) return;

    const q = request.query as Record<string, string>;
    const limit = Math.min(parseInt(q.limit ?? '50', 10) || 50, 200);

    const rows = await listPayments({
      status: q.status,
      shopId: q.shopId,
      cursor: q.cursor,
      limit,
    });

    const { items, nextCursor } = paginate(rows, limit);
    return reply.send({ payments: items, nextCursor });
  });
}
