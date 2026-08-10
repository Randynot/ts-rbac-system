import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { UsersService } from '../../users/users.service';

@Injectable()
export class ProfileUploadListener {
  private readonly logger = new Logger(ProfileUploadListener.name);

  constructor(
    private readonly cloudinaryService: CloudinaryService,
    private readonly usersService: UsersService,
  ) {}
  @OnEvent('user.profile_picture.upload', { async: true })
  async handleProfileUploadEvent(payload: {
    userId: string;
    file: Express.Multer.File;
  }): Promise<void> {
    try {
      const result = await this.cloudinaryService.uploadImage(payload.file);
      await this.usersService.updateProfilePicture(
        payload.userId,
        result.secure_url,
      );
    } catch (error: unknown) {
      this.logger.error('Profile picture upload failed', error);
    }
  }
}
