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

// Returns true if this eventId was already processed (duplicate delivery).
export async function deduplicateAndRecord(
  eventId: string,
  deliveryId: string,
  eventType: string,
  sessionId: string,
  payload: OrangepillWebhookPayload,
): Promise<boolean> {
  try {
    await prisma.orangepillWebhookEvent.create({
      data: { eventId, deliveryId, eventType, sessionId, payloadJson: payload as object },
    });
    return false;
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === 'P2002') return true; // already processed
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

  // Guard: never mark the same order paid twice
  if (payment.status === 'paid') {
    logger.info({ sessionId: session_id }, 'op_webhook_already_paid');
    return;
  }

  await markOrderPaid(
    payment.shop.shopDomain,
    payment.shopifyOrderId,
    payment.amount,
    payment.currency,
  );

  const paymentId = (payload.data?.payment_id as string | undefined) ?? null;
  await prisma.shopifyOrderPayment.update({
    where: { id: payment.id },
    data: { status: 'paid', orangepillPaymentId: paymentId },
  });

  logger.info(
    { sessionId: session_id, orderId: payment.shopifyOrderId, shop: payment.shop.shopDomain },
    'order_marked_paid',
  );
}

export async function handleCheckoutSessionFailed(
  payload: OrangepillWebhookPayload,
): Promise<void> {
  const { session_id } = payload;

  await prisma.shopifyOrderPayment.updateMany({
    where: { orangepillSessionId: session_id, status: 'pending' },
    data: { status: 'failed' },
  });

  logger.info({ sessionId: session_id }, 'checkout_session_failed');
}

export async function handleCheckoutSessionExpired(
  payload: OrangepillWebhookPayload,
): Promise<void> {
  const { session_id } = payload;

  await prisma.shopifyOrderPayment.updateMany({
    where: { orangepillSessionId: session_id, status: 'pending' },
    data: { status: 'expired' },
  });

  logger.info({ sessionId: session_id }, 'checkout_session_expired');
}
