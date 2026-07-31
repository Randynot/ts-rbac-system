import { AuthService } from './auth.service';

import { Body, Controller, Post, Get, UseGuards, Query } from '@nestjs/common';

import { CreateAuthDto } from './dto/create-auth.dto';
import { SendVerificationEmailPayload } from './dto/verification-email.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';


import { jwtGuard } from './../auth/guards/jwt.guard';
import { RolesGuard } from './../../common/guards/roles/roles.guard';
import { Roles } from './../../common/decorators/roles.decorator';
import { UserRole } from './../../core/auth/entities/user.entity';


@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private eventEmitter: EventEmitter2
  ) { }

  @Post('login')
  login(@Body() createAuthDto: CreateAuthDto) {
    return this.authService.login(createAuthDto);
  }
  @Post('register')
  async register(@Body() dto: CreateAuthDto) {
    const user = await this.authService.register(dto);
    const verificationToken = await this.authService.verificationSecret(user);

    const payload: SendVerificationEmailPayload = {
      email: user.email,
      token: verificationToken,
    };

    this.eventEmitter.emit('user.registered', payload);

    return { message: 'Sign Up successful, verify Email.' }
  }

  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }



  @Get('admin-test')
  @UseGuards(jwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  adminTest() {
    return {
      message: 'You have admin access',
    };
  }
}
