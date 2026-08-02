import { AuthService } from './auth.service';

import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { Roles } from './../../common/decorators/roles.decorator';
import { RolesGuard } from './../../common/guards/roles/roles.guard';
import { UserRole } from './../../core/auth/entities/user.entity';
import { jwtGuard } from './../auth/guards/jwt.guard';
import { CreateAuthDto } from './dto/create-auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(
    @Body() createAuthDto: CreateAuthDto,
  ): Promise<{ accessToken: string }> {
    return this.authService.login(createAuthDto);
  }
  @Post('register')
  register(@Body() dto: CreateAuthDto): Promise<{ id: string; email: string }> {
    return this.authService.register(dto);
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
