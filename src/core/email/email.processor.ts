import { EmailService } from './email.service';

import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { Job } from 'bullmq';

import { EmailJobData } from '../queue/queue.interface';

@Processor('email')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  private readonly emailService: EmailService;

  constructor(emailService: EmailService) {
    super();
    this.emailService = emailService;
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    this.logger.log(`Processing job ${job.id} → ${job.name}`);

    switch (job.name) {
      case 'send-verification':
        await this.emailService.sendVerificationEmail(
          job.data.email,
          job.data.token,
        );
        break;
      case 'send-reset-email':
        await this.emailService.sendResetEmail(job.data.email, job.data.token);
        break;
      default:
        throw new Error(`Unknown job: ${job.name}`);
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.logger.log(`Job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }
}
