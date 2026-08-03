import { OnEvent } from '@nestjs/event-emitter';
import { Injectable } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SendVerificationEmailPayload } from './dto/verification-email.dto';
import { Logger } from '@nestjs/common';


@Injectable()
export class AuthListener {
    private readonly logger = new Logger(AuthListener.name);

    constructor(
        @InjectQueue('email') private readonly emailQueue: Queue,
        @InjectQueue('auth') private readonly authQueue: Queue,
    ) { }
    @OnEvent('user.registered')
    async queueVerificationEmail(payload: SendVerificationEmailPayload) {
        this.logger.log(`queueVerificationEmail called: ${JSON.stringify(payload)}`)
        const { token, email } = payload;
        await this.emailQueue.add(
            'send-verification',
            {
                email: email,
                token: token
            },
            {
                attempts: 3,
                backoff: { type: 'exponential', delay: 2000 },
                removeOnComplete: true,
                removeOnFail: false,
            },
        )
    }

    @OnEvent('user.forgot-password')
    async queuePasswordResetEmail(payload: { email: string; token: string }) {
        this.logger.log(`Reset password queued`);
        const { email, token } = payload;

        await this.emailQueue.add(
            'send-reset-email',
            { email, token },
            {
                attempts: 3,
                backoff: { type: 'exponential', delay: 2000 },
                removeOnComplete: true,
                removeOnFail: false,
            },
        );
    }

    @OnEvent('user.reset-password-process')
    async queueResetProcess(email: string) {
        this.logger.log(`Reset password process queued`);

        await this.authQueue.add(
            'reset-password',
            {email},
            {
                attempts: 3,
                backoff: { type: 'exponential', delay: 2000 },
                removeOnComplete: true,
                removeOnFail: false,
            },
        );
    }


}