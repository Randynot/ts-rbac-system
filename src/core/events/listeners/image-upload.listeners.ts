import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { CloudinaryService } from '../../cloudinary/cloudinary.service';

@Injectable()
export class ProfileUploadListener {
  constructor(private cloudinaryService: CloudinaryService) {}
  @OnEvent('profile.upload', { async: true })
  async handleProfileUploadEvent(payload: {
    usrId: string;
    file: Express.Multer.file;
  }) {
    try {
      const result = await this.cloudinaryService.uploadImage(payload.file);
    } catch (error) {}
  }
}
