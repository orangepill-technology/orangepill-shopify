export interface OrderFinalizedEvent {
  event: 'order.finalized';
  shopify_order_id: number;
  status: 'paid';
  order_total: string;
  currency: string;
  customer: {
    email: string | null;
    phone: string | null;
    shopify_customer_id: number | null;
  };
  metadata: {
    channel: 'shopify';
    shop_domain: string;
  };
}

export interface OrderRefundedEvent {
  event: 'order.refunded';
  shopify_order_id: number;
  refund_id: number;
  refund_amount: string;
  currency: string;
  metadata: {
    channel: 'shopify';
    shop_domain: string;
  };
}

export type OrangepillEvent = OrderFinalizedEvent | OrderRefundedEvent;

// Minimal Shopify webhook payload shapes
export interface ShopifyOrder {
  id: number;
  total_price: string;
  currency: string;
  email: string | null;
  phone: string | null;
  customer?: { id: number } | null;
}

export interface ShopifyRefund {
  id: number;
  order_id: number;
  transactions: Array<{
    amount: string;
    currency: string;
  }>;
}
