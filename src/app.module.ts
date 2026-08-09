// Import all the system modules here
// Import Controller and Service
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from './core/auth/auth.module';
import { QueueModule } from './core/queue/queue.module';
import { RedisModule } from './core/redis/redis.module';
import { UsersModule } from './core/users/users.module';
import appConfig from './shared/config/app.config';
import { databaseConfig } from './shared/config/database.config';
import redisConfig from './shared/config/redis.config';

@Module({
  imports: [
    // 1. Core system configuration
    ConfigModule.forRoot({
      load: [databaseConfig, appConfig, redisConfig],
      isGlobal: true,
      envFilePath: '.env',
      expandVariables: true,
    }),
    AuthModule,
    UsersModule,
    QueueModule,
    EventEmitterModule.forRoot(),
    RedisModule,

    // 2. Rate Limiting -> 10 req/min
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60,
          limit: 10,
        },
      ],
    }),

    // 3. Cache module
    CacheModule.register({
      isGlobal: true,
      ttl: 30000,
      max: 100, // Items in the cache
    }),

    // 4. Database connection
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        configService.getOrThrow('database'),
    }),

    // 5. Scheduled tasks
    ScheduleModule.forRoot(),

    // 6. Feature and utility modules (call them here), (Utility - EventsModule and EmailModule)
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
