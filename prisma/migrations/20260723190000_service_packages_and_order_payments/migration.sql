-- Safe additive migration for service packages and immutable payment history.
-- Existing Order.deposit_amount remains as a compatibility value for reports.

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "service_package_id" TEXT;

CREATE TABLE IF NOT EXISTS "ServicePackage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "default_price" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CONSTRAINT "ServicePackage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ServicePackage_name_key"
ON "ServicePackage"("name");

CREATE TABLE IF NOT EXISTS "OrderPayment" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "installment_no" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "payment_date" TEXT NOT NULL,
    "note" TEXT,
    "recorded_by" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "voided_at" TEXT,
    "voided_by" TEXT,
    "void_reason" TEXT,
    CONSTRAINT "OrderPayment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrderPayment_installment_no_check"
      CHECK ("installment_no" BETWEEN 1 AND 3),
    CONSTRAINT "OrderPayment_amount_check"
      CHECK ("amount" > 0)
);

CREATE INDEX IF NOT EXISTS "OrderPayment_order_id_idx"
ON "OrderPayment"("order_id");

CREATE INDEX IF NOT EXISTS "OrderPayment_payment_date_idx"
ON "OrderPayment"("payment_date");

-- Preserve existing deposits as installment-1 ledger entries. Because the old
-- schema did not store a payment date, the contract creation date is used and
-- the record is explicitly marked as migrated legacy data.
INSERT INTO "OrderPayment" (
    "id", "order_id", "installment_no", "amount", "payment_date", "note",
    "recorded_by", "created_at", "voided_at", "voided_by", "void_reason"
)
SELECT
    'legacy-deposit-' || o."id",
    o."id",
    1,
    o."deposit_amount",
    CASE
      WHEN o."created_at" ~ '^\d{4}-\d{2}-\d{2}' THEN substring(o."created_at" from 1 for 10)
      ELSE to_char(CURRENT_DATE, 'YYYY-MM-DD')
    END,
    'Dữ liệu tiền cọc cũ được chuyển sang lịch sử thanh toán; ngày thu tạm lấy theo ngày tạo hợp đồng.',
    o."created_by",
    o."created_at",
    NULL,
    NULL,
    NULL
FROM "Order" o
WHERE o."deposit_amount" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "OrderPayment" p
    WHERE p."id" = 'legacy-deposit-' || o."id"
  );
