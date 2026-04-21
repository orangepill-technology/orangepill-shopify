import { prisma } from '../db/client';
import { config } from '../../config';
import { logger } from '../../logger';
import type { OrangepillEvent } from '../orangepill/types';

export interface JournalEntry {
  id: string;
  shopId: string;
  direction: string;
  eventType: string;
  resourceId: string;
  payloadJson: unknown;
  endpoint: string;
  idempotencyKey: string;
  status: string;
  attemptCount: number;
  lastError?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ENDPOINT = `${config.ORANGEPILL_API_URL}/v4/commerce/integrations/${config.ORANGEPILL_INTEGRATION_ID}/events`;

export async function recordEvent(
  shopId: string,
  eventType: 'order.finalized' | 'order.refunded',
  resourceId: string,
  payload: OrangepillEvent,
  idempotencyKey: string,
): Promise<{ entry: JournalEntry; isNew: boolean }> {
  try {
    const entry = await prisma.shopifySyncEvent.create({
      data: {
        shopId,
        direction: 'shopify_to_op',
        eventType,
        resourceId,
        payloadJson: payload as object,
        endpoint: ENDPOINT,
        idempotencyKey,
        status: 'pending',
      },
    });
    logger.info({ id: entry.id, eventType, idempotencyKey }, 'event_recorded');
    return { entry: entry as JournalEntry, isNew: true };
  } catch (err: unknown) {
    // Prisma unique constraint violation: P2002
    if ((err as { code?: string })?.code === 'P2002') {
      const existing = await prisma.shopifySyncEvent.findUnique({
        where: {
          direction_eventType_idempotencyKey: {
            direction: 'shopify_to_op',
            eventType,
            idempotencyKey,
          },
        },
      });
      if (existing) {
        logger.info({ id: existing.id, idempotencyKey }, 'event_deduplicated');
        return { entry: existing as JournalEntry, isNew: false };
      }
    }
    throw err;
  }
}

export async function markSent(id: string): Promise<void> {
  await prisma.shopifySyncEvent.update({
    where: { id },
    data: { status: 'sent' },
  });
}

export async function markFailed(id: string, error: string): Promise<void> {
  await prisma.shopifySyncEvent.update({
    where: { id },
    data: {
      status: 'failed',
      lastError: error,
      attemptCount: { increment: 1 },
    },
  });
}

export async function getEvent(id: string): Promise<JournalEntry | null> {
  const event = await prisma.shopifySyncEvent.findUnique({ where: { id } });
  return event as JournalEntry | null;
}
