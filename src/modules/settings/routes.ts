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
    webchatEnabled: { type: 'boolean' },
    webchatEntrypointId: { type: ['string', 'null'] },
    webchatEmbedUrl: { type: ['string', 'null'] },
    whatsappEnabled: { type: 'boolean' },
    whatsappNumber: { type: ['string', 'null'] },
    whatsappFlowId: { type: ['string', 'null'] },
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
    // Never return the raw secret over the wire — return a boolean presence flag instead
    return reply.send({
      ...settings,
      identitySecret: undefined,
      identitySecretSet: settings.identitySecret !== null,
    });
  });

  app.put('/internal/settings/:shop', { schema: { params: paramsSchema, body: bodySchema } }, async (req, reply) => {
    const { shop } = req.params as { shop: string };
    const body = req.body as {
      webchatEnabled?: boolean;
      webchatEntrypointId?: string | null;
      webchatEmbedUrl?: string | null;
      whatsappEnabled?: boolean;
      whatsappNumber?: string | null;
      whatsappFlowId?: string | null;
      identitySecret?: string;
    };

    const row = await prisma.shop.findUnique({ where: { shopDomain: shop } });
    if (!row) return reply.status(404).send({ error: 'Shop not found' });

    await upsertShopSettings(row.id, body);
    return reply.status(204).send();
  });
}
