import axios from 'axios';
import { config } from '../../config';
import { hmacSha256Hex, timingSafeStringEqual, encrypt, decrypt } from './crypto';
import { prisma } from '../db/client';
import { logger } from '../../logger';

const REDIRECT_URI = `${config.APP_URL}/auth/callback`;

export function buildInstallUrl(shop: string): string {
  const state = generateState(shop);
  const params = new URLSearchParams({
    client_id: config.SHOPIFY_API_KEY,
    scope: config.SHOPIFY_SCOPES,
    redirect_uri: REDIRECT_URI,
    state,
  });
  return `https://${shop}/admin/oauth/authorize?${params}`;
}

// State is a base64url-encoded `shop:timestamp:hmac` triple.
// Expires after 10 minutes to prevent replay of the OAuth nonce.
function generateState(shop: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `${shop}:${timestamp}`;
  const sig = hmacSha256Hex(message, config.SHOPIFY_API_SECRET);
  return Buffer.from(`${message}:${sig}`).toString('base64url');
}

export function validateState(state: string, shop: string): boolean {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const colonIdx = decoded.lastIndexOf(':');
    if (colonIdx === -1) return false;
    const sig = decoded.slice(colonIdx + 1);
    const message = decoded.slice(0, colonIdx);
    const [statShop, timestamp] = message.split(':');
    if (statShop !== shop) return false;
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts) || Math.floor(Date.now() / 1000) - ts > 600) return false;
    const expected = hmacSha256Hex(message, config.SHOPIFY_API_SECRET);
    return timingSafeStringEqual(sig, expected);
  } catch {
    return false;
  }
}

// Shopify signs the OAuth callback query params (excluding hmac) with hex HMAC-SHA256.
export function validateOAuthHmac(query: Record<string, string>): boolean {
  const { hmac, ...rest } = query;
  if (!hmac) return false;
  const message = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join('&');
  const expected = hmacSha256Hex(message, config.SHOPIFY_API_SECRET);
  return timingSafeStringEqual(hmac, expected);
}

export function isValidShopDomain(shop: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop);
}

export async function exchangeCodeForToken(shop: string, code: string): Promise<string> {
  const response = await axios.post<{ access_token: string }>(
    `https://${shop}/admin/oauth/access_token`,
    {
      client_id: config.SHOPIFY_API_KEY,
      client_secret: config.SHOPIFY_API_SECRET,
      code,
    },
  );
  return response.data.access_token;
}

export async function installShop(shop: string, code: string): Promise<void> {
  const accessToken = await exchangeCodeForToken(shop, code);
  const encryptedToken = encrypt(accessToken);

  await prisma.shop.upsert({
    where: { shopDomain: shop },
    update: {
      accessToken: encryptedToken,
      installedAt: new Date(),
      uninstalledAt: null,
    },
    create: {
      shopDomain: shop,
      accessToken: encryptedToken,
    },
  });

  logger.info({ shop }, 'shop_installed');
}

export async function uninstallShop(shopDomain: string): Promise<void> {
  await prisma.shop.updateMany({
    where: { shopDomain },
    data: { uninstalledAt: new Date() },
  });
  logger.info({ shop: shopDomain }, 'shop_uninstalled');
}

export async function getShopAccessToken(shopDomain: string): Promise<string | null> {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { accessToken: true, uninstalledAt: true },
  });
  if (!shop || shop.uninstalledAt) return null;
  return decrypt(shop.accessToken);
}
