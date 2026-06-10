/*
  Warnings:

  - You are about to drop the `DaySummary` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Task" ADD COLUMN "doneDate" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "DaySummary";
PRAGMA foreign_keys=on;
