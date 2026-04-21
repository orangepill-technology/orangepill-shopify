import 'dotenv/config';
import Fastify from 'fastify';
import { config } from './config';
import { logger } from './logger';
import { authRoutes } from './modules/auth/routes';
import { webhookRoutes } from './modules/webhooks/routes';
import { checkoutRoutes } from './modules/checkout/routes';
import { orangepillWebhookRoutes } from './modules/orangepill/webhook-routes';
import { adminApiRoutes } from './modules/admin/api-routes';
import { adminUiRoutes } from './modules/admin/ui-routes';
import { healthRoutes } from './routes/health';
import { replayRoutes } from './routes/replay';

const fastify = Fastify({
  logger: false,
  trustProxy: true,
});

async function main(): Promise<void> {
  await fastify.register(healthRoutes);
  await fastify.register(authRoutes);
  await fastify.register(webhookRoutes);
  await fastify.register(orangepillWebhookRoutes);
  await fastify.register(checkoutRoutes);
  await fastify.register(adminApiRoutes);
  await fastify.register(adminUiRoutes);
  await fastify.register(replayRoutes);

  await fastify.listen({ port: config.PORT, host: config.HOST });
  logger.info({ port: config.PORT, host: config.HOST }, 'server_started');
}

const shutdown = async (): Promise<void> => {
  logger.info('shutting_down');
  await fastify.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

main().catch((err) => {
  logger.error({ err }, 'startup_error');
  process.exit(1);
});
