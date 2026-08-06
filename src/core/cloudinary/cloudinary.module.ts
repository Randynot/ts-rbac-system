import { Module } from '@nestjs/common';

import { CloudinaryConfig } from '../../shared/config/cloudinary.config';

@Module({
  providers: [CloudinaryConfig],
  exports: [CloudinaryConfig],
})
export class cloudinary {}
