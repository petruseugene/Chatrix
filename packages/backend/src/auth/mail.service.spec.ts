import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

const mockConfig = (nodeEnv: string) => ({
  get: jest.fn((key: string) => {
    const map: Record<string, unknown> = {
      NODE_ENV: nodeEnv,
      CORS_ORIGIN: 'http://localhost:5173',
      SMTP_HOST: 'smtp.test.com',
      SMTP_PORT: 587,
      SMTP_USER: 'user',
      SMTP_PASS: 'pass',
      SMTP_FROM: 'noreply@test.com',
    };
    return map[key];
  }),
});

describe('MailService', () => {
  let service: MailService;
  let consoleSpy: jest.SpyInstance;

  beforeEach(async () => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => consoleSpy.mockRestore());

  describe('in development', () => {
    beforeEach(async () => {
      const module = await Test.createTestingModule({
        providers: [MailService, { provide: ConfigService, useValue: mockConfig('development') }],
      }).compile();
      service = module.get(MailService);
    });

    it('logs the reset URL to console instead of sending email', async () => {
      await service.sendPasswordReset('user@example.com', 'abc123token');
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const logged: string = consoleSpy.mock.calls[0][0] as string;
      expect(logged).toContain('abc123token');
      expect(logged).toContain('user@example.com');
    });
  });

  describe('in production', () => {
    beforeEach(async () => {
      const module = await Test.createTestingModule({
        providers: [MailService, { provide: ConfigService, useValue: mockConfig('production') }],
      }).compile();
      service = module.get(MailService);
    });

    it('calls nodemailer sendMail with correct recipient', async () => {
      const sendMailMock = jest.fn().mockResolvedValue({});
      jest
        .spyOn(
          service as unknown as { getTransporter: () => { sendMail: jest.Mock } },
          'getTransporter',
        )
        .mockReturnValue({ sendMail: sendMailMock });
      await service.sendPasswordReset('prod@example.com', 'tok999');
      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'prod@example.com' }),
      );
    });
  });
});
