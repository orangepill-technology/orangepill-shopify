import axios from 'axios';
import { config } from '../../config';
import { getShopAccessToken } from '../auth/service';
import type { ShopifyOrder } from '../orangepill/types';

export async function fetchShopifyOrder(shopDomain: string, orderId: string): Promise<ShopifyOrder> {
  const accessToken = await getShopAccessToken(shopDomain);
  if (!accessToken) throw new Error(`No access token for shop: ${shopDomain}`);

  const response = await axios.get<{ order: ShopifyOrder }>(
    `https://${shopDomain}/admin/api/${config.SHOPIFY_API_VERSION}/orders/${orderId}.json`,
    { headers: { 'X-Shopify-Access-Token': accessToken } },
  );
  return response.data.order;
}
