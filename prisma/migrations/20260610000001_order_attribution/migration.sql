-- Order-level conversation attribution table.
-- Keyed on (shopId, shopifyOrderId) so attribution is captured once per order
-- regardless of whether a payment session was created.
CREATE TABLE "shopify_order_attributions" (
    "id"               TEXT NOT NULL,
    "shopId"           TEXT NOT NULL,
    "shopifyOrderId"   TEXT NOT NULL,
    "conversationId"   TEXT,
    "channelSessionId" TEXT,
    "source"           TEXT NOT NULL,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopify_order_attributions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shopify_order_attributions_shopId_shopifyOrderId_key"
    ON "shopify_order_attributions"("shopId", "shopifyOrderId");

ALTER TABLE "shopify_order_attributions"
    ADD CONSTRAINT "shopify_order_attributions_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
