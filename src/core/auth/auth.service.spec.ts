import { AuthService } from './auth.service';

import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';

import * as bcrypt from 'bcrypt';
import { DataSource, Repository } from 'typeorm';

import { UsersService } from '../users/users.service';

import { RefreshToken } from './entities/refresh-token.entity';
import { AccountStatus, User, UserRole } from './entities/user.entity';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    findOneByEmailWithPassword: jest.Mock;
    findOneByEmail: jest.Mock;
    findOneById: jest.Mock;
    incrementFailedAttempts: jest.Mock;
    resetFailedAttempts: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    revokeAllRefreshTokens: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let configService: { getOrThrow: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let refreshTokenRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };
  const compare = bcrypt.compare as jest.Mock;
  const hash = bcrypt.hash as jest.Mock;

  const user = (overrides: Partial<User> = {}): User =>
    ({
      id: '1aa6c952-c649-4d02-8f5b-d705caea7f75',
      email: 'user@example.com',
      name: 'user',
      password: 'hashed-password',
      role: UserRole.USER,
      status: AccountStatus.ACTIVE,
      isVerified: true,
      verificationToken: null,
      resetToken: null,
      loginAttempts: 0,
      lockedUntil: null,
      ...overrides,
    }) as User;

  beforeEach(() => {
    usersService = {
      findOneByEmailWithPassword: jest.fn(),
      findOneByEmail: jest.fn(),
      findOneById: jest.fn(),
      incrementFailedAttempts: jest.fn().mockResolvedValue(undefined),
      resetFailedAttempts: jest.fn().mockResolvedValue(undefined),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      revokeAllRefreshTokens: jest.fn().mockResolvedValue(undefined),
    };
    jwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };
    configService = {
      getOrThrow: jest.fn((key: string): string => {
        const values: Record<string, string> = {
          'appConfig.auth.jwtRefreshSecret': 'refresh-secret',
          'appConfig.auth.jwtRefreshExpiry': '7d',
          'appConfig.auth.refreshTokenHashSecret': 'hash-secret',
          'appConfig.auth.jwtVerificationSecret': 'verification-secret',
          'appConfig.auth.jwtResetSecret': 'reset-secret',
        };
        return values[key] ?? 'test-secret';
      }),
    };
    eventEmitter = { emit: jest.fn() };
    refreshTokenRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((value: object): object => value),
      createQueryBuilder: jest.fn(),
    };
    dataSource = { transaction: jest.fn() };
    compare.mockReset();
    hash.mockReset();

    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      refreshTokenRepository as unknown as Repository<RefreshToken>,
      dataSource as unknown as DataSource,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  describe('validateUser', () => {
    it('records a wrong password', async () => {
      const account = user({ loginAttempts: 4 });
      usersService.findOneByEmailWithPassword.mockResolvedValue(account);
      compare.mockResolvedValue(false);

      await expect(
        service.validateUser(account.email, 'wrong-password'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(usersService.incrementFailedAttempts).toHaveBeenCalledWith(
        account.id,
      );
      expect(usersService.resetFailedAttempts).not.toHaveBeenCalled();
    });

    it('rejects a correct password while the account is locked', async () => {
      const account = user({
        loginAttempts: 5,
        lockedUntil: new Date(Date.now() + 60_000),
      });
      usersService.findOneByEmailWithPassword.mockResolvedValue(account);

      await expect(
        service.validateUser(account.email, 'correct-password'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(compare).toHaveBeenCalledTimes(1);
      expect(usersService.resetFailedAttempts).not.toHaveBeenCalled();
    });

    it('resets consecutive failures after a successful login', async () => {
      const account = user({ loginAttempts: 3 });
      usersService.findOneByEmailWithPassword.mockResolvedValue(account);
      compare.mockResolvedValue(true);

      await expect(
        service.validateUser(account.email, 'correct-password'),
      ).resolves.toBe(account);
      expect(usersService.resetFailedAttempts).toHaveBeenCalledWith(account.id);
    });

    it('clears an expired lock before counting a new failure', async () => {
      const account = user({
        loginAttempts: 5,
        lockedUntil: new Date(Date.now() - 1),
      });
      usersService.findOneByEmailWithPassword.mockResolvedValue(account);
      compare.mockResolvedValue(false);

      await expect(
        service.validateUser(account.email, 'wrong-password'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(usersService.resetFailedAttempts).toHaveBeenCalledWith(account.id);
      expect(usersService.incrementFailedAttempts).toHaveBeenCalledWith(
        account.id,
      );
    });

    it('performs a dummy comparison for an unknown email', async () => {
      usersService.findOneByEmailWithPassword.mockResolvedValue(null);
      compare.mockResolvedValue(false);

      await expect(
        service.validateUser('missing@example.com', 'wrong-password'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(compare).toHaveBeenCalledTimes(1);
      expect(usersService.incrementFailedAttempts).not.toHaveBeenCalled();
    });

    it('rejects an unverified account after a valid password', async () => {
      const account = user({ isVerified: false });
      usersService.findOneByEmailWithPassword.mockResolvedValue(account);
      compare.mockResolvedValue(true);

      await expect(
        service.validateUser(account.email, 'correct-password'),
      ).rejects.toEqual(
        new ForbiddenException('Please verify your email to continue'),
      );
    });
  });

  describe('register', () => {
    const dto = { email: 'new@example.com', password: 'password123' };

    it('rejects a duplicate email before hashing', async () => {
      usersService.findOneByEmail.mockResolvedValue(user());

      await expect(service.register(dto)).rejects.toEqual(
        new BadRequestException('Email is already registered'),
      );
      expect(hash).not.toHaveBeenCalled();
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('creates the user and emits a verification event', async () => {
      const createdUser = user({ id: 'new-user-id', email: dto.email });
      usersService.findOneByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(createdUser);
      hash.mockResolvedValue('hashed-password');
      jwtService.signAsync.mockResolvedValue('verification-token');

      await expect(service.register(dto)).resolves.toEqual({
        id: createdUser.id,
        email: dto.email,
      });
      expect(usersService.create).toHaveBeenCalledWith({
        email: dto.email,
        name: 'new',
        password: 'hashed-password',
      });
      expect(usersService.update).toHaveBeenCalledWith(createdUser.id, {
        verificationToken: 'verification-token',
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('user.registered', {
        email: dto.email,
        token: 'verification-token',
      });
    });
  });

  it('signs and stores a login token pair with the expected claims', async () => {
    const account = user();
    usersService.findOneByEmailWithPassword.mockResolvedValue(account);
    compare.mockResolvedValue(true);
    jwtService.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');

    await expect(
      service.login({ email: account.email, password: 'password123' }),
    ).resolves.toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(jwtService.signAsync).toHaveBeenNthCalledWith(1, {
      sub: account.id,
      email: account.email,
      role: account.role,
    });
    expect(refreshTokenRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: account.id,
        expiresAt: expect.any(Date) as Date,
        tokenFamily: expect.any(String) as string,
        token: expect.any(String) as string,
      }),
    );
    expect(refreshTokenRepository.save).toHaveBeenCalledTimes(1);
  });

  describe('verifyEmail', () => {
    const token = 'verification-token';
    const payload = {
      sub: '1aa6c952-c649-4d02-8f5b-d705caea7f75',
      email: 'user@example.com',
      purpose: 'email-verification',
    };

    it('rejects an invalid or expired JWT', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('expired'));

      await expect(service.verifyEmail(token)).rejects.toEqual(
        new BadRequestException('Invalid or expired verification token'),
      );
    });

    it('rejects a token with the wrong purpose', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        ...payload,
        purpose: 'access',
      });

      await expect(service.verifyEmail(token)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(usersService.findOneById).not.toHaveBeenCalled();
    });

    it('rejects a token that is no longer stored for the user', async () => {
      jwtService.verifyAsync.mockResolvedValue(payload);
      usersService.findOneById.mockResolvedValue(
        user({ verificationToken: 'newer-token' }),
      );

      await expect(service.verifyEmail(token)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(usersService.update).not.toHaveBeenCalled();
    });

    it('rejects a valid token when its user no longer exists', async () => {
      jwtService.verifyAsync.mockResolvedValue(payload);
      usersService.findOneById.mockResolvedValue(null);

      await expect(service.verifyEmail(token)).rejects.toEqual(
        new BadRequestException('Invalid or expired verification token'),
      );
      expect(usersService.update).not.toHaveBeenCalled();
    });

    it('activates the account and consumes a valid token', async () => {
      const account = user({
        status: AccountStatus.PENDING_VERIFICATION,
        isVerified: false,
        verificationToken: token,
      });
      jwtService.verifyAsync.mockResolvedValue(payload);
      usersService.findOneById.mockResolvedValue(account);

      await expect(service.verifyEmail(token)).resolves.toEqual({
        verified: true,
      });
      expect(usersService.update).toHaveBeenCalledWith(
        account.id,
        expect.objectContaining({
          status: AccountStatus.ACTIVE,
          isVerified: true,
          verificationToken: null,
          emailVerifiedAt: expect.any(Date) as Date,
        }),
      );
    });
  });

  describe('queueForgotPasswordProcess', () => {
    it('emits the reset-password-process event with the given email', () => {
      service.queueForgotPasswordProcess('user@example.com');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'user.reset-password-process',
        'user@example.com',
      );
    });
  });

  describe('forgotPassword', () => {
    it('does nothing when no user matches the email', async () => {
      usersService.findOneByEmail.mockResolvedValue(null);

      await expect(
        service.forgotPassword('missing@example.com'),
      ).resolves.toBeUndefined();
      expect(jwtService.signAsync).not.toHaveBeenCalled();
      expect(usersService.update).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('generates and stores a hashed reset token, emitting the raw token', async () => {
      const account = user();
      usersService.findOneByEmail.mockResolvedValue(account);
      jwtService.signAsync.mockResolvedValue('reset-token');
      hash.mockResolvedValue('hashed-reset-token');

      await service.forgotPassword(account.email);

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: account.id, purpose: 'password-reset' },
        expect.objectContaining({ expiresIn: '15m' }),
      );
      expect(usersService.update).toHaveBeenNthCalledWith(1, account.id, {
        resetToken: null,
      });
      expect(usersService.update).toHaveBeenNthCalledWith(2, account.id, {
        resetToken: 'hashed-reset-token',
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('user.forgot-password', {
        email: account.email,
        token: 'reset-token',
      });
    });
  });

  describe('resetPassword', () => {
    const token = 'reset-token';
    const payload = {
      sub: '1aa6c952-c649-4d02-8f5b-d705caea7f75',
      purpose: 'password-reset',
    };

    it('rejects an invalid or expired JWT', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('expired'));

      await expect(
        service.resetPassword(token, 'newPassword123'),
      ).rejects.toEqual(
        new BadRequestException('Invalid or expired reset token/ bad token'),
      );
      expect(usersService.findOneById).not.toHaveBeenCalled();
    });

    it('rejects a token with the wrong purpose', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        ...payload,
        purpose: 'access',
      });

      await expect(
        service.resetPassword(token, 'newPassword123'),
      ).rejects.toEqual(
        new BadRequestException('Invalid or expired reset token/ purpose'),
      );
      expect(usersService.findOneById).not.toHaveBeenCalled();
    });

    it('rejects when the user no longer exists', async () => {
      jwtService.verifyAsync.mockResolvedValue(payload);
      usersService.findOneById.mockResolvedValue(null);

      await expect(
        service.resetPassword(token, 'newPassword123'),
      ).rejects.toEqual(
        new BadRequestException(
          'Invalid or expired reset token/ no user or reset token',
        ),
      );
    });

    it('rejects when the user has no stored reset token', async () => {
      jwtService.verifyAsync.mockResolvedValue(payload);
      usersService.findOneById.mockResolvedValue(user({ resetToken: null }));

      await expect(
        service.resetPassword(token, 'newPassword123'),
      ).rejects.toEqual(
        new BadRequestException(
          'Invalid or expired reset token/ no user or reset token',
        ),
      );
      expect(compare).not.toHaveBeenCalled();
    });

    it('rejects when the token does not match the stored hash', async () => {
      jwtService.verifyAsync.mockResolvedValue(payload);
      usersService.findOneById.mockResolvedValue(
        user({ resetToken: 'stored-hash' }),
      );
      compare.mockResolvedValue(false);

      await expect(
        service.resetPassword(token, 'newPassword123'),
      ).rejects.toEqual(
        new BadRequestException(
          'Invalid or expired reset token/ token mismatch',
        ),
      );
      expect(usersService.update).not.toHaveBeenCalled();
    });

    it('updates the password, clears the reset token, and revokes sessions on success', async () => {
      const account = user({ resetToken: 'stored-hash' });
      jwtService.verifyAsync.mockResolvedValue(payload);
      usersService.findOneById.mockResolvedValue(account);
      compare.mockResolvedValue(true);
      hash.mockResolvedValue('new-hashed-password');

      await expect(
        service.resetPassword(token, 'newPassword123'),
      ).resolves.toEqual({
        message: 'Password has been reset successfully.',
      });
      expect(usersService.update).toHaveBeenCalledWith(account.id, {
        password: 'new-hashed-password',
        resetToken: null,
        loginAttempts: 0,
      });
      expect(usersService.revokeAllRefreshTokens).toHaveBeenCalledWith(
        account.id,
        'Password reset',
      );
    });
  });
});
