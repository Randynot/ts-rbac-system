import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import { BadRequestException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    login: jest.Mock;
    register: jest.Mock;
    verifyEmail: jest.Mock;
    refreshTokens: jest.Mock;
    logout: jest.Mock;
    queueForgotPasswordProcess: jest.Mock;
    resetPassword: jest.Mock;
  };

  beforeEach(() => {
    authService = {
      login: jest.fn(),
      register: jest.fn(),
      verifyEmail: jest.fn(),
      refreshTokens: jest.fn(),
      logout: jest.fn(),
      queueForgotPasswordProcess: jest.fn(),
      resetPassword: jest.fn(),
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

  describe('refresh', () => {
    it('delegates to authService.refreshTokens with the given token', async () => {
      const dto = { refreshToken: 'some-refresh-token' };
      authService.refreshTokens.mockResolvedValueOnce({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });

      const result = await controller.refresh(dto);

      expect(authService.refreshTokens).toHaveBeenCalledWith(dto.refreshToken);
      expect(result).toEqual({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });
    });
  });

  describe('logout', () => {
    it('delegates to authService.logout with the given token', async () => {
      const dto = { refreshToken: 'some-refresh-token' };
      authService.logout.mockResolvedValueOnce({
        message: 'Logged out successfully',
      });

      const result = await controller.logout(dto);

      expect(authService.logout).toHaveBeenCalledWith(dto.refreshToken);
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });

  describe('forgotPassword', () => {
    it('queues the forgot-password process and returns a generic message', () => {
      const dto = { email: 'user@example.com' };

      const result = controller.forgotPassword(dto);

      expect(authService.queueForgotPasswordProcess).toHaveBeenCalledWith(
        dto.email,
      );
      expect(result).toEqual({
        message:
          'If an account with that email exists, a password reset link has been sent.',
      });
    });

    it('returns the same generic message even for an unregistered email', () => {
      const dto = { email: 'nonexistent@example.com' };

      const result = controller.forgotPassword(dto);

      expect(result).toEqual({
        message:
          'If an account with that email exists, a password reset link has been sent.',
      });
    });
  });

  describe('resetPassword', () => {
    it('delegates to authService.resetPassword with the query token and new password', async () => {
      const dto = { newPassword: 'newPassword123' };
      const token = 'reset-token';
      authService.resetPassword.mockResolvedValue({
        message: 'Password has been reset successfully.',
      });

      await expect(controller.resetPassword(dto, token)).resolves.toEqual({
        message: 'Your password has been reset successfully.',
      });
      expect(authService.resetPassword).toHaveBeenCalledWith(
        token,
        dto.newPassword,
      );
    });

    it('propagates errors thrown by authService.resetPassword', async () => {
      const dto = { newPassword: 'newPassword123' };
      authService.resetPassword.mockRejectedValue(
        new BadRequestException('Invalid or expired reset token/ bad token'),
      );

      await expect(
        controller.resetPassword(dto, 'invalid-token'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
