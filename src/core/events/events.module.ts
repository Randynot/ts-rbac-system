import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { CloudinaryModule } from '../cloudinary/cloudinary.module';

import { ProfileUploadListener } from './listeners/image-upload.listeners';

@Module({
  imports: [CloudinaryModule, EventEmitterModule.forRoot()],
  providers: [ProfileUploadListener],
})
export class EventsModule {}
