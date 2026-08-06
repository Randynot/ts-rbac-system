import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';



import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { UsersService } from '../../users/users.service';

@Injectable()
export class ProfileUploadListener {
  constructor(
    private readonly cloudinaryService: CloudinaryService,
    private readonly usersService: UsersService,
  ) {}
  @OnEvent('user.profile_picture.upload', { async: true })
  async handleProfileUploadEvent(payload: {
    userId: string;
    file: Express.Multer.File;
  }) {
    try {
      const result = await this.cloudinaryService.uploadImage(payload.file);
      await this.usersService.updateProfilePicture(
        payload.userId,
        result.secure_url,
      );
    } catch (error) {}
  }
}
