// src/queue/queue.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailProcessor } from '../email/email.processor';
import { EmailModule } from '../email/email.module';
import { AuthModule } from '../auth/auth.module';
import { AuthProcessor } from '../auth/processors/auth.processor'

@Module({
    imports: [
        EmailModule,
        ConfigModule,
        forwardRef(() => AuthModule),
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
            { name: 'email' },
            { name: 'auth' }
        ),
    ],
    providers: [
        EmailProcessor,
        AuthProcessor
    ],
    exports: [BullModule],
})
export class QueueModule { }