import axios, { AxiosInstance } from 'axios';
import { config } from '../../config';
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

  constructor() {
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

export const orangepillCheckoutClient = new OrangepillCheckoutClient();
