-- CreateTable
CREATE TABLE "Reaction" (
    "id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roomMessageId" TEXT,
    "directMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("id")
);

-- AddConstraint
ALTER TABLE "Reaction"
  ADD CONSTRAINT "reaction_exactly_one_message"
  CHECK (
    ("roomMessageId" IS NOT NULL AND "directMessageId" IS NULL) OR
    ("roomMessageId" IS NULL AND "directMessageId" IS NOT NULL)
  );

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_userId_emoji_roomMessageId_key" ON "Reaction"("userId", "emoji", "roomMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_userId_emoji_directMessageId_key" ON "Reaction"("userId", "emoji", "directMessageId");

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_roomMessageId_fkey" FOREIGN KEY ("roomMessageId") REFERENCES "RoomMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_directMessageId_fkey" FOREIGN KEY ("directMessageId") REFERENCES "DirectMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
