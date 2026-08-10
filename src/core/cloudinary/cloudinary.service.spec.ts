import { CloudinaryService } from './cloudinary.service';

import { v2 as cloudinary } from 'cloudinary';
import { PassThrough } from 'node:stream';

jest.mock('cloudinary', () => ({
  v2: {
    uploader: {
      upload_stream: jest.fn(),
    },
  },
}));

const mockUploadStream = cloudinary.uploader.upload_stream as jest.Mock;

describe('CloudinaryService', () => {
  const file = { buffer: Buffer.from('image-data') } as Express.Multer.File;

  beforeEach(() => {
    mockUploadStream.mockReset();
  });

  it('resolves with the Cloudinary upload response', async () => {
    const response = {
      public_id: 'profile-id',
      secure_url: 'https://image.test/profile.jpg',
    };
    mockUploadStream.mockImplementation(
      (
        callback: (error: null, result: typeof response) => void,
      ): PassThrough => {
        queueMicrotask(() => callback(null, response));
        return new PassThrough();
      },
    );

    await expect(new CloudinaryService().uploadImage(file)).resolves.toEqual(
      response,
    );
  });

  it('preserves Error instances returned by Cloudinary', async () => {
    const error = new Error('Upload rejected');
    mockUploadStream.mockImplementation(
      (callback: (error: Error) => void): PassThrough => {
        queueMicrotask(() => callback(error));
        return new PassThrough();
      },
    );

    await expect(new CloudinaryService().uploadImage(file)).rejects.toBe(error);
  });

  it('normalizes non-Error rejection values', async () => {
    const providerError = { message: 'Upload rejected' };
    mockUploadStream.mockImplementation(
      (callback: (error: typeof providerError) => void): PassThrough => {
        queueMicrotask(() => callback(providerError));
        return new PassThrough();
      },
    );

    await expect(new CloudinaryService().uploadImage(file)).rejects.toEqual(
      expect.objectContaining({
        message: 'Cloudinary upload failed',
        cause: providerError,
      }),
    );
  });
});
