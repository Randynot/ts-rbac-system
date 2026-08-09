import { FactoryProvider } from '@nestjs/common';

import { v2 as cloudinary } from 'cloudinary';

export const CloudinaryConfig: FactoryProvider<typeof cloudinary> = {
  provide: 'CLOUDINARY',
  useFactory: (): typeof cloudinary => {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    return cloudinary;
  },
};
