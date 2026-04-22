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
  lastAttemptAt?: Date | null;
  nextRetryAt?: Date | null;
  deadLetteredAt?: Date | null;
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
    if ((err as { code?: string })?.code === 'P2002') {
      const existing = await prisma.shopifySyncEvent.findUnique({
        where: {
          shopId_direction_eventType_idempotencyKey: {
            shopId,
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

// Kept for backward compatibility; new code paths use scheduleRetry / markDeadLetter.
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

export async function scheduleRetry(id: string, error: string, nextRetryAt: Date): Promise<void> {
  await prisma.shopifySyncEvent.update({
    where: { id },
    data: {
      status: 'retry_scheduled',
      lastError: error,
      lastAttemptAt: new Date(),
      nextRetryAt,
      attemptCount: { increment: 1 },
    },
  });
}

export async function markDeadLetter(id: string, error: string): Promise<void> {
  await prisma.shopifySyncEvent.update({
    where: { id },
    data: {
      status: 'dead_letter',
      lastError: error,
      lastAttemptAt: new Date(),
      deadLetteredAt: new Date(),
      attemptCount: { increment: 1 },
    },
  });
}

export async function getEvent(id: string): Promise<JournalEntry | null> {
  const event = await prisma.shopifySyncEvent.findUnique({ where: { id } });
  return event as JournalEntry | null;
}

export async function fetchDueRetries(limit = 50): Promise<JournalEntry[]> {
  const now = new Date();
  const events = await prisma.shopifySyncEvent.findMany({
    where: {
      status: { in: ['failed', 'retry_scheduled'] },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
  return events as JournalEntry[];
}

// Atomic claim via nextRetryAt soft-lease. Returns true if this worker won the claim.
export async function claimRetry(id: string): Promise<boolean> {
  const now = new Date();
  const result = await prisma.shopifySyncEvent.updateMany({
    where: {
      id,
      status: { in: ['failed', 'retry_scheduled'] },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
    data: { nextRetryAt: new Date(Date.now() + 60_000) }, // 60-s soft lease prevents double-claim
  });
  return result.count > 0;
}
