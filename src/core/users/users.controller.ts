import { UsersService } from './users.service';

import {
  Controller,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('users')
export class UsersController {
  constructor(private readonly userService: UsersService) {}
  @Post('profile-picture')
  @UseInterceptors(FileInterceptor('file'))
  async uploadProfilePicture(
    @UploadedFile() file: Express.Multer.File,
    @Req() req,
  ) {
    return this.userService.uploadProfilePicture(req.user.id, file);
  }
}
