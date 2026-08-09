import { EmailProcessor } from './email.processor';

import { Job } from 'bullmq';

import { EmailService } from '../../email/email.service';

describe('EmailProcessor', () => {
  let sendVerificationEmail: jest.Mock;
  let processor: EmailProcessor;

  beforeEach(() => {
    sendVerificationEmail = jest.fn().mockResolvedValue(undefined);
    processor = new EmailProcessor({
      sendVerificationEmail,
    } as unknown as EmailService);
  });

  it('processes verification jobs using their typed payload', async () => {
    const job = {
      id: 'job-id',
      name: 'send-verification',
      data: { email: 'user@example.com', token: 'token-value' },
    } as Job<{ email: string; token: string }>;

    await processor.process(job);

    expect(sendVerificationEmail).toHaveBeenCalledWith(
      'user@example.com',
      'token-value',
    );
  });

  it('rejects unknown job names', async () => {
    const job = {
      id: 'job-id',
      name: 'unknown-job',
      data: { email: 'user@example.com', token: 'token-value' },
    } as Job<{ email: string; token: string }>;

    await expect(processor.process(job)).rejects.toThrow(
      'Unknown job: unknown-job',
    );
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });
});
