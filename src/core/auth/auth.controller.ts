import { AuthService } from './auth.service';

import { Body, Controller, Post } from '@nestjs/common';

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
}
