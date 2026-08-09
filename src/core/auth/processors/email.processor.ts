import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { SendVerificationEmailPayload } from '../dto/verification-email.dto';
import { Job } from 'bullmq';

// import { SendVerificationEmailPayload } from '../../auth/dto/verification-email.dto';
import { EmailService } from '../../email/email.service';
import { EmailJobData } from '../../queue/queue.interface';
import { error } from 'console';

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
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }

  @OnWorkerEvent('error')
  onError(error: Error): void {
    this.logger.error(`Worker error: ${error.message}`);
  }
}

