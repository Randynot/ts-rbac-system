import { OnEvent } from '@nestjs/event-emitter';
import { Injectable } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SendVerificationEmailPayload } from './dto/verification-email.dto';


@Injectable()
export class AuthListener {

    constructor(
        @InjectQueue('email') private readonly emailQueue: Queue,
    ) { }

    @OnEvent('user.registered')
    async queueVerificationEmail(payload: SendVerificationEmailPayload) {
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