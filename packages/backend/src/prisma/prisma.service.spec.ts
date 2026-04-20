import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();
    service = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('calls $connect on onModuleInit', async () => {
    const connectSpy = jest.spyOn(service, '$connect').mockResolvedValueOnce(undefined);
    await service.onModuleInit();
    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  it('calls $disconnect on onModuleDestroy', async () => {
    const disconnectSpy = jest.spyOn(service, '$disconnect').mockResolvedValueOnce(undefined);
    await service.onModuleDestroy();
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });
});
