import { FastifyInstance } from 'fastify';
import { createOrGetCheckoutSession } from './service';
import { isValidShopDomain } from '../auth/service';
import { logger } from '../../logger';

interface CreateSessionBody {
  shopDomain: string;
  orderId: string;
}

export async function checkoutRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: CreateSessionBody }>('/checkout/create-session', async (request, reply) => {
    const { shopDomain, orderId } = request.body ?? {};

    if (!shopDomain || !isValidShopDomain(shopDomain)) {
      return reply.code(400).send({ error: 'Invalid shop domain' });
    }
    if (!orderId) {
      return reply.code(400).send({ error: 'Missing orderId' });
    }

    try {
      const result = await createOrGetCheckoutSession(shopDomain, String(orderId));
      return reply.code(200).send({ redirectUrl: result.redirectUrl, sessionId: result.sessionId });
    } catch (err) {
      logger.error({ err, shopDomain, orderId }, 'checkout_create_session_error');
      return reply.code(500).send({ error: 'Failed to create checkout session' });
    }
  });

  // Landing page after Orangepill hosted checkout completes.
  // Truth comes from the webhook — this is UX only.
  fastify.get<{ Querystring: { shop?: string } }>('/checkout/success', async (request, reply) => {
    const { shop } = request.query;
    if (shop && isValidShopDomain(shop)) {
      return reply.redirect(`https://${shop}/orders`);
    }
    return reply.code(200).send({ status: 'Payment received' });
  });
}
