export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}
