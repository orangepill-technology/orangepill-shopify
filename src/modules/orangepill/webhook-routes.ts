import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../config';
import { verifyOrangepillWebhook } from './webhook-verifier';
import {
  deduplicateAndRecord,
  handleCheckoutSessionCompleted,
  handleCheckoutSessionFailed,
  handleCheckoutSessionExpired,
  type OrangepillWebhookPayload,
} from './webhook-handler';
import { logger } from '../../logger';

export async function orangepillWebhookRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body, done) => {
      try {
        const raw = body as Buffer;
        (req as FastifyRequest & { rawBody: Buffer }).rawBody = raw;
        done(null, JSON.parse(raw.toString('utf8')));
      } catch (e) {
        done(e as Error);
      }
    },
  );

  fastify.post('/webhooks/orangepill', async (request: FastifyRequest, reply: FastifyReply) => {
    const timestamp = (request.headers['x-orangepill-timestamp'] as string | undefined) ?? '';
    const signature = (request.headers['x-orangepill-signature'] as string | undefined) ?? '';
    const eventId = (request.headers['x-orangepill-event-id'] as string | undefined) ?? '';
    const deliveryId = (request.headers['x-orangepill-delivery-id'] as string | undefined) ?? '';
    const rawBody: Buffer = (request as FastifyRequest & { rawBody: Buffer }).rawBody;

    if (!verifyOrangepillWebhook(rawBody, timestamp, signature, config.ORANGEPILL_WEBHOOK_SECRET)) {
      logger.warn({ eventId }, 'op_webhook_invalid_signature');
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const payload = request.body as OrangepillWebhookPayload;
    const { event_type: eventType, session_id: sessionId } = payload;

    const isDuplicate = await deduplicateAndRecord(
      eventId,
      deliveryId,
      eventType,
      sessionId,
      payload,
    );

    if (isDuplicate) {
      logger.info({ eventId, eventType }, 'op_webhook_duplicate');
      return reply.code(200).send({ ok: true });
    }

    logger.info({ eventId, eventType, sessionId }, 'op_webhook_received');

    switch (eventType) {
      case 'checkout.session.completed':
        void handleCheckoutSessionCompleted(payload).catch((err) =>
          logger.error({ err, eventId, sessionId }, 'op_handler_error'),
        );
        break;
      case 'checkout.session.failed':
        void handleCheckoutSessionFailed(payload).catch((err) =>
          logger.error({ err, eventId, sessionId }, 'op_handler_error'),
        );
        break;
      case 'checkout.session.expired':
        void handleCheckoutSessionExpired(payload).catch((err) =>
          logger.error({ err, eventId, sessionId }, 'op_handler_error'),
        );
        break;
      default:
        logger.info({ eventType }, 'op_webhook_topic_ignored');
    }

    return reply.code(200).send({ ok: true });
  });
}
