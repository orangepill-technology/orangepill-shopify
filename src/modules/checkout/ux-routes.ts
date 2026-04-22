import { FastifyInstance } from 'fastify';
import { prisma } from '../db/client';
import { isValidShopDomain } from '../auth/service';
import { createOrGetCheckoutSession, getPaymentDisplayInfo } from './service';
import { logger } from '../../logger';
import {
  renderPreparePage,
  renderPrepareErrorPage,
  renderConfirmingPage,
  renderPendingTimeoutPage,
  renderSuccessPage,
  renderFailedPage,
  renderExpiredPage,
  type PaymentDisplayInfo,
} from './ux-html';

const FALLBACK_INFO: PaymentDisplayInfo = { amount: '—', currency: '' };

function validateParams(
  shop: string | undefined,
  orderId: string | undefined,
): shop is string {
  return !!shop && isValidShopDomain(shop) && !!orderId;
}

export async function checkoutUxRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET /checkout/prepare ─────────────────────────────────────────────────
  // Creates or retrieves session, then shows the redirect preparation page.
  // "Retry" links from failed/expired pages also land here.
  fastify.get<{ Querystring: { shop?: string; orderId?: string } }>(
    '/checkout/prepare',
    async (request, reply) => {
      const { shop, orderId } = request.query;

      if (!validateParams(shop, orderId)) {
        return reply.type('text/html').send(renderPrepareErrorPage(shop ?? null, null));
      }

      try {
        const result = await createOrGetCheckoutSession(shop, orderId!);
        const info: PaymentDisplayInfo = {
          amount: result.amount,
          currency: result.currency,
          orderAmount: result.orderAmount,
          orderCurrency: result.orderCurrency,
        };
        return reply.type('text/html').send(renderPreparePage(shop, info, result.redirectUrl));
      } catch (err) {
        logger.error({ err, shop, orderId }, 'checkout_prepare_error');
        return reply.type('text/html').send(renderPrepareErrorPage(shop, orderId!));
      }
    },
  );

  // ── GET /checkout/confirming ──────────────────────────────────────────────
  // Shown after return from Orangepill. Polls /checkout/status until resolved.
  // ?timeout=1 variant shows the "still pending" terminal screen.
  fastify.get<{ Querystring: { shop?: string; orderId?: string; timeout?: string } }>(
    '/checkout/confirming',
    async (request, reply) => {
      const { shop, orderId, timeout } = request.query;

      if (!validateParams(shop, orderId)) {
        return reply.type('text/html').send(renderPrepareErrorPage(shop ?? null, null));
      }

      const info = (await getPaymentDisplayInfo(shop, orderId!)) ?? FALLBACK_INFO;

      if (timeout === '1') {
        return reply.type('text/html').send(renderPendingTimeoutPage(shop, orderId!, info));
      }

      return reply.type('text/html').send(renderConfirmingPage(shop, orderId!, info));
    },
  );

  // ── GET /checkout/success ─────────────────────────────────────────────────
  fastify.get<{ Querystring: { shop?: string; orderId?: string } }>(
    '/checkout/success',
    async (request, reply) => {
      const { shop, orderId } = request.query;

      if (!validateParams(shop, orderId)) {
        return reply.type('text/html').send(renderPrepareErrorPage(shop ?? null, null));
      }

      const info = (await getPaymentDisplayInfo(shop, orderId!)) ?? FALLBACK_INFO;
      return reply.type('text/html').send(renderSuccessPage(shop, orderId!, info));
    },
  );

  // ── GET /checkout/failed ──────────────────────────────────────────────────
  fastify.get<{ Querystring: { shop?: string; orderId?: string } }>(
    '/checkout/failed',
    async (request, reply) => {
      const { shop, orderId } = request.query;

      if (!validateParams(shop, orderId)) {
        return reply.type('text/html').send(renderPrepareErrorPage(shop ?? null, null));
      }

      const info = (await getPaymentDisplayInfo(shop, orderId!)) ?? FALLBACK_INFO;
      return reply.type('text/html').send(renderFailedPage(shop, orderId!, info));
    },
  );

  // ── GET /checkout/expired ─────────────────────────────────────────────────
  fastify.get<{ Querystring: { shop?: string; orderId?: string } }>(
    '/checkout/expired',
    async (request, reply) => {
      const { shop, orderId } = request.query;

      if (!validateParams(shop, orderId)) {
        return reply.type('text/html').send(renderPrepareErrorPage(shop ?? null, null));
      }

      const info = (await getPaymentDisplayInfo(shop, orderId!)) ?? FALLBACK_INFO;
      return reply.type('text/html').send(renderExpiredPage(shop, orderId!, info));
    },
  );

  // ── GET /checkout/status ──────────────────────────────────────────────────
  // Lightweight polling endpoint. Returns status + amounts, no internal IDs.
  // Maps 'processing' → 'pending' to keep UX states clean.
  fastify.get<{ Querystring: { shop?: string; orderId?: string } }>(
    '/checkout/status',
    async (request, reply) => {
      const { shop, orderId } = request.query;

      if (!shop || !isValidShopDomain(shop) || !orderId) {
        return reply.code(400).send({ error: 'Invalid parameters' });
      }

      const shopRecord = await prisma.shop.findUnique({
        where: { shopDomain: shop },
        select: { id: true },
      });
      if (!shopRecord) return reply.send({ status: 'unknown' });

      const payment = await prisma.shopifyOrderPayment.findUnique({
        where: { shopId_shopifyOrderId: { shopId: shopRecord.id, shopifyOrderId: orderId } },
        select: {
          status: true,
          amount: true,
          currency: true,
          orderAmount: true,
          orderCurrency: true,
        },
      });

      if (!payment) return reply.send({ status: 'unknown' });

      // Map internal 'processing' to 'pending' — processing is a distributed lock, not a UX state
      const uxStatus = payment.status === 'processing' ? 'pending' : payment.status;

      return reply.send({
        status: uxStatus,
        amount: payment.amount,
        currency: payment.currency,
        ...(payment.orderAmount ? { originalAmount: payment.orderAmount } : {}),
        ...(payment.orderCurrency ? { originalCurrency: payment.orderCurrency } : {}),
      });
    },
  );
}
