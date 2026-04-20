import { Test } from '@nestjs/testing';
import { ArgonService } from './argon.service';

describe('ArgonService', () => {
  let service: ArgonService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ArgonService],
    }).compile();
    service = module.get(ArgonService);
  });

  describe('hash', () => {
    it('returns a string different from the input', async () => {
      const hash = await service.hash('my-password');
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe('my-password');
    });

    it('returns a different hash for the same input (random salt)', async () => {
      const h1 = await service.hash('same');
      const h2 = await service.hash('same');
      expect(h1).not.toBe(h2);
    });
  });

  describe('verify', () => {
    it('returns true for the correct password', async () => {
      const hash = await service.hash('correct');
      expect(await service.verify(hash, 'correct')).toBe(true);
    });

    it('returns false for the wrong password', async () => {
      const hash = await service.hash('correct');
      expect(await service.verify(hash, 'wrong')).toBe(false);
    });
  });
});
