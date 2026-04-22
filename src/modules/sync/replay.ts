import { getEvent, markSent, scheduleRetry, markDeadLetter } from './journal';
import { isRetryable } from './classifier';
import { computeNextRetryAt, isExhausted } from './backoff';
import { orangepillClient } from '../orangepill/client';
import { logger } from '../../logger';
import type { OrangepillEvent } from '../orangepill/types';

export interface ReplayResult {
  ok: boolean;
  error?: string;
}

// Safe to call multiple times — Orangepill deduplicates on idempotencyKey.
// On failure, classifies the error: schedules retry or dead-letters.
// Dead-letter events bypass exhaustion check so operators can always attempt a manual rescue.
export async function replay(eventId: string): Promise<ReplayResult> {
  const entry = await getEvent(eventId);
  if (!entry) return { ok: false, error: 'Event not found' };

  const payload = entry.payloadJson as OrangepillEvent;
  const result = await orangepillClient.emitEvent(payload, entry.idempotencyKey);

  if (result.success) {
    await markSent(entry.id);
    logger.info({ id: entry.id, eventType: entry.eventType }, 'event_replayed');
    return { ok: true };
  }

  const error = result.error ?? 'unknown';
  const newAttemptCount = entry.attemptCount + 1;
  const retryable = isRetryable(error, result.status);

  // Dead-letter events re-entering via manual replay skip the exhaustion check so the
  // operator gets at least one more attempt before re-classifying.
  const skipExhaustion = entry.status === 'dead_letter';

  if (!retryable || (!skipExhaustion && isExhausted(newAttemptCount))) {
    await markDeadLetter(entry.id, error);
    logger.warn({ id: entry.id, error, attemptCount: newAttemptCount }, 'event_dead_lettered');
  } else {
    const nextRetryAt = computeNextRetryAt(newAttemptCount);
    await scheduleRetry(entry.id, error, nextRetryAt);
    logger.info({ id: entry.id, error, nextRetryAt }, 'event_retry_scheduled');
  }

  return { ok: false, error };
}
