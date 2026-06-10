import { FastifyInstance } from 'fastify';
import { createOrGetCheckoutSession } from './service';
import { isValidShopDomain } from '../auth/service';
import { config } from '../../config';
import { logger } from '../../logger';

interface CreateSessionBody {
  shopDomain: string;
  orderId: string;
  conversationId?: string;
  channelSessionId?: string;
}

export async function checkoutRoutes(fastify: FastifyInstance): Promise<void> {
  // Called by Shopify payment provider flow. Returns a redirect to /checkout/prepare
  // so the customer sees the preparation UX before landing on Orangepill checkout.
  fastify.post<{ Body: CreateSessionBody }>('/checkout/create-session', async (request, reply) => {
    const { shopDomain, orderId, conversationId, channelSessionId } = request.body ?? {};

    if (!shopDomain || !isValidShopDomain(shopDomain)) {
      return reply.code(400).send({ error: 'Invalid shop domain' });
    }
    if (!orderId) {
      return reply.code(400).send({ error: 'Missing orderId' });
    }

    try {
      const result = await createOrGetCheckoutSession(shopDomain, String(orderId), {
        conversationId: conversationId ?? null,
        channelSessionId: channelSessionId ?? null,
      });
      // Return the prepare page URL — customer lands there first before being sent to OP checkout
      const prepareUrl = `${config.APP_URL}/checkout/prepare?shop=${encodeURIComponent(shopDomain)}&orderId=${encodeURIComponent(orderId)}`;
      return reply.code(200).send({ redirectUrl: prepareUrl, sessionId: result.sessionId });
    } catch (err) {
      logger.error({ err, shopDomain, orderId }, 'checkout_create_session_error');
      return reply.code(500).send({ error: 'Failed to create checkout session' });
    }
  });
}
