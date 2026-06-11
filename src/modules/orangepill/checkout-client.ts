import axios, { AxiosInstance } from 'axios';
import { config } from '../../config';
import type { ShopOrangepillConfig } from '../config/shop-config';
import type { CheckoutSessionPayload } from '../checkout/mapper';

export interface CheckoutSessionResponse {
  id: string;
  checkout_url: string;
  client_secret: string;
  amount: string;
  currency: string;
  status: string;
  order_reference: string | null;
}

export class OrangepillCheckoutClient {
  private readonly http: AxiosInstance;

  constructor(cfg: ShopOrangepillConfig) {
    this.http = axios.create({
      baseURL: cfg.apiUrl,
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'orangepill-shopify-app/0.1.0',
      },
      timeout: 10_000,
    });
  }

  async createCheckoutSession(
    payload: CheckoutSessionPayload,
    idempotencyKey: string,
  ): Promise<CheckoutSessionResponse> {
    const response = await this.http.post<CheckoutSessionResponse>(
      '/v4/checkout/sessions',
      payload,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
    return response.data;
  }
}

export function createOrangepillCheckoutClient(cfg: ShopOrangepillConfig): OrangepillCheckoutClient {
  return new OrangepillCheckoutClient(cfg);
}

// Global-config singleton kept for tests and non-per-store contexts.
export const orangepillCheckoutClient = new OrangepillCheckoutClient({
  apiUrl: config.ORANGEPILL_API_URL,
  apiKey: config.ORANGEPILL_API_KEY,
  integrationId: config.ORANGEPILL_INTEGRATION_ID,
  merchantId: config.ORANGEPILL_MERCHANT_ID,
  webhookSecret: config.ORANGEPILL_WEBHOOK_SECRET,
});
