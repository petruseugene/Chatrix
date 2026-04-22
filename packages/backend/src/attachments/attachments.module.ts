import { Module } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { AttachmentsController } from './attachments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { FriendshipModule } from '../friendship/friendship.module';

@Module({
  imports: [PrismaModule, FriendshipModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
