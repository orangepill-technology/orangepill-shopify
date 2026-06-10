import { FastifyInstance } from 'fastify';
import { prisma } from '../db/client';
import { generateIdentityToken } from './service';
import { getShopSettings } from '../settings/service';

// App Proxy routes: /apps/orangepill/...
// Shopify verifies the HMAC signature before forwarding requests here,
// so these endpoints are safe to call from storefront JS.
export async function identityRoutes(app: FastifyInstance): Promise<void> {
  // GET /apps/orangepill/identity
  // Returns a short-lived HMAC-signed identity token.
  // The HMAC secret never leaves the server.
  app.get('/apps/orangepill/identity', async (req, reply) => {
    const query = req.query as Record<string, string>;
    const shopDomain = query.shop;
    if (!shopDomain) return reply.status(400).send({ error: 'Missing shop' });

    const shopRow = await prisma.shop.findUnique({ where: { shopDomain } });
    if (!shopRow) return reply.status(404).send({ error: 'Shop not found' });

    const customerId = query.logged_in_customer_id ?? null;
    const customer = customerId
      ? {
          id: customerId,
          email: query.email ?? null,
          phone: query.phone ?? null,
          firstName: query.first_name ?? null,
          lastName: query.last_name ?? null,
        }
      : null;

    const token = await generateIdentityToken(shopRow.id, shopDomain, customer);
    return reply
      .header('Cache-Control', 'no-store')
      .send({ token });
  });

  // GET /apps/orangepill/settings
  // Returns the public (non-secret) shop configuration for the storefront JS.
  // Only exposes what the JS actually needs — secrets never sent.
  app.get('/apps/orangepill/settings', async (req, reply) => {
    const query = req.query as Record<string, string>;
    const shopDomain = query.shop;
    if (!shopDomain) return reply.status(400).send({ error: 'Missing shop' });

    const shopRow = await prisma.shop.findUnique({ where: { shopDomain } });
    if (!shopRow) return reply.status(404).send({ error: 'Shop not found' });

    const settings = await getShopSettings(shopRow.id);
    return reply
      .header('Cache-Control', 'public, max-age=60')
      .send({
        webchatEnabled: settings.webchatEnabled,
        webchatEntrypointId: settings.webchatEntrypointId,
        webchatEmbedUrl: settings.webchatEmbedUrl,
        whatsappEnabled: settings.whatsappEnabled,
        whatsappNumber: settings.whatsappNumber,
        whatsappFlowId: settings.whatsappFlowId,
        // identitySecret intentionally omitted
      });
  });
}
