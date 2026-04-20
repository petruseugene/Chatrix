import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.use(helmet());
  // CORS_ORIGIN is validated by ConfigModule at boot; fallback avoids undefined for exactOptionalPropertyTypes
  app.enableCors({ origin: process.env['CORS_ORIGIN'] ?? '*' });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 3000;
  await app.listen(port);
}

bootstrap();
