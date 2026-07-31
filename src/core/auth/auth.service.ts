import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { AccountStatus } from './entities/user.entity';
import { UUID } from 'node:crypto';

import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

import { UsersService } from '../users/users.service';

import { CreateAuthDto } from './dto/create-auth.dto';
import { User } from './entities/user.entity';

const DUMMY_PASSWORD_HASH =
  '$2b$12$MwL2hICCvJC6Ft2pCEb/o.TxXNtKk8bgxTDbE0SYclpdRrSxrpN0u';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
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
      secret: this.configService.getOrThrow<string>('appConfig.auth.jwtVerificationSecret'),
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
}
