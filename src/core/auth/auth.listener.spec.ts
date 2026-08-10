import { AuthListener } from './auth.listener';

import { Queue } from 'bullmq';

describe('AuthListener', () => {
  it('queues verification email jobs with retry settings', async () => {
    const add = jest.fn().mockResolvedValue({ id: 'job-id' });
    const emailQueue = { add } as unknown as Queue;
    const authQueue = { add: jest.fn() } as unknown as Queue;
    const listener = new AuthListener(emailQueue, authQueue);
    const payload = { email: 'user@example.com', token: 'token-value' };

    await listener.queueVerificationEmail(payload);

    expect(add).toHaveBeenCalledWith('send-verification', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: false,
    });
  });

  it('propagates queue failures so the event emitter can report them', async () => {
    const add = jest.fn().mockRejectedValue(new Error('Redis unavailable'));
    const emailQueue = { add } as unknown as Queue;
    const authQueue = { add: jest.fn() } as unknown as Queue;
    const listener = new AuthListener(emailQueue, authQueue);

    await expect(
      listener.queueVerificationEmail({
        email: 'user@example.com',
        token: 'token-value',
      }),
    ).rejects.toThrow('Redis unavailable');
  });
});