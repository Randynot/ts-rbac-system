import { AuthService } from './auth.service';

import { Body, Controller, Post, Get, UseGuards, Query } from '@nestjs/common';

import { CreateAuthDto } from './dto/create-auth.dto';


import { jwtGuard } from './../auth/guards/jwt.guard';
import { RolesGuard } from './../../common/guards/roles/roles.guard';
import { Roles } from './../../common/decorators/roles.decorator';
import { UserRole } from './../../core/auth/entities/user.entity';


@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) { }

  @Post('login')
  login(@Body() createAuthDto: CreateAuthDto) {
    return this.authService.login(createAuthDto);
  }

  @Post('register')
  async register(@Body() dto: CreateAuthDto) {
    await this.authService.register(dto);
    return { message: 'Sign Up successful, verify Email.' };
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
