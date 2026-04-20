import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule, type Params } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): Params => {
        const isProduction = config.get('NODE_ENV') === 'production';
        const pinoHttpBase = {
          level: isProduction ? 'info' : 'debug',
        } as const;

        if (isProduction) {
          return { pinoHttp: pinoHttpBase };
        }

        return {
          pinoHttp: {
            ...pinoHttpBase,
            transport: { target: 'pino-pretty', options: { colorize: true } },
          },
        };
      },
    }),
  ],
})
export class LoggerModule {}
