import { FastifyInstance } from 'fastify';
import { prisma } from '../db/client';
import { getShopSettings } from '../settings/service';
import { buildStorefrontScript } from './service';

export async function storefrontRoutes(app: FastifyInstance): Promise<void> {
  // Serves the per-shop storefront JS. Injected via Shopify Script Tag.
  // Cache headers allow Shopify CDN to cache it but revalidate hourly.
  app.get('/storefront/script.js', async (req, reply) => {
    const query = req.query as Record<string, string>;
    const shopDomain = query.shop;
    if (!shopDomain) return reply.status(400).send('Missing shop');

    const shopRow = await prisma.shop.findUnique({ where: { shopDomain } });
    if (!shopRow) return reply.status(404).send('Shop not found');

    const settings = await getShopSettings(shopRow.id);
    const script = buildStorefrontScript(shopDomain, settings);

    return reply
      .header('Content-Type', 'application/javascript; charset=utf-8')
      .header('Cache-Control', 'public, max-age=3600')
      .send(script);
  });
}
