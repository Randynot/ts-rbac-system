import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    login: jest.Mock;
    register: jest.Mock;
    verifyEmail: jest.Mock;
  };

  beforeEach(() => {
    authService = {
      login: jest.fn(),
      register: jest.fn(),
      verifyEmail: jest.fn(),
    };
    controller = new AuthController(authService as unknown as AuthService);
  });

  it('returns the access token produced by the auth service', async () => {
    const dto = { email: 'user@example.com', password: 'password123' };
    authService.login.mockResolvedValue({ accessToken: 'access-token' });

    await expect(controller.login(dto)).resolves.toEqual({
      accessToken: 'access-token',
    });
    expect(authService.login).toHaveBeenCalledWith(dto);
  });

  it('registers a user without exposing service metadata', async () => {
    const dto = { email: 'user@example.com', password: 'password123' };
    authService.register.mockResolvedValue({ id: 'user-id', email: dto.email });

    await expect(controller.register(dto)).resolves.toEqual({
      message: 'Sign Up successful, verify Email.',
    });
    expect(authService.register).toHaveBeenCalledWith(dto);
  });

  it('delegates email verification using the query token', async () => {
    authService.verifyEmail.mockResolvedValue({ verified: true });

    await expect(controller.verifyEmail('verification-token')).resolves.toEqual(
      { verified: true },
    );
    expect(authService.verifyEmail).toHaveBeenCalledWith('verification-token');
  });

  it('returns the admin route response', () => {
    expect(controller.adminTest()).toEqual({
      message: 'You have admin access',
    });
  });
});
