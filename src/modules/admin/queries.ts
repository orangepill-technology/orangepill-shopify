import { prisma } from '../db/client';

export interface EventFilter {
  status?: string;
  eventType?: string;
  shopId?: string;
  cursor?: string;
  limit?: number;
}

export interface PaymentFilter {
  status?: string;
  shopId?: string;
  cursor?: string;
  limit?: number;
}

export async function listSyncEvents(filter: EventFilter) {
  const limit = Math.min(filter.limit ?? 50, 200);

  return prisma.shopifySyncEvent.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.eventType ? { eventType: filter.eventType } : {}),
      ...(filter.shopId ? { shopId: filter.shopId } : {}),
      ...(filter.cursor ? { id: { lt: filter.cursor } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    select: {
      id: true,
      shopId: true,
      eventType: true,
      resourceId: true,
      idempotencyKey: true,
      status: true,
      attemptCount: true,
      lastError: true,
      lastAttemptAt: true,
      nextRetryAt: true,
      deadLetteredAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getSyncEvent(id: string) {
  return prisma.shopifySyncEvent.findUnique({ where: { id } });
}

export async function listPayments(filter: PaymentFilter) {
  const limit = Math.min(filter.limit ?? 50, 200);

  return prisma.shopifyOrderPayment.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.shopId ? { shopId: filter.shopId } : {}),
      ...(filter.cursor ? { id: { lt: filter.cursor } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    select: {
      id: true,
      shopId: true,
      shopifyOrderId: true,
      orangepillSessionId: true,
      orangepillPaymentId: true,
      shopifyTransactionId: true,
      amount: true,
      currency: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getHealthStats() {
  const [syncByStatus, paymentsByStatus, lastWebhook] = await Promise.all([
    prisma.shopifySyncEvent.groupBy({ by: ['status'], _count: { id: true } }),
    prisma.shopifyOrderPayment.groupBy({ by: ['status'], _count: { id: true } }),
    prisma.shopifySyncEvent.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
  ]);

  const syncStats = Object.fromEntries(syncByStatus.map((r) => [r.status, r._count.id]));
  const paymentStats = Object.fromEntries(paymentsByStatus.map((r) => [r.status, r._count.id]));

  return {
    syncEvents: {
      pending: syncStats['pending'] ?? 0,
      sent: syncStats['sent'] ?? 0,
      failed: syncStats['failed'] ?? 0,
      retryScheduled: syncStats['retry_scheduled'] ?? 0,
      deadLetter: syncStats['dead_letter'] ?? 0,
    },
    payments: {
      pending: paymentStats['pending'] ?? 0,
      processing: paymentStats['processing'] ?? 0,
      paid: paymentStats['paid'] ?? 0,
      failed: paymentStats['failed'] ?? 0,
      expired: paymentStats['expired'] ?? 0,
    },
    lastWebhookAt: lastWebhook?.createdAt ?? null,
  };
}
