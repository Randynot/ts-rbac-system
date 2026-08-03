import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Processor('auth')
export class AuthProcessor extends WorkerHost {
    private readonly logger = new Logger(AuthProcessor.name);
    private authService: AuthService

    constructor(authService: AuthService) {
        super()
        this.authService = authService
    }

    async process(job: Job) {
        this.logger.log(`Processing job ${job.id} → ${job.name}`);

        switch (job.name) {
            case 'reset-password':
                await this.authService.forgotPassword(job.data.email)
                break;
            default:
                throw new Error(`Unknown job: ${job.name}`);
        }
    }

    @OnWorkerEvent('completed')
    onCompleted(job: Job) {
        this.logger.log(`Job ${job.id} completed`);
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job, error: Error) {
        this.logger.error(`Job ${job.id} failed: ${error.message}`);
    }
}