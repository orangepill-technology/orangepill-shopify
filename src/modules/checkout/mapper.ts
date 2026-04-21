import type { ShopifyOrder } from '../orangepill/types';

export interface CheckoutSessionPayload {
  merchant_id: string;
  amount: string;           // major currency units, decimal string — e.g. "75.00"
  currency: string;         // ISO-4217
  order_reference: string;
  success_url: string;
  cancel_url: string;
  customer?: {
    email?: string;
    phone?: string;
  };
  metadata: {
    channel: 'shopify';
    shop_domain: string;
    order_id: string;
  };
}

export function mapOrderToSessionPayload(
  order: ShopifyOrder,
  shopDomain: string,
  merchantId: string,
  successUrl: string,
  cancelUrl: string,
): CheckoutSessionPayload {
  const payload: CheckoutSessionPayload = {
    merchant_id: merchantId,
    amount: order.total_price,
    currency: order.currency,
    order_reference: `shopify:${shopDomain}:order:${order.id}`,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      channel: 'shopify',
      shop_domain: shopDomain,
      order_id: String(order.id),
    },
  };

  if (order.email || order.phone) {
    payload.customer = {
      ...(order.email ? { email: order.email } : {}),
      ...(order.phone ? { phone: order.phone } : {}),
    };
  }

  return payload;
}
