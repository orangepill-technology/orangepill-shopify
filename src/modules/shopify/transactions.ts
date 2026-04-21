import axios from 'axios';
import { config } from '../../config';
import { getShopAccessToken } from '../auth/service';
import { logger } from '../../logger';

export async function markOrderPaid(
  shopDomain: string,
  orderId: string,
  amount: string,
  currency: string,
): Promise<void> {
  const accessToken = await getShopAccessToken(shopDomain);
  if (!accessToken) throw new Error(`No access token for shop: ${shopDomain}`);

  await axios.post(
    `https://${shopDomain}/admin/api/${config.SHOPIFY_API_VERSION}/orders/${orderId}/transactions.json`,
    {
      transaction: {
        kind: 'capture',
        status: 'success',
        amount,
        currency,
      },
    },
    {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    },
  );

  logger.info({ shop: shopDomain, orderId, amount, currency }, 'shopify_order_marked_paid');
}
