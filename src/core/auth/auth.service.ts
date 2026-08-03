import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { AccountStatus } from './entities/user.entity';
import { UUID } from 'node:crypto';

import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

import { UsersService } from '../users/users.service';

import { CreateAuthDto } from './dto/create-auth.dto';
import { User } from './entities/user.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SendVerificationEmailPayload } from './dto/verification-email.dto';
import { Logger } from '@nestjs/common';

const DUMMY_PASSWORD_HASH =
  '$2b$12$MwL2hICCvJC6Ft2pCEb/o.TxXNtKk8bgxTDbE0SYclpdRrSxrpN0u';

@Injectable()
export class AuthService {

  private readonly logger = new Logger(AuthService.name);
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) { }
  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersService.findOneByEmailWithPassword(email);
    if (!user || !user.password) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException('Invalid credentials');
    }

    const now = Date.now();
    if (user.lockedUntil && user.lockedUntil.getTime() > now) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockedUntil) {
      await this.usersService.resetFailedAttempts(user.id);
      user.loginAttempts = 0;
      user.lockedUntil = null;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await this.usersService.incrementFailedAttempts(user.id);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.loginAttempts > 0) {
      await this.usersService.resetFailedAttempts(user.id);
    }

    if (!user.isVerified) {
      throw new ForbiddenException('Please verify your email to continue');
    }
    return user;
  }

  async register(
    createAuthDto: CreateAuthDto,
  ): Promise<{ id: string; email: string }> {
    const existingUser = await this.usersService.findOneByEmail(
      createAuthDto.email,
    );
    if (existingUser) {
      throw new BadRequestException('Email is already registered');
    }

    const hashedPassword = await bcrypt.hash(createAuthDto.password, 10);
    const user = await this.usersService.create({
      email: createAuthDto.email,
      name: createAuthDto.email.split('@')[0],
      password: hashedPassword,
    });

    const verificationToken = await this.verificationSecret({
      id: user.id,
      email: user.email,
    });

    const payload: SendVerificationEmailPayload = {
      email: user.email,
      token: verificationToken,
    };
    this.eventEmitter.emit('user.registered', payload);

    return {
      id: user.id,
      email: user.email,
    };
  }


  async login(createAuthDto: CreateAuthDto): Promise<{ accessToken: string }> {
    const user = await this.validateUser(
      createAuthDto.email,
      createAuthDto.password,
    );
    const payload = { sub: user.id, email: user.email, role: user.role };

    return {
      accessToken: await this.jwtService.signAsync(payload),
    };
  }

  async verificationSecret(data: { id: string; email: string }) {
    const payload = { sub: data.id, email: data.email, purpose: 'email-verification' };

    const token = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('appConfig.auth.jwtResetSecret'),
      expiresIn: '15m',
    });

    await this.usersService.update(data.id as UUID, { verificationToken: token });

    return token;
  }

  async verifyEmail(token: string) {
    let payload: { sub: string; email: string; purpose: string };

    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.getOrThrow<string>('appConfig.auth.jwtVerificationSecret'),
      });
    } catch (err) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (payload.purpose !== 'email-verification') {
      throw new BadRequestException('Invalid or expired verification token');
    }

    const user = await this.usersService.findOneById(payload.sub as UUID);
    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (user.verificationToken !== token) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.usersService.update(user.id as UUID, {
      status: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      isVerified: true,
      verificationToken: null,
    });

    return { verified: true };
  }

  async queueForgotPasswordProcess(email: string) {
    this.eventEmitter.emit('user.reset-password-process', email);
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      return
    }

    const payload = { sub: user?.id, purpose: 'password-reset' };

    const token = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('appConfig.auth.jwtResetSecret'),
      expiresIn: '15m',
    });
    await this.usersService.update(user?.id as UUID, { resetToken: null });
    const tokenHash = await bcrypt.hash(token, 10)
    await this.usersService.update(user?.id as UUID, { resetToken: tokenHash })

    this.eventEmitter.emit('user.forgot-password', { email: email, token: token });

    return
  }

  async resetPassword(token: string, password: string) {

    let payload: { sub: string; purpose: string };

    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.getOrThrow<string>('appConfig.auth.jwtResetSecret'),
      });
    } catch (err) {
      throw new BadRequestException('Invalid or expired reset token/ bad token');
    }

    if (payload.purpose !== 'password-reset') {
      throw new BadRequestException('Invalid or expired reset token/ purpose');
    }

    const user = await this.usersService.findOneById(payload.sub as UUID);
    if (!user || !user.resetToken) {
      throw new BadRequestException('Invalid or expired reset token/ no user or reset token');
    }

    const tokenMatches = await bcrypt.compare(token, user.resetToken);
    if (!tokenMatches) {
      throw new BadRequestException('Invalid or expired reset token/ token mismatch');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await this.usersService.update(user.id as UUID, {
      password: hashedPassword,
      resetToken: null,
      loginAttempts: 0
    })

    await this.usersService.revokeAllRefreshTokens(user.id as UUID, 'Password reset');
    return { message: 'Password has been reset successfully.' };
  }

}
