import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { compare, hash } from 'bcrypt';

import { UsersService } from '../users/users.service';

import { CreateAuthDto } from './dto/create-auth.dto';
import { User } from './entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersService.findOneByEmailWithPassword(email);
    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const isLocked = await this.usersService.isAccountLocked(user.id);

    if (isLocked) {
      throw new UnauthorizedException(
        'Account temporarily locked. Try again later.',
      );
    }

    const isMatch = await compare(password, user.password);
    if (!isMatch) {
      await this.usersService.incrementFailedAttempts(user.id);
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.usersService.resetFailedAttempts(user.id);
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

    const hashedPassword = await hash(createAuthDto.password, 10);
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
