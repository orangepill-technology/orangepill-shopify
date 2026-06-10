import { prisma } from '../db/client';
import { encrypt, decrypt } from '../auth/crypto';

export interface ShopSettingsData {
  webchatEnabled: boolean;
  webchatEntrypointId: string | null;
  webchatEmbedUrl: string | null;
  whatsappEnabled: boolean;
  whatsappNumber: string | null;
  whatsappFlowId: string | null;
  identitySecret: string | null; // plaintext, decrypted
}

export async function getShopSettings(shopId: string): Promise<ShopSettingsData> {
  const row = await prisma.shopSettings.findUnique({ where: { shopId } });
  if (!row) {
    return {
      webchatEnabled: false,
      webchatEntrypointId: null,
      webchatEmbedUrl: null,
      whatsappEnabled: false,
      whatsappNumber: null,
      whatsappFlowId: null,
      identitySecret: null,
    };
  }
  return {
    webchatEnabled: row.webchatEnabled,
    webchatEntrypointId: row.webchatEntrypointId,
    webchatEmbedUrl: row.webchatEmbedUrl,
    whatsappEnabled: row.whatsappEnabled,
    whatsappNumber: row.whatsappNumber,
    whatsappFlowId: row.whatsappFlowId,
    identitySecret: row.identitySecret ? decrypt(row.identitySecret) : null,
  };
}

export async function upsertShopSettings(
  shopId: string,
  data: Partial<Omit<ShopSettingsData, 'identitySecret'> & { identitySecret?: string }>,
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (data.webchatEnabled !== undefined) update.webchatEnabled = data.webchatEnabled;
  if (data.webchatEntrypointId !== undefined) update.webchatEntrypointId = data.webchatEntrypointId;
  if (data.webchatEmbedUrl !== undefined) update.webchatEmbedUrl = data.webchatEmbedUrl;
  if (data.whatsappEnabled !== undefined) update.whatsappEnabled = data.whatsappEnabled;
  if (data.whatsappNumber !== undefined) update.whatsappNumber = data.whatsappNumber;
  if (data.whatsappFlowId !== undefined) update.whatsappFlowId = data.whatsappFlowId;
  if (data.identitySecret !== undefined) {
    update.identitySecret = data.identitySecret ? encrypt(data.identitySecret) : null;
  }

  await prisma.shopSettings.upsert({
    where: { shopId },
    update,
    create: { shopId, ...update },
  });
}
