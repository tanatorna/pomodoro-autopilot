-- CreateTable
CREATE TABLE "RoomSetting" (
    "roomId" TEXT NOT NULL PRIMARY KEY,
    "workMinutes" INTEGER NOT NULL DEFAULT 25,
    "shortBreakMinutes" INTEGER NOT NULL DEFAULT 5,
    "longBreakMinutes" INTEGER NOT NULL DEFAULT 15,
    "pomodorosPerLongBreak" INTEGER NOT NULL DEFAULT 4,
    "updatedAt" DATETIME NOT NULL
);
