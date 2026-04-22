-- CreateEnum
CREATE TYPE "AttachmentTarget" AS ENUM ('ROOM', 'DM');

-- AlterTable
ALTER TABLE "RoomMessage" ADD COLUMN "attachmentId" TEXT;

-- AlterTable
ALTER TABLE "DirectMessage" ADD COLUMN "attachmentId" TEXT;

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "targetType" "AttachmentTarget" NOT NULL,
    "roomId" TEXT,
    "dmThreadId" TEXT,
    "objectKey" TEXT NOT NULL,
    "thumbnailKey" TEXT,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "committedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_objectKey_key" ON "Attachment"("objectKey");

-- CreateIndex
CREATE INDEX "Attachment_uploaderId_idx" ON "Attachment"("uploaderId");

-- CreateIndex
CREATE INDEX "Attachment_roomId_idx" ON "Attachment"("roomId");

-- CreateIndex
CREATE INDEX "Attachment_dmThreadId_idx" ON "Attachment"("dmThreadId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomMessage_attachmentId_key" ON "RoomMessage"("attachmentId");

-- CreateIndex
CREATE UNIQUE INDEX "DirectMessage_attachmentId_key" ON "DirectMessage"("attachmentId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_dmThreadId_fkey" FOREIGN KEY ("dmThreadId") REFERENCES "DirectMessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMessage" ADD CONSTRAINT "RoomMessage_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
