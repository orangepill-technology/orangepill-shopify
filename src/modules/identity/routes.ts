import { FastifyInstance } from 'fastify';
import { prisma } from '../db/client';
import { generateIdentityToken } from './service';

// App Proxy route: GET /apps/orangepill/identity
// Shopify forwards ?shop=... and (if logged in) ?logged_in_customer_id=...
// plus an HMAC signature that Shopify's App Proxy middleware already verified upstream.
//
// Returns a short-lived HMAC-signed identity token — safe to pass to client JS
// because the HMAC secret never leaves the server.
export async function identityRoutes(app: FastifyInstance): Promise<void> {
  app.get('/apps/orangepill/identity', async (req, reply) => {
    const query = req.query as Record<string, string>;
    const shopDomain = query.shop;
    if (!shopDomain) return reply.status(400).send({ error: 'Missing shop' });

    const shopRow = await prisma.shop.findUnique({ where: { shopDomain } });
    if (!shopRow) return reply.status(404).send({ error: 'Shop not found' });

    // Shopify injects logged_in_customer_id when the visitor is authenticated.
    // All other customer fields come from the storefront JS via query params.
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
    return reply.send({ token });
  });
}
