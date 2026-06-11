import { config } from '../../config';
import { getShopSettings } from '../settings/service';

export interface ShopOrangepillConfig {
  apiUrl: string;
  apiKey: string;
  integrationId: string;
  merchantId: string;
  webhookSecret: string;
}

// Resolves the effective Orangepill config for a shop.
// Per-store ShopSettings values take precedence over global env vars,
// allowing different Shopify stores to map to different Orangepill tenants.
export async function resolveShopConfig(shopId: string): Promise<ShopOrangepillConfig> {
  const settings = await getShopSettings(shopId);
  return {
    apiUrl: settings.orangepillApiUrl ?? config.ORANGEPILL_API_URL,
    apiKey: settings.apiKey ?? config.ORANGEPILL_API_KEY,
    integrationId: settings.integrationId ?? config.ORANGEPILL_INTEGRATION_ID,
    merchantId: settings.merchantId ?? config.ORANGEPILL_MERCHANT_ID,
    webhookSecret: settings.webhookSecret ?? config.ORANGEPILL_WEBHOOK_SECRET,
  };
}
