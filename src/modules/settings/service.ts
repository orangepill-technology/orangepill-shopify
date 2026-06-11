import { prisma } from '../db/client';
import { encrypt, decrypt } from '../auth/crypto';

export interface ShopSettingsData {
  // Orangepill integration credentials (decrypted where applicable)
  integrationId: string | null;
  merchantId: string | null;
  apiKey: string | null;         // decrypted; never return over the wire
  orangepillApiUrl: string | null;
  webhookSecret: string | null;  // decrypted; never return over the wire
  // Conversational commerce
  webchatEnabled: boolean;
  webchatEntrypointId: string | null;
  webchatEmbedUrl: string | null;
  whatsappEnabled: boolean;
  whatsappNumber: string | null;
  whatsappFlowId: string | null;
  whatsappStickyEnabled: boolean;
  identitySecret: string | null; // decrypted; never return over the wire
}

const EMPTY_SETTINGS: ShopSettingsData = {
  integrationId: null,
  merchantId: null,
  apiKey: null,
  orangepillApiUrl: null,
  webhookSecret: null,
  webchatEnabled: false,
  webchatEntrypointId: null,
  webchatEmbedUrl: null,
  whatsappEnabled: false,
  whatsappNumber: null,
  whatsappFlowId: null,
  whatsappStickyEnabled: false,
  identitySecret: null,
};

export async function getShopSettings(shopId: string): Promise<ShopSettingsData> {
  const row = await prisma.shopSettings.findUnique({ where: { shopId } });
  if (!row) return { ...EMPTY_SETTINGS };
  return {
    integrationId: row.integrationId,
    merchantId: row.merchantId,
    apiKey: row.apiKey ? decrypt(row.apiKey) : null,
    orangepillApiUrl: row.orangepillApiUrl,
    webhookSecret: row.webhookSecret ? decrypt(row.webhookSecret) : null,
    webchatEnabled: row.webchatEnabled,
    webchatEntrypointId: row.webchatEntrypointId,
    webchatEmbedUrl: row.webchatEmbedUrl,
    whatsappEnabled: row.whatsappEnabled,
    whatsappNumber: row.whatsappNumber,
    whatsappFlowId: row.whatsappFlowId,
    whatsappStickyEnabled: row.whatsappStickyEnabled,
    identitySecret: row.identitySecret ? decrypt(row.identitySecret) : null,
  };
}

type UpsertInput = Partial<Omit<ShopSettingsData, 'identitySecret' | 'apiKey' | 'webhookSecret'> & {
  identitySecret?: string;
  apiKey?: string | null;
  webhookSecret?: string | null;
}>;

export async function upsertShopSettings(shopId: string, data: UpsertInput): Promise<void> {
  const update: Record<string, unknown> = {};
  if (data.integrationId !== undefined) update.integrationId = data.integrationId;
  if (data.merchantId !== undefined) update.merchantId = data.merchantId;
  if (data.apiKey !== undefined) update.apiKey = data.apiKey ? encrypt(data.apiKey) : null;
  if (data.orangepillApiUrl !== undefined) update.orangepillApiUrl = data.orangepillApiUrl;
  if (data.webhookSecret !== undefined) update.webhookSecret = data.webhookSecret ? encrypt(data.webhookSecret) : null;
  if (data.webchatEnabled !== undefined) update.webchatEnabled = data.webchatEnabled;
  if (data.webchatEntrypointId !== undefined) update.webchatEntrypointId = data.webchatEntrypointId;
  if (data.webchatEmbedUrl !== undefined) update.webchatEmbedUrl = data.webchatEmbedUrl;
  if (data.whatsappEnabled !== undefined) update.whatsappEnabled = data.whatsappEnabled;
  if (data.whatsappNumber !== undefined) update.whatsappNumber = data.whatsappNumber;
  if (data.whatsappFlowId !== undefined) update.whatsappFlowId = data.whatsappFlowId;
  if (data.whatsappStickyEnabled !== undefined) update.whatsappStickyEnabled = data.whatsappStickyEnabled;
  if (data.identitySecret !== undefined) update.identitySecret = data.identitySecret ? encrypt(data.identitySecret) : null;

  await prisma.shopSettings.upsert({
    where: { shopId },
    update,
    create: { shopId, ...update },
  });
}
