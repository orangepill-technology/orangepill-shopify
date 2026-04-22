import { fetchDueRetries, claimRetry } from './journal';
import { replay } from './replay';
import { logger } from '../../logger';

const POLL_INTERVAL_MS = 30_000;
const BATCH_SIZE = 50;

export class RetryWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  start(): void {
    if (this.timer) return;
    logger.info('retry_worker_started');
    this.timer = setInterval(() => void this.tick(), POLL_INTERVAL_MS);
    void this.tick(); // run immediately on startup
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('retry_worker_stopped');
    }
  }

  private async tick(): Promise<void> {
    if (this.running) return; // prevent reentrant execution within a single process
    this.running = true;
    try {
      await this.processDue();
    } catch (err) {
      logger.error({ err }, 'retry_worker_tick_error');
    } finally {
      this.running = false;
    }
  }

  private async processDue(): Promise<void> {
    const candidates = await fetchDueRetries(BATCH_SIZE);
    if (candidates.length === 0) return;

    logger.info({ count: candidates.length }, 'retry_worker_processing');

    for (const candidate of candidates) {
      const claimed = await claimRetry(candidate.id);
      if (!claimed) continue; // another worker won the race

      const result = await replay(candidate.id);
      logger.info(
        { id: candidate.id, ok: result.ok, error: result.error },
        'retry_worker_event_processed',
      );
    }
  }
}

export const retryWorker = new RetryWorker();
