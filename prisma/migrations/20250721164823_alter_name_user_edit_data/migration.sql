/*
  Warnings:

  - You are about to drop the column `userEditData` on the `instrument_data` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "instrument_data" DROP COLUMN "userEditData",
ADD COLUMN     "user_edit_data" TEXT;
