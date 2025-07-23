/*
  Warnings:

  - You are about to drop the column `organization_id` on the `instruments` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "instruments_organization_id_slug_key";

-- AlterTable
ALTER TABLE "instrument_data" ADD COLUMN     "userEditData" TEXT;

-- AlterTable
ALTER TABLE "instruments" DROP COLUMN "organization_id";
