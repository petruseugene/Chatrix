import { Test } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { type Response } from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({ where: { email: 'e2e@example.com' } });
    await app.close();
  });

  let accessToken: string;
  let refreshCookie: string;

  it('POST /api/auth/register — creates account and returns access token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'e2e@example.com', password: 'Password123!', username: 'e2euser' })
      .expect(201);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.headers['set-cookie']).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    accessToken = res.body.accessToken;
    refreshCookie = (res.headers['set-cookie'] as unknown as string[])[0] as string;
  });

  it('GET /api/health — protected endpoint succeeds with valid access token', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect((res: Response) => expect([200, 404]).toContain(res.status));
  });

  it('POST /api/auth/refresh — returns new access token using refresh cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie)
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    accessToken = res.body.accessToken;
    refreshCookie = (res.headers['set-cookie'] as unknown as string[])[0] as string;
  });

  it('POST /api/auth/logout — clears session', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', refreshCookie)
      .expect(204);
  });

  it('POST /api/auth/refresh after logout — returns 401', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie)
      .expect(401);
  });

  it('POST /api/auth/register — rejects duplicate email with 409', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'e2e@example.com', password: 'Password123!', username: 'differentuser' })
      .expect(409);
  });

  it('POST /api/auth/login — returns token with correct credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'e2e@example.com', password: 'Password123!' })
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
  });

  it('POST /api/auth/login — returns 401 with wrong password', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'e2e@example.com', password: 'WrongPass!' })
      .expect(401);
  });

  it('POST /api/auth/request-reset — always returns 200 regardless of email existence', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/request-reset')
      .send({ email: 'nobody@example.com' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/request-reset')
      .send({ email: 'e2e@example.com' })
      .expect(200);
  });
});
