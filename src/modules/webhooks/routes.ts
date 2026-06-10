import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../config';
import { verifyShopifyWebhook } from './verifier';
import { mapOrderFinalized, mapOrderRefunded } from '../orangepill/mapper';
import { recordEvent } from '../sync/journal';
import { emitter } from '../orangepill/emitter';
import { uninstallShop } from '../auth/service';
import { getOrderAttribution } from '../attribution/service';
import { prisma } from '../db/client';
import { logger } from '../../logger';
import type { ShopifyOrder, ShopifyRefund } from '../orangepill/types';

export async function webhookRoutes(fastify: FastifyInstance): Promise<void> {
  // Capture raw body for HMAC verification before JSON parsing.
  // Scoped to this plugin — does not affect other routes.
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

  fastify.post('/webhooks/shopify', async (request: FastifyRequest, reply: FastifyReply) => {
    const hmacHeader = (request.headers['x-shopify-hmac-sha256'] as string | undefined) ?? '';
    const shopDomain = (request.headers['x-shopify-shop-domain'] as string | undefined) ?? '';
    const topic = (request.headers['x-shopify-topic'] as string | undefined) ?? '';
    const rawBody: Buffer = (request as FastifyRequest & { rawBody: Buffer }).rawBody;

    logger.info({ topic, shop: shopDomain }, 'webhook_received');

    if (!rawBody || !verifyShopifyWebhook(rawBody, hmacHeader, config.SHOPIFY_API_SECRET)) {
      logger.warn({ shop: shopDomain, topic }, 'webhook_invalid_signature');
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    if (!shopDomain) {
      return reply.code(400).send({ error: 'Missing shop domain header' });
    }

    const shop = await prisma.shop.findUnique({
      where: { shopDomain },
      select: { id: true, uninstalledAt: true },
    });

    if (!shop) {
      logger.warn({ shop: shopDomain, topic }, 'webhook_unknown_shop');
      return reply.code(404).send({ error: 'Shop not found' });
    }

    // app/uninstalled fires after the shop is removed — still process it
    if (shop.uninstalledAt && topic !== 'app/uninstalled') {
      return reply.code(404).send({ error: 'Shop not active' });
    }

    const body = request.body as Record<string, unknown>;

    switch (topic) {
      case 'orders/paid': {
        const order = body as unknown as ShopifyOrder;
        const idempotencyKey = `shopify:${order.id}:order.finalized`;
        const attribution = await getOrderAttribution(shop.id, String(order.id));
        const payload = mapOrderFinalized(order, shopDomain, attribution);
        const { entry, isNew } = await recordEvent(
          shop.id,
          'order.finalized',
          String(order.id),
          payload,
          idempotencyKey,
        );
        if (isNew) {
          void emitter
            .emit(entry)
            .catch((err) => logger.error({ err, id: entry.id }, 'emitter_unhandled_error'));
        }
        break;
      }

      case 'refunds/create': {
        const refund = body as unknown as ShopifyRefund;
        const idempotencyKey = `shopify:${refund.order_id}:refund:${refund.id}`;
        const payload = mapOrderRefunded(refund, shopDomain);
        const { entry, isNew } = await recordEvent(
          shop.id,
          'order.refunded',
          String(refund.order_id),
          payload,
          idempotencyKey,
        );
        if (isNew) {
          void emitter
            .emit(entry)
            .catch((err) => logger.error({ err, id: entry.id }, 'emitter_unhandled_error'));
        }
        break;
      }

      case 'app/uninstalled': {
        await uninstallShop(shopDomain);
        break;
      }

      default:
        logger.info({ topic, shop: shopDomain }, 'webhook_topic_ignored');
    }

    // Always 200 to Shopify regardless of downstream outcome
    return reply.code(200).send({ ok: true });
  });
}
