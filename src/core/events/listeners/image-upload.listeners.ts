import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { CloudinaryService } from '../../cloudinary/cloudinary.service';

@Injectable()
export class ProfileUploadListener {
  constructor(private cloudinaryService: CloudinaryService) {}
  @OnEvent('profile.upload', { async: true })
  async handleProfileUploadEvent(payload: {
    userId: string;
    file: Express.Multer.File;
  }) {
    try {
      const result = await this.cloudinaryService.uploadImage(payload.file);
    } catch (error) {}
  }
}
