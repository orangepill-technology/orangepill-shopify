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

---

### Conversational Commerce

**WhatsApp CTA button**
An "Ask on WhatsApp" button appears on product pages via a Theme App Extension block. Merchants place the block in their theme editor. Each click opens a WhatsApp conversation pre-loaded with the product title and URL — no hardcoded phone numbers in Liquid templates.

**Webchat widget**
A floating webchat widget that can be placed on any page via a Theme App Extension block. It initialises with a signed identity token so the Orangepill conversation agent receives verified customer identity from the first message.

**Webchat identity bridge**
Logged-in Shopify customers are identified across channels via a short-lived HMAC-signed identity token. The token carries shop domain, Shopify customer ID, email, phone, and name. Anonymous visitors get an anonymous token so the session is still tracked. The HMAC secret never reaches the browser.

**Conversation attribution**
When a customer arrives at checkout from a WhatsApp or webchat conversation, the `conversationId` and `channelSessionId` are stored on both the checkout session and the Shopify order record. These flow through to the Orangepill event payload so every order is traceable back to its originating conversation.

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
Browse the full history of events sent to Orangepill — filterable by status and event type. Paginated and always up to date.

**Failed Events & one-click Replay**
Any event that failed to reach Orangepill appears in the Failed Events view with its error message and retry count. A single click replays it — safely and idempotently.

**Payments log**
Track every payment session linked to a Shopify order: Orangepill session ID, Shopify transaction ID, amount, currency, and current status.

**Settings page**
Configure per-store conversational commerce settings: enable/disable WhatsApp CTA, set the WhatsApp number or Orangepill flow entrypoint, enable/disable webchat, set the embed URL and entrypoint ID, and rotate the identity token HMAC secret.

**Embedded in Shopify Admin**
The entire dashboard lives inside your Shopify Admin — no separate login, no external portal.

---

### Security

**End-to-end webhook verification**
All inbound webhooks from Shopify and Orangepill are verified using HMAC-SHA256 signatures before any processing occurs. Unverified requests are rejected immediately.

**Encrypted credentials**
Shopify access tokens and identity HMAC secrets are encrypted at rest using AES-256-GCM. No credentials are stored in plain text.

**Identity tokens are server-signed**
Storefront identity tokens are signed server-side. The HMAC key never leaves the server — it is never embedded in Liquid, JavaScript assets, or HTML responses.

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

---

---

# Developer Guide

This section covers everything needed to run, deploy, and extend the app.

## Architecture

```
Shopify Store (merchant)
    │
    │  OAuth install, webhooks, App Proxy requests
    ▼
Fastify server (this app)
    │
    ├── /auth/*              OAuth install flow
    ├── /webhooks/shopify    Inbound Shopify webhooks (orders/paid, refunds/create, app/uninstalled)
    ├── /webhooks/orangepill Inbound Orangepill webhooks (checkout.session.completed, etc.)
    ├── /checkout/*          Payment session creation + customer UX
    ├── /apps/orangepill/*   App Proxy endpoints (identity token, public settings) — called from storefront JS
    ├── /internal/settings/* Internal API for per-shop config (not proxied through Shopify)
    ├── /storefront/*        Legacy script serving (superseded by Theme App Extension)
    └── /app/*               Admin UI (embedded in Shopify Admin)
    │
    ├── PostgreSQL (via Prisma)
    │       shops, shop_settings, shopify_order_payments,
    │       shopify_order_attributions, shopify_sync_events,
    │       shopify_webhooks, orangepill_webhook_events
    │
    └── Orangepill Platform API
            Checkout sessions, event journal, loyalty
```

**Deployment model:**
- The server is a single Node.js process — one instance serves all Shopify stores.
- Per-store isolation is enforced at the DB layer: every table is keyed by `shopId`.
- The Theme App Extension is deployed **once per app** (staging or production). Every merchant that installs the app can then add the extension blocks in their theme editor. Per-store behavior comes from runtime config (`ShopSettings`), not deployment.

---

## Prerequisites

- Node.js ≥ 20
- PostgreSQL ≥ 14
- A Shopify Partner account with a custom app created
- An Orangepill merchant account + integration credentials
- [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) (for Theme App Extension deployment only)
- `ngrok` or equivalent tunnel (local development only)

---

## Environment variables

Copy `.env.example` to `.env` and fill in every value.

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | no | `development` / `production` / `test`. Defaults to `development`. |
| `PORT` | no | HTTP port. Defaults to `3000`. |
| `HOST` | no | Bind address. Defaults to `0.0.0.0`. |
| `APP_URL` | **yes** | Public HTTPS URL of this server, e.g. `https://shopify.yourapp.example.com`. Must match what Shopify has on file for the app. |
| `DATABASE_URL` | **yes** | PostgreSQL connection string, e.g. `postgresql://user:pass@localhost:5432/orangepill_shopify`. |
| `ENCRYPTION_KEY` | **yes** | At least 32-character random string. Used to encrypt Shopify access tokens and identity secrets at rest (AES-256-GCM). Rotate with care — existing encrypted values become unreadable. |
| `SHOPIFY_API_KEY` | **yes** | From the Shopify Partner Dashboard → app credentials. |
| `SHOPIFY_API_SECRET` | **yes** | From the Shopify Partner Dashboard → app credentials. |
| `SHOPIFY_SCOPES` | no | Defaults to `read_orders,read_customers`. |
| `SHOPIFY_API_VERSION` | no | Defaults to `2024-01`. |
| `ORANGEPILL_API_URL` | **yes** | Orangepill platform API base URL. |
| `ORANGEPILL_API_KEY` | **yes** | Orangepill API key. |
| `ORANGEPILL_INTEGRATION_ID` | **yes** | Orangepill integration ID for this Shopify channel. |
| `ORANGEPILL_MERCHANT_ID` | **yes** | Orangepill merchant ID. |
| `ORANGEPILL_WEBHOOK_SECRET` | **yes** | HMAC secret used to verify inbound webhooks from Orangepill. |
| `ADMIN_API_KEY` | **yes** | At least 16-character key for the internal admin API. |
| `IDENTITY_SECRET` | no | At least 32-character fallback HMAC secret for signing storefront identity tokens. Used when no per-shop secret is configured in `ShopSettings`. Required if you use the webchat identity bridge without setting per-shop secrets. |

---

## Local development

### 1. Install dependencies

```bash
npm install
```

### 2. Start a tunnel

Shopify requires a public HTTPS URL for OAuth callbacks and webhooks.

```bash
ngrok http 3000
```

Note the HTTPS URL (e.g. `https://abc123.ngrok.io`). Set it as `APP_URL` in `.env`.

### 3. Configure the Shopify app

In the [Shopify Partner Dashboard](https://partners.shopify.com):

1. Create a custom app (or use an existing one).
2. Set **App URL** to `$APP_URL`.
3. Add **Allowed redirection URL**: `$APP_URL/auth/callback`.
4. Copy the **API key** and **API secret** into `.env`.
5. Under **App Proxy**, set:
   - Subpath prefix: `apps`
   - Subpath: `orangepill`
   - Proxy URL: `$APP_URL`

   This makes `https://<store>.myshopify.com/apps/orangepill/*` proxy to `$APP_URL/apps/orangepill/*`. The identity and settings endpoints depend on this.

### 4. Set up the database

```bash
npm run db:migrate
```

### 5. Start the server

```bash
npm run dev
```

### 6. Install the app on a development store

Navigate to `$APP_URL/auth?shop=<your-dev-store>.myshopify.com`. Complete the OAuth flow. The app registers webhooks automatically on install.

---

## Database

The app uses Prisma with PostgreSQL.

| Command | Purpose |
|---|---|
| `npm run db:generate` | Regenerate the Prisma client after schema changes. |
| `npm run db:migrate` | Create and apply new migrations (development). |
| `npm run db:migrate:deploy` | Apply pending migrations without creating new ones (production/CI). |
| `npm run db:push` | Push schema directly without a migration file (prototyping only — do not use in production). |

When adding new models or columns, edit `prisma/schema.prisma`, run `npm run db:migrate`, commit both the schema change and the generated migration file in `prisma/migrations/`.

---

## Theme App Extension

The extension lives in `extensions/orangepill-storefront/` and ships two blocks:

| Block | File | Where to place |
|---|---|---|
| WhatsApp Button | `blocks/whatsapp-button.liquid` | Product page template — any section that accepts app blocks |
| Webchat Widget | `blocks/webchat-widget.liquid` | Footer or any global section |

**The extension is deployed once per app, not once per store.** After deployment, any merchant that installs the app can add the blocks to their theme via the Shopify theme editor. Per-store behavior (which phone number, which entrypoint, etc.) is controlled by the `ShopSettings` row for that store, not by the extension itself.

### Configuring shopify.app.toml

Before deploying, update `shopify.app.toml` with the values for the target environment:

```toml
client_id = "<SHOPIFY_API_KEY>"          # from Partner Dashboard
application_url = "<APP_URL>"            # your server's public URL
```

For separate staging and production apps, use the `--config` flag:

```bash
# staging
shopify app deploy --config shopify.app.staging.toml

# production
shopify app deploy --config shopify.app.production.toml
```

You can commit both config files — `client_id` is the public API key, not the secret.

### Deploying the extension

```bash
# Install Shopify CLI if you haven't already
npm install -g @shopify/cli

# Deploy
npm run extension:deploy
```

After deployment, merchants add blocks via **Shopify Admin → Online Store → Themes → Customize → Add block → Apps → Orangepill**.

### Per-store configuration

Once blocks are added, each store's behavior is configured via the **Settings** page in the Orangepill app admin (`/app/settings?shop=<store-domain>`):

| Setting | Purpose |
|---|---|
| Enable webchat | Shows/hides the webchat widget |
| Webchat entrypoint ID | Orangepill conversation entrypoint |
| Embed script URL | URL of the webchat embed script |
| Enable WhatsApp button | Shows/hides the WA CTA on product pages |
| WhatsApp number | E.164 format, e.g. `+573001234567` |
| WhatsApp flow ID | Orangepill flow entrypoint (overrides number if set) |
| Identity secret | Per-shop HMAC key for signing identity tokens |

Settings can also be set via the internal API:

```bash
curl -X PUT https://<APP_URL>/internal/settings/<shop-domain> \
  -H "Authorization: Bearer <ADMIN_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "whatsappEnabled": true,
    "whatsappNumber": "+573001234567",
    "webchatEnabled": true,
    "webchatEntrypointId": "op-ep-abc123",
    "webchatEmbedUrl": "https://cdn.orangepill.cc/webchat.js"
  }'
```

---

## Production deployment

### Checklist

- [ ] `DATABASE_URL` points to the production database
- [ ] `ENCRYPTION_KEY` is a strong random 32+ char string — **not the same as staging**
- [ ] `APP_URL` matches the production app URL in the Shopify Partner Dashboard
- [ ] `IDENTITY_SECRET` is set (32+ chars) if per-shop secrets are not yet configured
- [ ] `npm run db:migrate:deploy` has been run against the production database
- [ ] Theme App Extension has been deployed to the production Shopify app (`npm run extension:deploy`)
- [ ] App Proxy is configured in the Partner Dashboard (subpath prefix: `apps`, subpath: `orangepill`)

### Running

```bash
npm run build
npm start
```

### Migrations in CI/CD

Add this step before starting the server:

```bash
npm run db:migrate:deploy
```

This applies any pending migrations without interactive prompts and is safe to run on every deploy — it is a no-op if all migrations are already applied.

---

## Running tests

```bash
npm test
npm run typecheck
```

Tests use mocked DB and external clients — no live database or Shopify API required.

---

## Project structure

```
src/
  app.ts                          Server entry point, route registration
  config/index.ts                 Zod-validated environment config
  modules/
    auth/                         OAuth flow, token encryption, HMAC state
    attribution/                  Order-level conversation attribution
    checkout/                     Payment session creation, customer UX
    identity/                     Storefront identity token + App Proxy endpoints
    settings/                     Per-shop ShopSettings CRUD
    storefront/                   Legacy script-serving route (superseded by TAE)
    admin/                        Embedded admin UI (HTML + API routes)
    orangepill/                   Orangepill API client, webhook handler, event mapper
    shopify/                      Shopify Orders + Transactions API clients
    sync/                         Event journal, retry worker, backoff
    webhooks/                     Inbound Shopify webhook router + HMAC verifier
    db/client.ts                  Prisma client singleton
  routes/
    health.ts                     GET /health
    replay.ts                     POST /replay (internal event replay)

extensions/
  orangepill-storefront/
    shopify.extension.toml        Theme App Extension manifest
    assets/orangepill.js          Storefront JS — served from Shopify CDN
    blocks/
      whatsapp-button.liquid      Product page WhatsApp CTA block
      webchat-widget.liquid       Floating webchat widget block

prisma/
  schema.prisma                   Database schema
  migrations/                     Applied migration history
```
