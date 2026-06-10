import { hmacSha256Hex } from '../auth/crypto';
import { getShopSettings } from '../settings/service';
import { config } from '../../config';

export interface IdentityTokenPayload {
  shopDomain: string;
  customerId: string | null;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  isAnonymous: boolean;
  iat: number;
  exp: number;
}

const TTL_SECONDS = 3600; // 1 hour

async function resolveSecret(shopId: string): Promise<string> {
  const settings = await getShopSettings(shopId);
  if (settings.identitySecret) return settings.identitySecret;
  if (config.IDENTITY_SECRET) return config.IDENTITY_SECRET;
  throw new Error('No identity secret configured for shop and no global fallback set');
}

export async function generateIdentityToken(
  shopId: string,
  shopDomain: string,
  customer: {
    id?: string | null;
    email?: string | null;
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: IdentityTokenPayload = {
    shopDomain,
    customerId: customer?.id ?? null,
    email: customer?.email ?? null,
    phone: customer?.phone ?? null,
    firstName: customer?.firstName ?? null,
    lastName: customer?.lastName ?? null,
    isAnonymous: !customer?.id,
    iat: now,
    exp: now + TTL_SECONDS,
  };

  const secret = await resolveSecret(shopId);
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = hmacSha256Hex(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

export function decodeIdentityToken(token: string): IdentityTokenPayload | null {
  const dot = token.lastIndexOf('.');
  if (dot === -1) return null;
  try {
    return JSON.parse(Buffer.from(token.slice(0, dot), 'base64').toString('utf8')) as IdentityTokenPayload;
  } catch {
    return null;
  }
}
