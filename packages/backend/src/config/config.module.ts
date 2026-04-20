import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { configSchema } from './config.schema';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => {
        const result = configSchema.safeParse(config);
        if (!result.success) {
          throw new Error(
            `Config validation error:\n${result.error.issues
              .map((i) => `  ${i.path.join('.')}: ${i.message}`)
              .join('\n')}`,
          );
        }
        return result.data;
      },
    }),
  ],
})
export class AppConfigModule {}
