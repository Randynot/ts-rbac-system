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
}