import { mapOrderFinalized, mapOrderRefunded } from '../../modules/orangepill/mapper';

const SHOP = 'example.myshopify.com';

describe('mapOrderFinalized', () => {
  it('maps a complete order correctly', () => {
    const order = {
      id: 12345,
      total_price: '99.99',
      currency: 'USD',
      email: 'buyer@example.com',
      phone: '+385911234567',
      customer: { id: 67890 },
    };
    expect(mapOrderFinalized(order, SHOP)).toEqual({
      event: 'order.finalized',
      shopify_order_id: 12345,
      status: 'paid',
      order_total: '99.99',
      currency: 'USD',
      customer: {
        email: 'buyer@example.com',
        phone: '+385911234567',
        shopify_customer_id: 67890,
      },
      metadata: { channel: 'shopify', shop_domain: SHOP, conversation_id: null, channel_session_id: null },
    });
  });

  it('handles guest order (no customer, null email/phone)', () => {
    const order = {
      id: 99,
      total_price: '10.00',
      currency: 'EUR',
      email: null,
      phone: null,
      customer: null,
    };
    const result = mapOrderFinalized(order, SHOP);
    expect(result.customer).toEqual({
      email: null,
      phone: null,
      shopify_customer_id: null,
    });
  });

  it('always sets status to paid', () => {
    const order = {
      id: 1,
      total_price: '1.00',
      currency: 'USD',
      email: null,
      phone: null,
    };
    expect(mapOrderFinalized(order, SHOP).status).toBe('paid');
  });

  it('always sets channel to shopify', () => {
    const order = { id: 1, total_price: '1.00', currency: 'USD', email: null, phone: null };
    expect(mapOrderFinalized(order, SHOP).metadata.channel).toBe('shopify');
  });
});

describe('mapOrderRefunded', () => {
  it('maps refund with transaction correctly', () => {
    const refund = {
      id: 55555,
      order_id: 12345,
      transactions: [{ amount: '25.50', currency: 'USD' }],
    };
    expect(mapOrderRefunded(refund, SHOP)).toEqual({
      event: 'order.refunded',
      shopify_order_id: 12345,
      refund_id: 55555,
      refund_amount: '25.50',
      currency: 'USD',
      metadata: { channel: 'shopify', shop_domain: SHOP },
    });
  });

  it('falls back to zero amount when transactions are empty', () => {
    const refund = { id: 1, order_id: 2, transactions: [] };
    const result = mapOrderRefunded(refund, SHOP);
    expect(result.refund_amount).toBe('0');
    expect(result.currency).toBe('USD');
  });
});
