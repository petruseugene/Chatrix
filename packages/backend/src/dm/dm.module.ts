import { Module } from '@nestjs/common';
import { DmController } from './dm.controller';
import { DmService } from './dm.service';
import { DmGateway } from './dm.gateway';
import { FriendshipModule } from '../friendship/friendship.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AttachmentsModule } from '../attachments/attachments.module';

@Module({
  imports: [PrismaModule, FriendshipModule, AuthModule, AttachmentsModule],
  controllers: [DmController],
  providers: [DmService, DmGateway],
})
export class DmModule {}
