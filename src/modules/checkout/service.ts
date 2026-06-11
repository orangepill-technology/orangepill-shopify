import { prisma } from '../db/client';
import { fetchShopifyOrder } from '../shopify/orders';
import { mapOrderToSessionPayload } from './mapper';
import { createOrangepillCheckoutClient } from '../orangepill/checkout-client';
import { resolveShopConfig } from '../config/shop-config';
import { upsertOrderAttribution } from '../attribution/service';
import { config } from '../../config';
import { logger } from '../../logger';

export interface CreateSessionResult {
  redirectUrl: string;     // Orangepill hosted checkout URL
  sessionId: string;
  amount: string;
  currency: string;
  orderAmount?: string | null;
  orderCurrency?: string | null;
}

export interface AttributionContext {
  conversationId: string | null;
  channelSessionId: string | null;
}

export async function createOrGetCheckoutSession(
  shopDomain: string,
  orderId: string,
  attribution: AttributionContext = { conversationId: null, channelSessionId: null },
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
      case 'processing':
        logger.info({ shopDomain, orderId, sessionId: existing.orangepillSessionId }, 'checkout_session_reused');
        return {
          redirectUrl: existing.checkoutUrl,
          sessionId: existing.orangepillSessionId,
          amount: existing.amount,
          currency: existing.currency,
          orderAmount: existing.orderAmount,
          orderCurrency: existing.orderCurrency,
        };

      case 'paid':
        throw new Error(`Order ${orderId} is already paid`);

      case 'failed':
      case 'expired':
        return await refreshSession(shop.id, shopDomain, orderId, existing.id);
    }
  }

  try {
    return await createSession(shop.id, shopDomain, orderId, attribution);
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === 'P2002') {
      const concurrent = await prisma.shopifyOrderPayment.findUnique({
        where: { shopId_shopifyOrderId: { shopId: shop.id, shopifyOrderId: orderId } },
      });
      if (concurrent) {
        return {
          redirectUrl: concurrent.checkoutUrl,
          sessionId: concurrent.orangepillSessionId,
          amount: concurrent.amount,
          currency: concurrent.currency,
          orderAmount: concurrent.orderAmount,
          orderCurrency: concurrent.orderCurrency,
        };
      }
    }
    throw err;
  }
}

// Returns stored payment display info without creating a new session.
export async function getPaymentDisplayInfo(
  shopDomain: string,
  orderId: string,
): Promise<{
  status: string;
  amount: string;
  currency: string;
  orderAmount?: string | null;
  orderCurrency?: string | null;
} | null> {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true },
  });
  if (!shop) return null;

  const payment = await prisma.shopifyOrderPayment.findUnique({
    where: { shopId_shopifyOrderId: { shopId: shop.id, shopifyOrderId: orderId } },
    select: { status: true, amount: true, currency: true, orderAmount: true, orderCurrency: true },
  });

  return payment;
}

function confirmingUrl(shopDomain: string, orderId: string): string {
  return `${config.APP_URL}/checkout/confirming?shop=${encodeURIComponent(shopDomain)}&orderId=${encodeURIComponent(orderId)}`;
}

async function buildAndCreateOPSession(
  shopId: string,
  shopDomain: string,
  orderId: string,
  idempotencyKey: string,
): Promise<{
  session: { checkout_url: string; id: string; amount: string; currency: string };
  order: { total_price: string; currency: string };
}> {
  const cfg = await resolveShopConfig(shopId);
  const checkoutClient = createOrangepillCheckoutClient(cfg);
  const order = await fetchShopifyOrder(shopDomain, orderId);
  const session = await checkoutClient.createCheckoutSession(
    mapOrderToSessionPayload(
      order,
      shopDomain,
      cfg.merchantId,
      confirmingUrl(shopDomain, orderId),
      `https://${shopDomain}`,
    ),
    idempotencyKey,
  );
  return { session, order };
}

async function createSession(
  shopId: string,
  shopDomain: string,
  orderId: string,
  attribution: AttributionContext = { conversationId: null, channelSessionId: null },
): Promise<CreateSessionResult> {
  const { session, order } = await buildAndCreateOPSession(
    shopId,
    shopDomain,
    orderId,
    `shopify:${shopDomain}:order:${orderId}:checkout`,
  );

  await prisma.shopifyOrderPayment.create({
    data: {
      shopId,
      shopifyOrderId: orderId,
      orangepillSessionId: session.id,
      checkoutUrl: session.checkout_url,
      amount: session.amount,
      currency: session.currency,
      orderAmount: order.total_price,
      orderCurrency: order.currency,
      conversationId: attribution.conversationId,
      channelSessionId: attribution.channelSessionId,
      status: 'pending',
    },
  });

  await upsertOrderAttribution(shopId, orderId, attribution.conversationId, attribution.channelSessionId, 'checkout_session');

  logger.info({ shopDomain, orderId, sessionId: session.id }, 'checkout_session_created');
  return {
    redirectUrl: session.checkout_url,
    sessionId: session.id,
    amount: session.amount,
    currency: session.currency,
    orderAmount: order.total_price,
    orderCurrency: order.currency,
  };
}

async function refreshSession(
  shopId: string,
  shopDomain: string,
  orderId: string,
  existingId: string,
): Promise<CreateSessionResult> {
  const retryKey = `shopify:${shopDomain}:order:${orderId}:checkout:retry:${Date.now()}`;
  const { session, order } = await buildAndCreateOPSession(shopId, shopDomain, orderId, retryKey);

  await prisma.shopifyOrderPayment.update({
    where: { id: existingId },
    data: {
      orangepillSessionId: session.id,
      checkoutUrl: session.checkout_url,
      amount: session.amount,
      currency: session.currency,
      orderAmount: order.total_price,
      orderCurrency: order.currency,
      status: 'pending',
      shopifyTransactionId: null,
      orangepillPaymentId: null,
    },
  });

  logger.info({ shopDomain, orderId, sessionId: session.id }, 'checkout_session_refreshed');
  return {
    redirectUrl: session.checkout_url,
    sessionId: session.id,
    amount: session.amount,
    currency: session.currency,
    orderAmount: order.total_price,
    orderCurrency: order.currency,
  };
}
