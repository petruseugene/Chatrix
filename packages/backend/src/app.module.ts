import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppConfigModule } from './config/config.module';
import { LoggerModule } from './logger/logger.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FriendshipModule } from './friendship/friendship.module';
import { DmModule } from './dm/dm.module';
import { RedisModule } from './redis/redis.module';
import { EventsModule } from './events/events.module';
import { PresenceModule } from './presence/presence.module';
import { RoomsModule } from './rooms/rooms.module';
import { AttachmentsModule } from './attachments/attachments.module';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule,
    PrismaModule,
    RedisModule,
    HealthModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    AuthModule,
    UsersModule,
    FriendshipModule,
    DmModule,
    EventsModule,
    PresenceModule,
    RoomsModule,
    AttachmentsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
