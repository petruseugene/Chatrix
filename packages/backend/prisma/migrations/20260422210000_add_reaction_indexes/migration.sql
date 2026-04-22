-- CreateIndex
CREATE INDEX "Reaction_roomMessageId_idx" ON "Reaction"("roomMessageId");

-- CreateIndex
CREATE INDEX "Reaction_directMessageId_idx" ON "Reaction"("directMessageId");
