-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ScheduleSlot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" TEXT NOT NULL DEFAULT 'default',
    "taskId" INTEGER NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduleSlot_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ScheduleSlot" ("createdAt", "id", "slotIndex", "status", "taskId") SELECT "createdAt", "id", "slotIndex", "status", "taskId" FROM "ScheduleSlot";
DROP TABLE "ScheduleSlot";
ALTER TABLE "new_ScheduleSlot" RENAME TO "ScheduleSlot";
CREATE TABLE "new_Session" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" TEXT NOT NULL DEFAULT 'default',
    "state" TEXT NOT NULL DEFAULT 'IDLE',
    "endsAt" DATETIME,
    "remainingMs" INTEGER,
    "origin" TEXT,
    "completedPomodoros" INTEGER NOT NULL DEFAULT 0,
    "currentTaskId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Session" ("completedPomodoros", "createdAt", "currentTaskId", "endsAt", "id", "origin", "remainingMs", "state", "updatedAt") SELECT "completedPomodoros", "createdAt", "currentTaskId", "endsAt", "id", "origin", "remainingMs", "state", "updatedAt" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
CREATE TABLE "new_Task" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" TEXT NOT NULL DEFAULT 'default',
    "title" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "estimatedPomodoros" INTEGER NOT NULL DEFAULT 1,
    "completedPomodoros" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Task" ("completedPomodoros", "createdAt", "estimatedPomodoros", "id", "priority", "status", "title", "updatedAt") SELECT "completedPomodoros", "createdAt", "estimatedPomodoros", "id", "priority", "status", "title", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
