import { UsersController } from './users.controller';
import { UsersService } from './users.service';

import type { Request } from 'express';

describe('UsersController', () => {
  it('uploads a profile picture for the authenticated user', () => {
    const uploadProfilePicture = jest.fn().mockReturnValue({
      message: 'Profile picture upload started',
    });
    const controller = new UsersController({
      uploadProfilePicture,
    } as unknown as UsersService);
    const file = { buffer: Buffer.from('image') } as Express.Multer.File;
    const request = { user: { id: 'user-id' } } as Request & {
      user: { id: string };
    };

    expect(controller.uploadProfilePicture(file, request)).toEqual({
      message: 'Profile picture upload started',
    });
    expect(uploadProfilePicture).toHaveBeenCalledWith('user-id', file);
  });
});
