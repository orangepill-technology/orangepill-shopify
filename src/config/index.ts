import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),

  SHOPIFY_API_KEY: z.string().min(1),
  SHOPIFY_API_SECRET: z.string().min(1),
  SHOPIFY_SCOPES: z.string().default('read_orders,read_customers'),
  SHOPIFY_API_VERSION: z.string().default('2024-01'),
  APP_URL: z.string().url(),

  DATABASE_URL: z.string().min(1),
  ENCRYPTION_KEY: z.string().min(32),

  ORANGEPILL_API_URL: z.string().url(),
  ORANGEPILL_API_KEY: z.string().min(1),
  ORANGEPILL_INTEGRATION_ID: z.string().min(1),
  ORANGEPILL_MERCHANT_ID: z.string().min(1),
  ORANGEPILL_WEBHOOK_SECRET: z.string().min(1),
});

export type Config = z.infer<typeof schema>;

export const config = schema.parse(process.env);
