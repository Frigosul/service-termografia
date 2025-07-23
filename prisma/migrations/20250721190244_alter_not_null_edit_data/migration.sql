/*
  Warnings:

  - Made the column `edit_data` on table `instrument_data` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "instrument_data" ALTER COLUMN "edit_data" SET NOT NULL;
