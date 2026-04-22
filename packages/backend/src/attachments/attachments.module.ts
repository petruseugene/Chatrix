import { Module } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FriendshipModule } from '../friendship/friendship.module';

@Module({
  imports: [PrismaModule, FriendshipModule],
  providers: [AttachmentsService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
