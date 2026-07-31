import { Module } from '@nestjs/common';
import { redisProvider } from './redis.provider';
import { RedisHealthService } from './redis.health-check';

@Module({
    providers: [redisProvider, RedisHealthService],
    exports: [redisProvider],
})
export class RedisModule { }