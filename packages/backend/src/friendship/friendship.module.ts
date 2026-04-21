import { Module } from '@nestjs/common';
import { FriendshipController } from './friendship.controller';
import { FriendshipService } from './friendship.service';
import { FriendshipGateway } from './friendship.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [PrismaModule, AuthModule, EventsModule],
  controllers: [FriendshipController],
  providers: [FriendshipService, FriendshipGateway],
  exports: [FriendshipService],
})
export class FriendshipModule {}
