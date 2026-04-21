import { FastifyInstance } from 'fastify';
import { replay } from '../modules/sync/replay';

export async function replayRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Params: { eventId: string } }>(
    '/internal/events/:eventId/replay',
    async (request, reply) => {
      const { eventId } = request.params;
      const result = await replay(eventId);

      if (result.ok) {
        return reply.code(200).send({ ok: true });
      }

      const statusCode = result.error === 'Event not found' ? 404 : 500;
      return reply.code(statusCode).send({ error: result.error });
    },
  );
}
