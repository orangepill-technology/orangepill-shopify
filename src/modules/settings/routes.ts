import { FastifyInstance } from 'fastify';
import { prisma } from '../db/client';
import { getShopSettings, upsertShopSettings } from './service';

const paramsSchema = {
  type: 'object',
  properties: { shop: { type: 'string' } },
  required: ['shop'],
};

const bodySchema = {
  type: 'object',
  properties: {
    // Orangepill integration credentials
    integrationId: { type: ['string', 'null'] },
    merchantId: { type: ['string', 'null'] },
    apiKey: { type: ['string', 'null'] },
    orangepillApiUrl: { type: ['string', 'null'] },
    webhookSecret: { type: ['string', 'null'] },
    // Conversational commerce
    webchatEnabled: { type: 'boolean' },
    webchatEntrypointId: { type: ['string', 'null'] },
    webchatEmbedUrl: { type: ['string', 'null'] },
    whatsappEnabled: { type: 'boolean' },
    whatsappNumber: { type: ['string', 'null'] },
    whatsappFlowId: { type: ['string', 'null'] },
    whatsappStickyEnabled: { type: 'boolean' },
    identitySecret: { type: 'string' },
  },
  additionalProperties: false,
};

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/internal/settings/:shop', { schema: { params: paramsSchema } }, async (req, reply) => {
    const { shop } = req.params as { shop: string };
    const row = await prisma.shop.findUnique({ where: { shopDomain: shop } });
    if (!row) return reply.status(404).send({ error: 'Shop not found' });

    const settings = await getShopSettings(row.id);
    // Secrets (apiKey, webhookSecret, identitySecret) are never returned — only boolean presence flags.
    return reply.send({
      integrationId: settings.integrationId,
      merchantId: settings.merchantId,
      apiKeySet: settings.apiKey !== null,
      orangepillApiUrl: settings.orangepillApiUrl,
      webhookSecretSet: settings.webhookSecret !== null,
      webchatEnabled: settings.webchatEnabled,
      webchatEntrypointId: settings.webchatEntrypointId,
      webchatEmbedUrl: settings.webchatEmbedUrl,
      whatsappEnabled: settings.whatsappEnabled,
      whatsappNumber: settings.whatsappNumber,
      whatsappFlowId: settings.whatsappFlowId,
      whatsappStickyEnabled: settings.whatsappStickyEnabled,
      identitySecretSet: settings.identitySecret !== null,
    });
  });

  app.put('/internal/settings/:shop', { schema: { params: paramsSchema, body: bodySchema } }, async (req, reply) => {
    const { shop } = req.params as { shop: string };
    const body = req.body as {
      integrationId?: string | null;
      merchantId?: string | null;
      apiKey?: string | null;
      orangepillApiUrl?: string | null;
      webhookSecret?: string | null;
      webchatEnabled?: boolean;
      webchatEntrypointId?: string | null;
      webchatEmbedUrl?: string | null;
      whatsappEnabled?: boolean;
      whatsappNumber?: string | null;
      whatsappFlowId?: string | null;
      whatsappStickyEnabled?: boolean;
      identitySecret?: string;
    };

    const row = await prisma.shop.findUnique({ where: { shopDomain: shop } });
    if (!row) return reply.status(404).send({ error: 'Shop not found' });

    await upsertShopSettings(row.id, body);
    return reply.status(204).send();
  });
}
