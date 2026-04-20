import { configSchema } from './config.schema';

const validConfig = {
  NODE_ENV: 'development',
  PORT: '3000',
  CORS_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'secret',
  JWT_REFRESH_SECRET: 'secret',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '30d',
  MINIO_ENDPOINT: 'localhost',
  MINIO_PORT: '9000',
  MINIO_ACCESS_KEY: 'key',
  MINIO_SECRET_KEY: 'secret',
  MINIO_BUCKET: 'bucket',
  MINIO_USE_SSL: 'false',
  XMPP_DOMAIN: 'test.local',
  XMPP_COMPONENT_SECRET: 'secret',
};

describe('configSchema', () => {
  it('parses valid config', () => {
    const result = configSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('coerces PORT to number', () => {
    const result = configSchema.safeParse(validConfig);
    expect(result.success && result.data.PORT).toBe(3000);
  });

  it('coerces MINIO_USE_SSL to boolean', () => {
    const result = configSchema.safeParse(validConfig);
    expect(result.success && result.data.MINIO_USE_SSL).toBe(false);
  });

  it('fails on missing required field', () => {
    const { CORS_ORIGIN: _, ...missingCors } = validConfig;
    const result = configSchema.safeParse(missingCors);
    expect(result.success).toBe(false);
  });

  it('fails on invalid NODE_ENV', () => {
    const result = configSchema.safeParse({ ...validConfig, NODE_ENV: 'invalid' });
    expect(result.success).toBe(false);
  });
});
