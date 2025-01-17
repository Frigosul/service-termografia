-- AlterTable
ALTER TABLE "instruments" ADD COLUMN     "idSitrad" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "maxValue" DOUBLE PRECISION NOT NULL DEFAULT 20,
ADD COLUMN     "minValue" DOUBLE PRECISION NOT NULL DEFAULT -20,
ALTER COLUMN "type" DROP NOT NULL,
ALTER COLUMN "type" SET DEFAULT 'temp';

-- CreateTable
CREATE TABLE "pressures" (
    "id" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editValue" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3),
    "userUpdatedAt" TEXT,

    CONSTRAINT "pressures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pressure_instrument" (
    "instrument_id" TEXT NOT NULL,
    "pressure_id" TEXT NOT NULL,

    CONSTRAINT "pressure_instrument_pkey" PRIMARY KEY ("instrument_id","pressure_id")
);

-- AddForeignKey
ALTER TABLE "pressure_instrument" ADD CONSTRAINT "pressure_instrument_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "instruments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pressure_instrument" ADD CONSTRAINT "pressure_instrument_pressure_id_fkey" FOREIGN KEY ("pressure_id") REFERENCES "pressures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
