import { mapOrderToSessionPayload } from '../../modules/checkout/mapper';

const SHOP = 'store.myshopify.com';
const MERCHANT_ID = '00000000-0000-0000-0000-000000000002';
const SUCCESS_URL = 'https://app.example.com/checkout/success';
const CANCEL_URL = 'https://store.myshopify.com';

describe('mapOrderToSessionPayload', () => {
  it('maps a full order correctly', () => {
    const order = {
      id: 12345,
      total_price: '75.00',
      currency: 'COP',
      email: 'buyer@example.com',
      phone: '+573001234567',
      customer: { id: 9 },
    };

    const result = mapOrderToSessionPayload(order, SHOP, MERCHANT_ID, SUCCESS_URL, CANCEL_URL);

    expect(result).toEqual({
      merchant_id: MERCHANT_ID,
      amount: '75.00',
      currency: 'COP',
      order_reference: `shopify:${SHOP}:order:12345`,
      success_url: SUCCESS_URL,
      cancel_url: CANCEL_URL,
      customer: { email: 'buyer@example.com', phone: '+573001234567' },
      metadata: { channel: 'shopify', shop_domain: SHOP, order_id: '12345' },
    });
  });

  it('omits customer block for guest orders with no email or phone', () => {
    const order = { id: 1, total_price: '10.00', currency: 'USD', email: null, phone: null };
    const result = mapOrderToSessionPayload(order, SHOP, MERCHANT_ID, SUCCESS_URL, CANCEL_URL);
    expect(result.customer).toBeUndefined();
  });

  it('includes customer block when only email is present', () => {
    const order = { id: 2, total_price: '20.00', currency: 'EUR', email: 'a@b.com', phone: null };
    const result = mapOrderToSessionPayload(order, SHOP, MERCHANT_ID, SUCCESS_URL, CANCEL_URL);
    expect(result.customer).toEqual({ email: 'a@b.com' });
  });

  it('passes amount as-is in major units (no cents conversion)', () => {
    const order = { id: 3, total_price: '150.99', currency: 'USD', email: null, phone: null };
    const result = mapOrderToSessionPayload(order, SHOP, MERCHANT_ID, SUCCESS_URL, CANCEL_URL);
    expect(result.amount).toBe('150.99');
  });

  it('sets channel to shopify', () => {
    const order = { id: 4, total_price: '1.00', currency: 'USD', email: null, phone: null };
    const result = mapOrderToSessionPayload(order, SHOP, MERCHANT_ID, SUCCESS_URL, CANCEL_URL);
    expect(result.metadata.channel).toBe('shopify');
  });
});
