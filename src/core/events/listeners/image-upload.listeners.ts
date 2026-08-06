import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { CloudinaryService } from '../../cloudinary/cloudinary.service';

@Injectable()
export class ProfileUploadListener {
  constructor(private readonly cloudinaryService: CloudinaryService) {}
  @OnEvent('user.profile_picture.upload', { async: true })
  async handleProfileUploadEvent(payload: {
    userId: string;
    file: Express.Multer.File;
  }) {
    try {
      const result = await this.cloudinaryService.uploadImage(payload.file);
    } catch (error) {}
  }
}
