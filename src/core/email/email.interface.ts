export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

export interface EmailJobData {
  email: string;
  token: string;
}
