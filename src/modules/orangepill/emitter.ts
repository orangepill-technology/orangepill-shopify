import { orangepillClient } from './client';
import { markSent, markFailed, type JournalEntry } from '../sync/journal';
import { logger } from '../../logger';
import type { OrangepillEvent } from './types';

export class ShopifyEventEmitterService {
  // Never throws. Failures are recorded in the journal for replay.
  async emit(entry: JournalEntry): Promise<void> {
    const payload = entry.payloadJson as OrangepillEvent;
    const result = await orangepillClient.emitEvent(payload, entry.idempotencyKey);

    if (result.success) {
      await markSent(entry.id);
      logger.info({ id: entry.id, eventType: entry.eventType }, 'event_sent');
    } else {
      const error = result.error ?? 'unknown';
      await markFailed(entry.id, error);
      logger.error(
        { id: entry.id, eventType: entry.eventType, error, httpStatus: result.status },
        'event_failed',
      );
    }
  }
}

export const emitter = new ShopifyEventEmitterService();
