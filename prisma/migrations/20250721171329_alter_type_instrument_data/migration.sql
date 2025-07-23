/*
  Warnings:

  - The `edit_data` column on the `instrument_data` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `generate_data` column on the `instrument_data` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `data` on the `instrument_data` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "instrument_data" DROP COLUMN "data",
ADD COLUMN     "data" DOUBLE PRECISION NOT NULL,
DROP COLUMN "edit_data",
ADD COLUMN     "edit_data" DOUBLE PRECISION,
DROP COLUMN "generate_data",
ADD COLUMN     "generate_data" DOUBLE PRECISION;
