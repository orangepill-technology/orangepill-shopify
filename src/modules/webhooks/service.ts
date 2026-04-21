import axios from 'axios';
import { config } from '../../config';
import { getShopAccessToken } from '../auth/service';
import { prisma } from '../db/client';
import { logger } from '../../logger';

const TOPICS = ['orders/create', 'orders/paid', 'refunds/create', 'app/uninstalled'] as const;
type WebhookTopic = (typeof TOPICS)[number];

const WEBHOOK_ENDPOINT = `${config.APP_URL}/webhooks/shopify`;

interface ShopifyWebhookResponse {
  webhook: { id: number; topic: string; address: string };
}

export async function registerWebhooks(shopDomain: string): Promise<void> {
  const accessToken = await getShopAccessToken(shopDomain);
  if (!accessToken) throw new Error(`No access token for shop: ${shopDomain}`);

  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true },
  });
  if (!shop) throw new Error(`Shop not found: ${shopDomain}`);

  for (const topic of TOPICS) {
    await registerWebhook(shopDomain, shop.id, topic, accessToken);
  }
}

async function registerWebhook(
  shopDomain: string,
  shopId: string,
  topic: WebhookTopic,
  accessToken: string,
): Promise<void> {
  try {
    const response = await axios.post<ShopifyWebhookResponse>(
      `https://${shopDomain}/admin/api/${config.SHOPIFY_API_VERSION}/webhooks.json`,
      { webhook: { topic, address: WEBHOOK_ENDPOINT, format: 'json' } },
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      },
    );

    await prisma.shopifyWebhook.upsert({
      where: { shopId_topic: { shopId, topic } },
      update: {
        endpoint: WEBHOOK_ENDPOINT,
        shopifyId: String(response.data.webhook.id),
      },
      create: {
        shopId,
        topic,
        endpoint: WEBHOOK_ENDPOINT,
        shopifyId: String(response.data.webhook.id),
      },
    });

    logger.info({ shop: shopDomain, topic }, 'webhook_registered');
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    // 422 = webhook already exists in Shopify — not a failure
    if (status === 422) {
      logger.info({ shop: shopDomain, topic }, 'webhook_already_exists');
      return;
    }
    logger.error({ err, shop: shopDomain, topic }, 'webhook_registration_failed');
    throw err;
  }
}
