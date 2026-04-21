import axios, { AxiosInstance } from 'axios';
import { config } from '../../config';
import type { OrangepillEvent } from './types';

export interface EmitResult {
  success: boolean;
  status?: number;
  error?: string;
}

export class OrangepillClient {
  private readonly http: AxiosInstance;
  private readonly integrationId: string;

  constructor() {
    this.integrationId = config.ORANGEPILL_INTEGRATION_ID;
    this.http = axios.create({
      baseURL: config.ORANGEPILL_API_URL,
      headers: {
        Authorization: `Bearer ${config.ORANGEPILL_API_KEY}`,
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

export const orangepillClient = new OrangepillClient();
