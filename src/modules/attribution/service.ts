import { prisma } from '../db/client';

export type AttributionSource = 'checkout_session' | 'agent' | 'manual';

export interface OrderAttribution {
  conversationId: string | null;
  channelSessionId: string | null;
  source: string;
}

export async function upsertOrderAttribution(
  shopId: string,
  shopifyOrderId: string,
  conversationId: string | null,
  channelSessionId: string | null,
  source: AttributionSource,
): Promise<void> {
  if (!conversationId && !channelSessionId) return;
  await prisma.shopifyOrderAttribution.upsert({
    where: { shopId_shopifyOrderId: { shopId, shopifyOrderId } },
    update: { conversationId, channelSessionId, source },
    create: { shopId, shopifyOrderId, conversationId, channelSessionId, source },
  });
}

export async function getOrderAttribution(
  shopId: string,
  shopifyOrderId: string,
): Promise<OrderAttribution | null> {
  const row = await prisma.shopifyOrderAttribution.findUnique({
    where: { shopId_shopifyOrderId: { shopId, shopifyOrderId } },
    select: { conversationId: true, channelSessionId: true, source: true },
  });
  return row;
}
