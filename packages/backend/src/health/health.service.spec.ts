import { Test, type TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthService', () => {
  let service: HealthService;
  let prisma: jest.Mocked<Pick<PrismaService, '$queryRaw'>>;

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [HealthService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('returns { status: ok, db: ok } when DB is reachable', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ '?column?': 1 }]);
    const result = await service.check();
    expect(result).toEqual({ status: 'ok', db: 'ok' });
  });

  it('returns { status: error, db: error } when DB throws', async () => {
    (prisma.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('connection refused'));
    const result = await service.check();
    expect(result).toEqual({ status: 'error', db: 'error' });
  });
});
