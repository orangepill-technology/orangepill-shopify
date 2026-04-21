import { FastifyInstance } from 'fastify';
import { getHealthStats } from '../modules/admin/queries';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', async (_request, reply) => {
    const stats = await getHealthStats();
    return reply.code(200).send({
      status: 'ok',
      ts: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      stats,
    });
  });
}
