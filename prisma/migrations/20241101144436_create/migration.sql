-- DropForeignKey
ALTER TABLE "temperature_instrument" DROP CONSTRAINT "temperature_instrument_instrument_id_fkey";

-- AlterTable
ALTER TABLE "instruments" ADD COLUMN     "error" TEXT;

-- AlterTable
ALTER TABLE "temperatures" ALTER COLUMN "updatedAt" DROP NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "temperature_instrument" ADD CONSTRAINT "temperature_instrument_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "instruments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
