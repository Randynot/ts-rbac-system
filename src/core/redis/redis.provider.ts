import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const redisProvider = {
    provide: REDIS_CLIENT,
    inject: [ConfigService],
    useFactory: (configService: ConfigService) => {
        return new Redis({
            host: configService.getOrThrow<string>('redisConfig.host'),
            port: configService.getOrThrow<number>('redisConfig.port'),
        });
    },
};