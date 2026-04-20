import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { LoggerModule } from './logger/logger.module';

@Module({
  imports: [AppConfigModule, LoggerModule],
})
export class AppModule {}
