-- Per-shop conversational commerce settings
CREATE TABLE "shop_settings" (
    "id"                  TEXT NOT NULL,
    "shopId"              TEXT NOT NULL,
    "webchatEnabled"      BOOLEAN NOT NULL DEFAULT false,
    "webchatEntrypointId" TEXT,
    "webchatEmbedUrl"     TEXT,
    "identitySecret"      TEXT,
    "whatsappEnabled"     BOOLEAN NOT NULL DEFAULT false,
    "whatsappNumber"      TEXT,
    "whatsappFlowId"      TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shop_settings_shopId_key" ON "shop_settings"("shopId");

ALTER TABLE "shop_settings" ADD CONSTRAINT "shop_settings_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Conversation attribution on checkout sessions
ALTER TABLE "shopify_order_payments"
    ADD COLUMN "conversationId"   TEXT,
    ADD COLUMN "channelSessionId" TEXT;
