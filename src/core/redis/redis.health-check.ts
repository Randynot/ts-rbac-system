import { Injectable, Inject, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.provider';

@Injectable()
export class RedisHealthService implements OnApplicationBootstrap {
    private readonly logger = new Logger(RedisHealthService.name);

    constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) { }

    async onApplicationBootstrap() {
        try {
            const result = await this.redis.ping();
            this.logger.log(`Redis connected: ${result}`);
        } catch (err) {
            this.logger.error('Redis connection failed', err);
        }
    }
}