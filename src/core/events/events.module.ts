import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { UsersModule } from '../users/users.module';

import { ProfileUploadListener } from './listeners/image-upload.listeners';

@Module({
  imports: [CloudinaryModule, EventEmitterModule.forRoot(), UsersModule],
  providers: [ProfileUploadListener],
})
export class EventsModule {}
