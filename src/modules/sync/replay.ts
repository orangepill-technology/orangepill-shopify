import { getEvent, markSent, markFailed } from './journal';
import { orangepillClient } from '../orangepill/client';
import { logger } from '../../logger';
import type { OrangepillEvent } from '../orangepill/types';

export interface ReplayResult {
  ok: boolean;
  error?: string;
}

// Safe to call multiple times — Orangepill deduplicates on idempotencyKey.
export async function replay(eventId: string): Promise<ReplayResult> {
  const entry = await getEvent(eventId);
  if (!entry) return { ok: false, error: 'Event not found' };

  const payload = entry.payloadJson as OrangepillEvent;
  const result = await orangepillClient.emitEvent(payload, entry.idempotencyKey);

  if (result.success) {
    await markSent(entry.id);
    logger.info({ id: entry.id, eventType: entry.eventType }, 'event_replayed');
    return { ok: true };
  } else {
    const error = result.error ?? 'unknown';
    await markFailed(entry.id, error);
    logger.error({ id: entry.id, error }, 'event_replay_failed');
    return { ok: false, error };
  }
}
