-- AlterTable
ALTER TABLE "products" ADD COLUMN     "tracks_serial" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "inventory" ADD COLUMN     "serial_number" TEXT;

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "serial_number" TEXT;

-- CreateTable
CREATE TABLE "recipes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "company_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "yield_qty" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "recipe_id" UUID NOT NULL,
    "component_product_id" UUID NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "recipe_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recipes_company_id_idx" ON "recipes"("company_id");

-- CreateIndex
CREATE INDEX "recipes_product_id_idx" ON "recipes"("product_id");

-- CreateIndex
CREATE INDEX "recipe_items_recipe_id_idx" ON "recipe_items"("recipe_id");

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_component_product_id_fkey" FOREIGN KEY ("component_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

