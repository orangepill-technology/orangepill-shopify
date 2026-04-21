# Orangepill for Shopify

Accept payments, earn loyalty, and manage your Orangepill commerce channel — all from inside your Shopify Admin.

## What is Orangepill for Shopify?

Orangepill for Shopify connects your Shopify store to the Orangepill financial platform. Your customers pay through Orangepill's secure hosted checkout, earn loyalty points on every purchase, and can redeem their wallet balance at the next checkout. You get real-time visibility into every payment, event, and sync — without leaving Shopify.

---

## Features

### Payments

**Accept payments via Orangepill**
Customers click "Pay with Orangepill" and are redirected to Orangepill's secure hosted checkout. After payment, they return to your store and your Shopify order is automatically marked as paid. No manual intervention required.

**Automatic order reconciliation**
The moment a payment is confirmed by Orangepill, your Shopify order is updated — status, transaction record, and all. Every payment state (completed, failed, expired) is tracked and visible.

**Refund tracking**
When you issue a refund in Shopify, it is automatically reported to Orangepill so your financial records stay in sync across both platforms.

---

### Loyalty & Wallet

**Earn on every purchase**
Customers earn Orangepill loyalty points on every completed order. Points are credited automatically — no coupons, no codes, no friction.

**Redeem at checkout**
Customers with an Orangepill wallet balance can apply their points at checkout to reduce the amount they pay. The wallet deduction happens inside the Orangepill hosted checkout, so nothing changes about your Shopify checkout flow.

**Customer identity sync**
Orangepill identifies your customers across channels using their email and phone number. A customer who has shopped via WhatsApp, WooCommerce, or your Shopify store shares the same loyalty balance everywhere. Their Orangepill wallet follows them, not the channel.

**Earn & reversal visibility**
Operators can see the loyalty earn and any wallet reversal associated with each order — so support queries are answered in seconds, not hours.

---

### Order & Event Sync

**Webhook-first, always accurate**
Order status updates come from Orangepill webhooks — not from page redirects or polling. If a customer closes the browser mid-payment, the order still gets updated correctly when Orangepill confirms payment.

**Idempotent processing**
Every event is processed exactly once. Duplicate webhook deliveries, retried requests, and network hiccups are all handled automatically — you will never see a double-charge or a duplicate transaction on a Shopify order.

**Full sync history**
Every event sent between Shopify and Orangepill is recorded with its full payload, status, and attempt history. Nothing is silently dropped.

---

### Admin Dashboard

**Overview panel**
See at a glance: how many events are pending, sent, or failed; how many payments are in progress or completed; and when the last webhook was received.

**Sync Events log**
Browse the full history of events sent to Orangepill — filterable by status (pending / sent / failed) and event type (order finalized / order refunded). Paginated and always up to date.

**Failed Events & one-click Replay**
Any event that failed to reach Orangepill appears in the Failed Events view with its error message and retry count. A single click replays it — safely and idempotently.

**Payments log**
Track every payment session linked to a Shopify order: Orangepill session ID, Shopify transaction ID, amount, currency, and current status.

**Embedded in Shopify Admin**
The entire dashboard lives inside your Shopify Admin — no separate login, no external portal.

---

### Security

**End-to-end webhook verification**
All inbound webhooks from Shopify and Orangepill are verified using HMAC-SHA256 signatures before any processing occurs. Unverified requests are rejected immediately.

**Encrypted credentials**
Your Shopify access token is encrypted at rest. No credentials are stored in plain text.

**Scoped by merchant**
Each Shopify store is fully isolated. Events, payments, and sync history from one store are never visible to another.

---

## How it works

1. **Install** the app from your Shopify Admin. It connects to Orangepill automatically — no manual webhook setup needed.
2. When a customer is ready to pay, they are **redirected to Orangepill's hosted checkout** where they can pay and optionally redeem loyalty points.
3. Orangepill processes the payment and sends a confirmation. Your **Shopify order is marked paid automatically**.
4. The customer's **loyalty points are credited** to their Orangepill wallet for use on their next purchase — across any Orangepill-connected channel.
5. Everything is logged. If anything goes wrong, the **Admin Dashboard** shows you exactly what happened and lets you replay it in one click.

---

## Requirements

- Shopify store (any plan)
- Orangepill merchant account
- Orangepill integration configured for your store

---

## More from the Orangepill Platform

Installing this app activates your store as a channel within the Orangepill platform. That means the following capabilities — already part of Orangepill — are available to you without any additional integration work.

### Conversational Commerce

Orangepill powers commerce directly inside messaging channels — WhatsApp, Instagram, Telegram, and more. Customers can browse, order, and pay without leaving the conversation. Because every channel shares the same customer identity and loyalty wallet, a purchase on WhatsApp and a purchase on your Shopify store both earn and spend from the same balance. Once your Shopify app is active, your products and customers are already part of this network.

### Agentic Commerce

Orangepill's agentic commerce layer works in both directions — agents as buyers and agents as sellers. On the buying side, AI agents act on behalf of customers: discovering products, initiating checkout, and completing payment autonomously. On the selling side, merchant-owned agents sell proactively — reaching out to customers, presenting offers, and closing transactions without any storefront interaction. A merchant agent can identify a high-value customer, propose a reorder or upsell through the customer's preferred channel, and take payment in the same conversation. Every transaction — whether triggered by a human or an agent — flows through the same Orangepill financial runtime: fully auditable, loyalty-enabled, and settlement-ready. Your Shopify catalog is available to these agents as soon as the app is installed.

---

## Support

For setup help, contact your Orangepill account manager or visit [orangepill.technology](https://orangepill.technology).

---

*Orangepill for Shopify is part of the Orangepill multi-channel commerce platform — the same financial runtime that powers conversational, agentic, and traditional commerce across every channel.*
