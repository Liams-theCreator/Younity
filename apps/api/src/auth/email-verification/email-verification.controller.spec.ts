import { Test, TestingModule } from '@nestjs/testing';
import { EmailVerificationController } from './email-verification.controller.js';
import { EmailVerificationService } from './email-verification.service.js';

describe('EmailVerificationController', () => {
  let controller: EmailVerificationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailVerificationController],
      providers: [{ provide: EmailVerificationService, useValue: { verifyEmail: vi.fn().mockResolvedValue({ message: 'Email verified successfully.' }) } }],
    }).compile();

    controller = module.get<EmailVerificationController>(EmailVerificationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('passes the token to the verification service', async () => {
    await expect(controller.verifyEmail({ token: 'a'.repeat(64) })).resolves.toEqual({ message: 'Email verified successfully.' });
  });
});
