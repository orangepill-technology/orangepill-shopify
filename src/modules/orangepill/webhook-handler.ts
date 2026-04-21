import { createHash } from 'crypto';
import { prisma } from '../db/client';
import { markOrderPaid } from '../shopify/transactions';
import { logger } from '../../logger';

export interface OrangepillWebhookPayload {
  event_type: string;
  session_id: string;
  merchant_id: string;
  tenant_id: string;
  data?: Record<string, unknown>;
}

// Returns true if this delivery has already been processed (duplicate).
// Also detects hash-mismatch anomalies: same eventId, different payload body.
export async function deduplicateAndRecord(
  eventId: string,
  deliveryId: string,
  eventType: string,
  sessionId: string,
  payload: OrangepillWebhookPayload,
  rawBody: Buffer,
): Promise<boolean> {
  const payloadHash = createHash('sha256').update(rawBody).digest('hex');

  try {
    await prisma.orangepillWebhookEvent.create({
      data: { eventId, deliveryId, eventType, sessionId, payloadHash, payloadJson: payload as object },
    });
    return false;
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === 'P2002') {
      // eventId already seen — check whether the body changed (provider anomaly)
      const existing = await prisma.orangepillWebhookEvent.findUnique({ where: { eventId } });
      if (existing && existing.payloadHash !== payloadHash) {
        logger.error(
          { eventId, storedHash: existing.payloadHash, receivedHash: payloadHash },
          'op_webhook_hash_mismatch_anomaly',
        );
      }
      return true; // don't reprocess regardless
    }
    throw err;
  }
}

export async function handleCheckoutSessionCompleted(
  payload: OrangepillWebhookPayload,
): Promise<void> {
  const { session_id } = payload;

  const payment = await prisma.shopifyOrderPayment.findUnique({
    where: { orangepillSessionId: session_id },
    include: { shop: true },
  });

  if (!payment) {
    logger.warn({ sessionId: session_id }, 'op_webhook_no_payment_mapping');
    return;
  }

  // Shopify transaction already created — fully idempotent
  if (payment.shopifyTransactionId) {
    logger.info({ sessionId: session_id }, 'op_webhook_transaction_already_created');
    return;
  }

  // Amount validation — guard against provider bugs or misrouted events
  const webhookAmount = payload.data?.amount as string | undefined;
  const webhookCurrency = payload.data?.currency as string | undefined;

  if (webhookAmount !== undefined && webhookAmount !== payment.amount) {
    logger.error(
      { sessionId: session_id, expected: payment.amount, received: webhookAmount },
      'op_webhook_amount_mismatch_anomaly',
    );
    return;
  }

  if (webhookCurrency !== undefined && webhookCurrency !== payment.currency) {
    logger.error(
      { sessionId: session_id, expectedCurrency: payment.currency, receivedCurrency: webhookCurrency },
      'op_webhook_currency_mismatch_anomaly',
    );
    return;
  }

  // Atomic claim via 'processing' status — prevents concurrent double-execution.
  // Only one worker can transition pending → processing.
  const claimed = await prisma.shopifyOrderPayment.updateMany({
    where: { id: payment.id, status: 'pending' },
    data: { status: 'processing' },
  });

  if (claimed.count === 0) {
    logger.info({ sessionId: session_id }, 'op_webhook_concurrent_claim_lost');
    return;
  }

  try {
    const { transactionId } = await markOrderPaid(
      payment.shop.shopDomain,
      payment.shopifyOrderId,
      payment.amount,
      payment.currency,
    );

    await prisma.shopifyOrderPayment.update({
      where: { id: payment.id },
      data: {
        status: 'paid',
        shopifyTransactionId: transactionId,
        orangepillPaymentId: (payload.data?.payment_id as string | undefined) ?? null,
      },
    });

    logger.info(
      { sessionId: session_id, orderId: payment.shopifyOrderId, shop: payment.shop.shopDomain, transactionId },
      'order_marked_paid',
    );
  } catch (err) {
    // Shopify API failed — release the lock so the event can be retried
    await prisma.shopifyOrderPayment.update({
      where: { id: payment.id },
      data: { status: 'pending' },
    });
    throw err;
  }
}

export async function handleCheckoutSessionFailed(
  payload: OrangepillWebhookPayload,
): Promise<void> {
  await prisma.shopifyOrderPayment.updateMany({
    where: { orangepillSessionId: payload.session_id, status: 'pending' },
    data: { status: 'failed' },
  });
  logger.info({ sessionId: payload.session_id }, 'checkout_session_failed');
}

export async function handleCheckoutSessionExpired(
  payload: OrangepillWebhookPayload,
): Promise<void> {
  await prisma.shopifyOrderPayment.updateMany({
    where: { orangepillSessionId: payload.session_id, status: 'pending' },
    data: { status: 'expired' },
  });
  logger.info({ sessionId: payload.session_id }, 'checkout_session_expired');
}
