// Set env vars before any module is imported in tests
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.HOST = '0.0.0.0';
process.env.SHOPIFY_API_KEY = 'test-shopify-api-key';
process.env.SHOPIFY_API_SECRET = 'test-shopify-api-secret';
process.env.SHOPIFY_SCOPES = 'read_orders,read_customers';
process.env.SHOPIFY_API_VERSION = '2024-01';
process.env.APP_URL = 'https://test.example.com';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.ENCRYPTION_KEY = 'test-encryption-key-must-be-32-chars!';
process.env.ORANGEPILL_API_URL = 'https://api.orangepill.cloud';
process.env.ORANGEPILL_API_KEY = 'test-orangepill-api-key';
process.env.ORANGEPILL_INTEGRATION_ID = '00000000-0000-0000-0000-000000000001';
process.env.ORANGEPILL_MERCHANT_ID = '00000000-0000-0000-0000-000000000002';
process.env.ORANGEPILL_WEBHOOK_SECRET = 'test-orangepill-webhook-secret';
process.env.ADMIN_API_KEY = 'test-admin-api-key-16c';
