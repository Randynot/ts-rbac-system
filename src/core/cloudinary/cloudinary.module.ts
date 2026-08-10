import { CloudinaryService } from './cloudinary.service';

import { Module } from '@nestjs/common';

import { CloudinaryConfig } from '../../shared/config/cloudinary.config';

@Module({
  providers: [CloudinaryConfig, CloudinaryService],
  exports: [CloudinaryConfig, CloudinaryService],
})
export class CloudinaryModule {}
