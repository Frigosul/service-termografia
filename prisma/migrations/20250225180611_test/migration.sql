-- AlterTable
ALTER TABLE "instruments" ADD COLUMN     "model" INTEGER;

-- CreateTable
CREATE TABLE "union_instruments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "first_instrument_id" TEXT NOT NULL,
    "second_instrument_id" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "union_instruments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "union_instruments_name_key" ON "union_instruments"("name");

-- AddForeignKey
ALTER TABLE "union_instruments" ADD CONSTRAINT "union_instruments_first_instrument_id_fkey" FOREIGN KEY ("first_instrument_id") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "union_instruments" ADD CONSTRAINT "union_instruments_second_instrument_id_fkey" FOREIGN KEY ("second_instrument_id") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
