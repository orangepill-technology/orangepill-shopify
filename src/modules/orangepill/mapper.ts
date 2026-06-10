import type { ShopifyOrder, ShopifyRefund, OrderFinalizedEvent, OrderRefundedEvent } from './types';

export function mapOrderFinalized(
  order: ShopifyOrder,
  shopDomain: string,
  attribution?: { conversationId?: string | null; channelSessionId?: string | null } | null,
): OrderFinalizedEvent {
  return {
    event: 'order.finalized',
    shopify_order_id: order.id,
    status: 'paid',
    order_total: order.total_price,
    currency: order.currency,
    customer: {
      email: order.email ?? null,
      phone: order.phone ?? null,
      shopify_customer_id: order.customer?.id ?? null,
    },
    metadata: {
      channel: 'shopify',
      shop_domain: shopDomain,
      conversation_id: attribution?.conversationId ?? null,
      channel_session_id: attribution?.channelSessionId ?? null,
    },
  };
}

export function mapOrderRefunded(refund: ShopifyRefund, shopDomain: string): OrderRefundedEvent {
  const tx = refund.transactions[0];
  return {
    event: 'order.refunded',
    shopify_order_id: refund.order_id,
    refund_id: refund.id,
    refund_amount: tx?.amount ?? '0',
    currency: tx?.currency ?? 'USD',
    metadata: {
      channel: 'shopify',
      shop_domain: shopDomain,
    },
  };
}
