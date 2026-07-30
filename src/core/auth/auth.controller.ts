import { AuthService } from './auth.service';

import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { Roles } from './../../common/decorators/roles.decorator';
import { RolesGuard } from './../../common/guards/roles/roles.guard';
import { UserRole } from './../../core/auth/entities/user.entity';
import { jwtGuard } from './../auth/guards/jwt.guard';
import { CreateAuthDto } from './dto/create-auth.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import {
  LoginResponse,
  RegisterResponse,
} from './interfaces/auth-response.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() createAuthDto: CreateAuthDto): Promise<LoginResponse> {
    return this.authService.login(createAuthDto);
  }

  @Post('register')
  register(@Body() dto: CreateAuthDto): Promise<RegisterResponse> {
    return this.authService.register(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto): Promise<LoginResponse> {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  logout(@Body() dto: RefreshTokenDto): Promise<{ message: string }> {
    return this.authService.logout(dto.refreshToken);
  }

  @Get('admin-test')
  @UseGuards(jwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  adminTest(): { message: string } {
    return {
      message: 'You have admin access',
    };
  }
}
