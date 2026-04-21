import { prisma } from '../db/client';
import { fetchShopifyOrder } from '../shopify/orders';
import { mapOrderToSessionPayload } from './mapper';
import { orangepillCheckoutClient } from '../orangepill/checkout-client';
import { config } from '../../config';
import { logger } from '../../logger';

export interface CreateSessionResult {
  redirectUrl: string;
  sessionId: string;
}

export async function createOrGetCheckoutSession(
  shopDomain: string,
  orderId: string,
): Promise<CreateSessionResult> {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true, uninstalledAt: true },
  });
  if (!shop || shop.uninstalledAt) throw new Error(`Shop not found or inactive: ${shopDomain}`);

  // Return existing pending session rather than creating a duplicate.
  // Failed/expired sessions are left in place so a new attempt can be made.
  const existing = await prisma.shopifyOrderPayment.findFirst({
    where: { shopId: shop.id, shopifyOrderId: orderId, status: 'pending' },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    logger.info({ shopDomain, orderId, sessionId: existing.orangepillSessionId }, 'checkout_session_reused');
    return { redirectUrl: existing.checkoutUrl, sessionId: existing.orangepillSessionId };
  }

  const order = await fetchShopifyOrder(shopDomain, orderId);

  const successUrl = `${config.APP_URL}/checkout/success`;
  const cancelUrl = `https://${shopDomain}`;
  const idempotencyKey = `shopify:${shopDomain}:order:${orderId}:checkout`;

  const payload = mapOrderToSessionPayload(
    order,
    shopDomain,
    config.ORANGEPILL_MERCHANT_ID,
    successUrl,
    cancelUrl,
  );

  const session = await orangepillCheckoutClient.createCheckoutSession(payload, idempotencyKey);

  await prisma.shopifyOrderPayment.create({
    data: {
      shopId: shop.id,
      shopifyOrderId: orderId,
      orangepillSessionId: session.id,
      checkoutUrl: session.checkout_url,
      amount: session.amount,
      currency: session.currency,
      status: 'pending',
    },
  });

  logger.info({ shopDomain, orderId, sessionId: session.id }, 'checkout_session_created');

  return { redirectUrl: session.checkout_url, sessionId: session.id };
}
