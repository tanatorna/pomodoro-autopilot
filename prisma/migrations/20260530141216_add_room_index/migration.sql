-- CreateIndex
CREATE INDEX "ScheduleSlot_roomId_idx" ON "ScheduleSlot"("roomId");

-- CreateIndex
CREATE INDEX "Session_roomId_idx" ON "Session"("roomId");

-- CreateIndex
CREATE INDEX "Task_roomId_idx" ON "Task"("roomId");
