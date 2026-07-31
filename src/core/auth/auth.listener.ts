import { OnEvent } from '@nestjs/event-emitter';
import { Injectable } from '@nestjs/common'

@Injectable()
export class AuthListener {

    @OnEvent('user.registered')
    async queueVerificationEmail(token: string) {
        //function to add send email to queue that takes (token, useremail) as arg
    }
}