-- CreateTable
CREATE TABLE "Task" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "estimatedPomodoros" INTEGER NOT NULL DEFAULT 1,
    "completedPomodoros" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "state" TEXT NOT NULL DEFAULT 'IDLE',
    "endsAt" DATETIME,
    "remainingMs" INTEGER,
    "origin" TEXT,
    "completedPomodoros" INTEGER NOT NULL DEFAULT 0,
    "currentTaskId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ScheduleSlot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "taskId" INTEGER NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduleSlot_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
