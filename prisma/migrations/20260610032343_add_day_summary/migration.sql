-- CreateTable
CREATE TABLE "DaySummary" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" TEXT NOT NULL DEFAULT 'default',
    "date" TEXT NOT NULL,
    "totalPomodoros" INTEGER NOT NULL DEFAULT 0,
    "tasksDone" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "DaySummary_roomId_idx" ON "DaySummary"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "DaySummary_roomId_date_key" ON "DaySummary"("roomId", "date");
