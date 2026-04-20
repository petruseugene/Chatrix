import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';

describe('AppModule', () => {
  it('compiles with valid env', async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(module).toBeDefined();
    await module.close();
  });
});
