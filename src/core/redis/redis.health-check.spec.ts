import { RedisHealthService } from './redis.health-check';

import { Logger } from '@nestjs/common';

import { Redis } from 'ioredis';

describe('RedisHealthService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs a successful Redis ping', async () => {
    const ping = jest.fn().mockResolvedValue('PONG');
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const service = new RedisHealthService({ ping } as unknown as Redis);

    await service.onApplicationBootstrap();

    expect(ping).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('Redis connected: PONG');
  });

  it('logs connection failures without crashing application startup', async () => {
    const error = new Error('Connection refused');
    const ping = jest.fn().mockRejectedValue(error);
    const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const service = new RedisHealthService({ ping } as unknown as Redis);

    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledWith('Redis connection failed', error);
  });
});
