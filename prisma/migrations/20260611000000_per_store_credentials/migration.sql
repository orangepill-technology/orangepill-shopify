-- Add per-store Orangepill integration credentials to shop_settings.
-- apiKey and webhookSecret are AES-256-GCM encrypted at rest.
ALTER TABLE "shop_settings"
  ADD COLUMN "integrationId"        TEXT,
  ADD COLUMN "merchantId"           TEXT,
  ADD COLUMN "apiKey"               TEXT,
  ADD COLUMN "orangepillApiUrl"     TEXT,
  ADD COLUMN "webhookSecret"        TEXT,
  ADD COLUMN "whatsappStickyEnabled" BOOLEAN NOT NULL DEFAULT false;
