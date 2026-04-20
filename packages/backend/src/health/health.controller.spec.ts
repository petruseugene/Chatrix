import { Test, type TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: jest.Mocked<HealthService>;

  beforeEach(async () => {
    healthService = {
      check: jest.fn(),
    } as unknown as jest.Mocked<HealthService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: healthService }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('returns health response when DB is ok', async () => {
    healthService.check.mockResolvedValueOnce({ status: 'ok', db: 'ok' });
    const result = await controller.check();
    expect(result).toEqual({ status: 'ok', db: 'ok' });
  });

  it('throws 503 when DB is down', async () => {
    healthService.check.mockResolvedValueOnce({ status: 'error', db: 'error' });
    await expect(controller.check()).rejects.toThrow(
      new HttpException({ status: 'error', db: 'error' }, HttpStatus.SERVICE_UNAVAILABLE),
    );
  });
});
