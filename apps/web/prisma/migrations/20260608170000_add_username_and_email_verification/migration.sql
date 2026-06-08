-- AlterTable: username (nullable, unique)
ALTER TABLE "users" ADD COLUMN "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- Grandfather existing users: mark them verified so the new "verified-only
-- login" gate does NOT lock out anyone who registered before this feature.
UPDATE "users" SET "email_verified" = CURRENT_TIMESTAMP WHERE "email_verified" IS NULL;

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "hashed_token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_hashed_token_key" ON "email_verification_tokens"("hashed_token");

-- CreateIndex
CREATE INDEX "email_verification_tokens_user_id_idx" ON "email_verification_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
