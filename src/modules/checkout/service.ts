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

  const existing = await prisma.shopifyOrderPayment.findUnique({
    where: { shopId_shopifyOrderId: { shopId: shop.id, shopifyOrderId: orderId } },
  });

  if (existing) {
    switch (existing.status) {
      case 'pending':
      case 'processing': // in-flight — return the same session
        logger.info({ shopDomain, orderId, sessionId: existing.orangepillSessionId }, 'checkout_session_reused');
        return { redirectUrl: existing.checkoutUrl, sessionId: existing.orangepillSessionId };

      case 'paid':
        throw new Error(`Order ${orderId} is already paid`);

      case 'failed':
      case 'expired':
        // Retry: create a new OP session and update the existing row in-place
        return await refreshSession(shop.id, shopDomain, orderId, existing.id);
    }
  }

  // No existing row — create
  try {
    return await createSession(shop.id, shopDomain, orderId);
  } catch (err: unknown) {
    // Concurrent request won the insert race — return their session
    if ((err as { code?: string })?.code === 'P2002') {
      const concurrent = await prisma.shopifyOrderPayment.findUnique({
        where: { shopId_shopifyOrderId: { shopId: shop.id, shopifyOrderId: orderId } },
      });
      if (concurrent) {
        return { redirectUrl: concurrent.checkoutUrl, sessionId: concurrent.orangepillSessionId };
      }
    }
    throw err;
  }
}

async function buildAndCreateOPSession(
  shopDomain: string,
  orderId: string,
): Promise<{ checkout_url: string; id: string; amount: string; currency: string }> {
  const order = await fetchShopifyOrder(shopDomain, orderId);
  const session = await orangepillCheckoutClient.createCheckoutSession(
    mapOrderToSessionPayload(
      order,
      shopDomain,
      config.ORANGEPILL_MERCHANT_ID,
      `${config.APP_URL}/checkout/success`,
      `https://${shopDomain}`,
    ),
    `shopify:${shopDomain}:order:${orderId}:checkout`,
  );
  return session;
}

async function createSession(
  shopId: string,
  shopDomain: string,
  orderId: string,
): Promise<CreateSessionResult> {
  const session = await buildAndCreateOPSession(shopDomain, orderId);

  await prisma.shopifyOrderPayment.create({
    data: {
      shopId,
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

async function refreshSession(
  shopId: string,
  shopDomain: string,
  orderId: string,
  existingId: string,
): Promise<CreateSessionResult> {
  // Idempotency key must differ from the original attempt so OP creates a new session
  const retryKey = `shopify:${shopDomain}:order:${orderId}:checkout:retry:${Date.now()}`;
  const order = await fetchShopifyOrder(shopDomain, orderId);
  const session = await orangepillCheckoutClient.createCheckoutSession(
    mapOrderToSessionPayload(
      order,
      shopDomain,
      config.ORANGEPILL_MERCHANT_ID,
      `${config.APP_URL}/checkout/success`,
      `https://${shopDomain}`,
    ),
    retryKey,
  );

  await prisma.shopifyOrderPayment.update({
    where: { id: existingId },
    data: {
      orangepillSessionId: session.id,
      checkoutUrl: session.checkout_url,
      amount: session.amount,
      currency: session.currency,
      status: 'pending',
      shopifyTransactionId: null,
      orangepillPaymentId: null,
    },
  });

  logger.info({ shopDomain, orderId, sessionId: session.id }, 'checkout_session_refreshed');
  return { redirectUrl: session.checkout_url, sessionId: session.id };
}
