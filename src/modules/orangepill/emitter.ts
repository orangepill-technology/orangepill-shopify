import { createOrangepillClient } from './client';
import { resolveShopConfig } from '../config/shop-config';
import { markSent, scheduleRetry, markDeadLetter, type JournalEntry } from '../sync/journal';
import { isRetryable } from '../sync/classifier';
import { computeNextRetryAt, isExhausted } from '../sync/backoff';
import { logger } from '../../logger';
import type { OrangepillEvent } from './types';

export class ShopifyEventEmitterService {
  // Never throws. Failures are classified and either scheduled for retry or dead-lettered.
  async emit(entry: JournalEntry): Promise<void> {
    const cfg = await resolveShopConfig(entry.shopId);
    const client = createOrangepillClient(cfg);
    const payload = entry.payloadJson as OrangepillEvent;
    const result = await client.emitEvent(payload, entry.idempotencyKey);

    if (result.success) {
      await markSent(entry.id);
      logger.info({ id: entry.id, eventType: entry.eventType }, 'event_sent');
      return;
    }

    const error = result.error ?? 'unknown';
    const newAttemptCount = entry.attemptCount + 1;

    if (isExhausted(newAttemptCount) || !isRetryable(error, result.status)) {
      await markDeadLetter(entry.id, error);
      logger.error(
        { id: entry.id, eventType: entry.eventType, error, httpStatus: result.status },
        'event_dead_lettered',
      );
    } else {
      await scheduleRetry(entry.id, error, computeNextRetryAt(newAttemptCount));
      logger.warn(
        { id: entry.id, eventType: entry.eventType, error, httpStatus: result.status },
        'event_retry_scheduled',
      );
    }
  }
}

export const emitter = new ShopifyEventEmitterService();
