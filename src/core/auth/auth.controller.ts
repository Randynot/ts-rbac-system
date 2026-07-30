import { AuthService } from './auth.service';

import { Body, Controller, Post, Get, UseGuards } from '@nestjs/common';

import { CreateAuthDto } from './dto/create-auth.dto';

import { jwtGuard } from './../auth/guards/jwt.guard';
import { RolesGuard } from './../../common/guards/roles/roles.guard';
import { Roles } from './../../common/decorators/roles.decorator';
import { UserRole } from './../../core/auth/entities/user.entity';


@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() createAuthDto: CreateAuthDto) {
    return this.authService.login(createAuthDto);
  }
  @Post('register')
  register(@Body() dto: CreateAuthDto) {
    return this.authService.register(dto);
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
