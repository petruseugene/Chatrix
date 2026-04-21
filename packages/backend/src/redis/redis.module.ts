import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { AppConfig } from '../config/config.schema';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): Redis => {
        return new Redis(config.get('REDIS_URL', { infer: true }));
      },
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}
