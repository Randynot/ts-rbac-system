import { ProfileUploadListener } from './image-upload.listeners';

import { Logger } from '@nestjs/common';

import { UsersService } from '../../users/users.service';

describe('ProfileUploadListener', () => {
  const file = { buffer: Buffer.from('image') } as Express.Multer.File;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stores the secure URL returned by Cloudinary', async () => {
    const uploadImage = jest.fn().mockResolvedValue({
      secure_url: 'https://image.test/profile.jpg',
    });
    const updateProfilePicture = jest.fn().mockResolvedValue({ affected: 1 });
    const listener = new ProfileUploadListener({ uploadImage }, {
      updateProfilePicture,
    } as unknown as UsersService);

    await listener.handleProfileUploadEvent({ userId: 'user-id', file });

    expect(uploadImage).toHaveBeenCalledWith(file);
    expect(updateProfilePicture).toHaveBeenCalledWith(
      'user-id',
      'https://image.test/profile.jpg',
    );
  });

  it('logs upload failures without attempting a database update', async () => {
    const error = new Error('Upload failed');
    const uploadImage = jest.fn().mockRejectedValue(error);
    const updateProfilePicture = jest.fn();
    const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const listener = new ProfileUploadListener({ uploadImage }, {
      updateProfilePicture,
    } as unknown as UsersService);

    await expect(
      listener.handleProfileUploadEvent({ userId: 'user-id', file }),
    ).resolves.toBeUndefined();
    expect(updateProfilePicture).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith(
      'Profile picture upload failed',
      error,
    );
  });
});
