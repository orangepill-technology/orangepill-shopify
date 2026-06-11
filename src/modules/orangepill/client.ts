import axios, { AxiosInstance } from 'axios';
import { config } from '../../config';
import type { ShopOrangepillConfig } from '../config/shop-config';
import type { OrangepillEvent } from './types';

export interface EmitResult {
  success: boolean;
  status?: number;
  error?: string;
}

export class OrangepillClient {
  private readonly http: AxiosInstance;
  private readonly integrationId: string;

  constructor(cfg: ShopOrangepillConfig) {
    this.integrationId = cfg.integrationId;
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

  async emitEvent(event: OrangepillEvent, idempotencyKey: string): Promise<EmitResult> {
    try {
      const response = await this.http.post(
        `/v4/commerce/integrations/${this.integrationId}/events`,
        event,
        { headers: { 'Idempotency-Key': idempotencyKey } },
      );
      return { success: true, status: response.status };
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const status = axiosErr?.response?.status;
      const error = axiosErr?.response?.data?.message ?? axiosErr?.message ?? 'Unknown error';
      return { success: false, status, error };
    }
  }
}

export function createOrangepillClient(cfg: ShopOrangepillConfig): OrangepillClient {
  return new OrangepillClient(cfg);
}

// Global-config singleton kept for tests and non-per-store contexts.
export const orangepillClient = new OrangepillClient({
  apiUrl: config.ORANGEPILL_API_URL,
  apiKey: config.ORANGEPILL_API_KEY,
  integrationId: config.ORANGEPILL_INTEGRATION_ID,
  merchantId: config.ORANGEPILL_MERCHANT_ID,
  webhookSecret: config.ORANGEPILL_WEBHOOK_SECRET,
});
