import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';

describe('AppModule', () => {
  it('compiles with valid env', async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['PORT'] = '3000';
    process.env['CORS_ORIGIN'] = 'http://localhost:5173';
    process.env['DATABASE_URL'] = 'postgresql://user:pass@localhost:5432/db';
    process.env['REDIS_URL'] = 'redis://localhost:6379';
    process.env['JWT_ACCESS_SECRET'] = 'test-secret';
    process.env['JWT_REFRESH_SECRET'] = 'test-secret';
    process.env['JWT_ACCESS_TTL'] = '15m';
    process.env['JWT_REFRESH_TTL'] = '30d';
    process.env['MINIO_ENDPOINT'] = 'localhost';
    process.env['MINIO_PORT'] = '9000';
    process.env['MINIO_ACCESS_KEY'] = 'test';
    process.env['MINIO_SECRET_KEY'] = 'test';
    process.env['MINIO_BUCKET'] = 'test-bucket';
    process.env['MINIO_USE_SSL'] = 'false';
    process.env['XMPP_DOMAIN'] = 'test.local';
    process.env['XMPP_COMPONENT_SECRET'] = 'test-secret';

    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(module).toBeDefined();
    await module.close();
  });
});
