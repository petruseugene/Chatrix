/**
 * Jest setup file: pre-populate all required env vars before any module is
 * imported so that NestJS ConfigModule.forRoot validation passes during
 * module compilation in tests.
 */
process.env['NODE_ENV'] = process.env['NODE_ENV'] ?? 'test';
process.env['PORT'] = process.env['PORT'] ?? '3000';
process.env['CORS_ORIGIN'] = process.env['CORS_ORIGIN'] ?? 'http://localhost:5173';
process.env['DATABASE_URL'] =
  process.env['DATABASE_URL'] ?? 'postgresql://user:pass@localhost:5432/db';
process.env['REDIS_URL'] = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
process.env['JWT_ACCESS_SECRET'] =
  process.env['JWT_ACCESS_SECRET'] ?? 'test-access-secret-that-is-long-enough-32ch';
process.env['JWT_REFRESH_SECRET'] =
  process.env['JWT_REFRESH_SECRET'] ?? 'test-refresh-secret-that-is-long-enough-32ch';
process.env['JWT_ACCESS_TTL'] = process.env['JWT_ACCESS_TTL'] ?? '15m';
process.env['JWT_REFRESH_TTL'] = process.env['JWT_REFRESH_TTL'] ?? '30d';
process.env['MINIO_ENDPOINT'] = process.env['MINIO_ENDPOINT'] ?? 'localhost';
process.env['MINIO_PORT'] = process.env['MINIO_PORT'] ?? '9000';
process.env['MINIO_ACCESS_KEY'] = process.env['MINIO_ACCESS_KEY'] ?? 'test-access-key';
process.env['MINIO_SECRET_KEY'] = process.env['MINIO_SECRET_KEY'] ?? 'test-secret-key';
process.env['MINIO_BUCKET'] = process.env['MINIO_BUCKET'] ?? 'test-bucket';
process.env['MINIO_USE_SSL'] = process.env['MINIO_USE_SSL'] ?? 'false';
process.env['XMPP_DOMAIN'] = process.env['XMPP_DOMAIN'] ?? 'test.local';
process.env['XMPP_COMPONENT_SECRET'] = process.env['XMPP_COMPONENT_SECRET'] ?? 'test-xmpp-secret';
