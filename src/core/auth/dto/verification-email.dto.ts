import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class SendVerificationEmailPayload {
  @Transform(({ value }) => {
    const input: unknown = value;
    return typeof input === 'string' ? input.trim().toLowerCase() : input;
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : (value as string),
  )
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  token!: string;
}
