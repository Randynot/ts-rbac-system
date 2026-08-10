import { UsersService } from './users.service';

import {
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import type { Request } from 'express';

import { jwtGuard } from '../auth/guards/jwt.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly userService: UsersService) {}
  @Post('profile-picture')
  @UseGuards(jwtGuard)
  @UseInterceptors(FileInterceptor('file'))
  uploadProfilePicture(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request & { user: { id: string } },
  ): { message: string } {
    return this.userService.uploadProfilePicture(req.user.id, file);
  }
}
