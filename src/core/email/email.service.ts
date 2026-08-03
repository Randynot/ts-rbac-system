import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
    private readonly resend: Resend;
    private readonly logger = new Logger(EmailService.name);

    constructor(private readonly configService: ConfigService) {
        this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
    }

    async sendEmail(params: {
        to: string | string[];
        subject: string;
        html: string;
        from?: string;
    }) {
        const { data, error } = await this.resend.emails.send({
            from: params.from ?? 'Acme <onboarding@resend.dev>', // use your verified domain in prod
            to: params.to,
            subject: params.subject,
            html: params.html,
        });

        if (error) {
            this.logger.error(`Failed to send email: ${error.message}`);
            throw new Error(error.message);
        }

        return data;
    }

    async sendVerificationEmail(to: string, token: string) {
        const verificationLink = `${this.configService.get<string>('LOCALHOST')}/auth/verify-email?token=${token}`;
        await this.sendEmail({
            to,
            subject: 'Verify your email',
            html: `<p>Please click the following link to verify your email: <a href="${verificationLink}">Verify Email</a></p>`,
        });
    }

    async sendResetEmail(to: string, token: string) {
        const resetLink = `${this.configService.get<string>('LOCALHOST')}/auth/reset-password?token=${token}`;
        await this.sendEmail({
            to,
            subject: 'Reset your Password',
            html: `<p>Please click the following link to reset your password: <a href="${resetLink}">Reset Password</a></p>`,
        });
    }
}