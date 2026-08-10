import { Injectable } from '@nestjs/common';

import toStream from 'buffer-to-stream';
import { UploadApiResponse, v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  async uploadImage(file: Express.Multer.File): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream((error, result) => {
        if (error) {
          const rejectionError: Error =
            error instanceof Error
              ? error
              : new Error('Cloudinary upload failed', { cause: error });
          reject(rejectionError);
          return;
        }

        resolve(result as UploadApiResponse);
      });

      toStream(file.buffer).pipe(upload);
    });
  }
}
