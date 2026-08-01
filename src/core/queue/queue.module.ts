// src/queue/queue.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailProcessor } from './processors/email.processor';
import { EmailModule } from '../email/email.module';

@Module({
    imports: [
        EmailModule,
        ConfigModule,
        BullModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                connection: {
                    host: configService.getOrThrow<string>('redisConfig.host'),
                    port: configService.getOrThrow<number>('redisConfig.port'),
                },
            }),
        }),

        BullModule.registerQueue(
            { name: 'email' }
        ),
    ],
    providers: [
        EmailProcessor
    ],
    exports: [BullModule],
})
export class QueueModule { }