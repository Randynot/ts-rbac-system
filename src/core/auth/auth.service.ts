import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import * as bcrypt from 'bcrypt';

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
  ) {}
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
}
