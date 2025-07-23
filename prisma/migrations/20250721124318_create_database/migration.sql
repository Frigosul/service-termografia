/*
  Warnings:

  - You are about to drop the column `createdAt` on the `instruments` table. All the data in the column will be lost.
  - You are about to drop the column `displayOrder` on the `instruments` table. All the data in the column will be lost.
  - You are about to drop the column `error` on the `instruments` table. All the data in the column will be lost.
  - You are about to drop the column `idSitrad` on the `instruments` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `instruments` table. All the data in the column will be lost.
  - You are about to drop the column `isSensorError` on the `instruments` table. All the data in the column will be lost.
  - You are about to drop the column `maxValue` on the `instruments` table. All the data in the column will be lost.
  - You are about to drop the column `minValue` on the `instruments` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `instruments` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `instruments` table. All the data in the column will be lost.
  - You are about to drop the `pressure_instrument` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `pressures` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `temperature_instrument` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `temperatures` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[slug]` on the table `instruments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organization_id,slug]` on the table `instruments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[first_instrument_id,second_instrument_id]` on the table `union_instruments` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `organization_id` to the `instruments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `instruments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `instruments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `instruments` table without a default value. This is not possible if the table is not empty.
  - Made the column `model` on table `instruments` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "InstrumentType" AS ENUM ('TEMPERATURE', 'PRESSURE');

-- DropForeignKey
ALTER TABLE "pressure_instrument" DROP CONSTRAINT "pressure_instrument_instrument_id_fkey";

-- DropForeignKey
ALTER TABLE "pressure_instrument" DROP CONSTRAINT "pressure_instrument_pressure_id_fkey";

-- DropForeignKey
ALTER TABLE "temperature_instrument" DROP CONSTRAINT "temperature_instrument_instrument_id_fkey";

-- DropForeignKey
ALTER TABLE "temperature_instrument" DROP CONSTRAINT "temperature_instrument_temperature_id_fkey";

-- DropIndex
DROP INDEX "instruments_name_key";

-- AlterTable
ALTER TABLE "instruments" DROP COLUMN "createdAt",
DROP COLUMN "displayOrder",
DROP COLUMN "error",
DROP COLUMN "idSitrad",
DROP COLUMN "isActive",
DROP COLUMN "isSensorError",
DROP COLUMN "maxValue",
DROP COLUMN "minValue",
DROP COLUMN "status",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "id_sitrad" INTEGER,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "max_value" DOUBLE PRECISION NOT NULL DEFAULT 100,
ADD COLUMN     "min_value" DOUBLE PRECISION NOT NULL DEFAULT -100,
ADD COLUMN     "order_display" SERIAL NOT NULL,
ADD COLUMN     "organization_id" TEXT NOT NULL,
ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" "InstrumentType" NOT NULL,
ALTER COLUMN "model" SET NOT NULL;

-- DropTable
DROP TABLE "pressure_instrument";

-- DropTable
DROP TABLE "pressures";

-- DropTable
DROP TABLE "temperature_instrument";

-- DropTable
DROP TABLE "temperatures";

-- CreateTable
CREATE TABLE "instrument_data" (
    "id" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "edit_data" TEXT,
    "generate_data" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "instrument_id" TEXT NOT NULL,

    CONSTRAINT "instrument_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "instrument_time_index" ON "instrument_data"("instrument_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "instruments_slug_key" ON "instruments"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "instruments_organization_id_slug_key" ON "instruments"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "union_instruments_first_instrument_id_second_instrument_id_key" ON "union_instruments"("first_instrument_id", "second_instrument_id");

-- AddForeignKey
ALTER TABLE "instrument_data" ADD CONSTRAINT "instrument_data_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
