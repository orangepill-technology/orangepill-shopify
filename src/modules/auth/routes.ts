import { FastifyInstance } from 'fastify';
import {
  buildInstallUrl,
  isValidShopDomain,
  validateOAuthHmac,
  validateState,
  installShop,
} from './service';
import { registerWebhooks } from '../webhooks/service';
import { logger } from '../../logger';

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Querystring: { shop?: string } }>('/auth/install', async (request, reply) => {
    const { shop } = request.query;

    if (!shop || !isValidShopDomain(shop)) {
      return reply.code(400).send({ error: 'Invalid or missing shop domain' });
    }

    return reply.redirect(buildInstallUrl(shop));
  });

  fastify.get<{
    Querystring: {
      shop?: string;
      code?: string;
      state?: string;
      hmac?: string;
      timestamp?: string;
    };
  }>('/auth/callback', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const { shop, code, state } = query;

    if (!shop || !isValidShopDomain(shop)) {
      return reply.code(400).send({ error: 'Invalid shop domain' });
    }
    if (!code || !state) {
      return reply.code(400).send({ error: 'Missing code or state' });
    }
    if (!validateOAuthHmac(query)) {
      logger.warn({ shop }, 'oauth_invalid_hmac');
      return reply.code(401).send({ error: 'Invalid HMAC' });
    }
    if (!validateState(state, shop)) {
      logger.warn({ shop }, 'oauth_invalid_state');
      return reply.code(401).send({ error: 'Invalid or expired state' });
    }

    try {
      await installShop(shop, code);
      await registerWebhooks(shop);
      return reply.code(200).send({ ok: true, shop });
    } catch (err) {
      logger.error({ err, shop }, 'oauth_callback_error');
      return reply.code(500).send({ error: 'Installation failed' });
    }
  });
}
