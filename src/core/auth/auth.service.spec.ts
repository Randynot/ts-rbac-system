import { AuthService } from './auth.service';

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';

import { User } from './entities/user.entity';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService login lockout', () => {
  let service: AuthService;
  let usersService: {
    findOneByEmailWithPassword: jest.Mock;
    incrementFailedAttempts: jest.Mock;
    resetFailedAttempts: jest.Mock;
  };
  const compare = bcrypt.compare as jest.Mock;

  const user = (overrides: Partial<User> = {}): User =>
    ({
      id: '1aa6c952-c649-4d02-8f5b-d705caea7f75',
      email: 'user@example.com',
      password: 'hashed-password',
      loginAttempts: 0,
      lockedUntil: null,
      isVerified: true,
      ...overrides,
    }) as User;

  beforeEach(async () => {
    usersService = {
      findOneByEmailWithPassword: jest.fn(),
      incrementFailedAttempts: jest.fn().mockResolvedValue(undefined),
      resetFailedAttempts: jest.fn().mockResolvedValue(undefined),
    };
    compare.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: { signAsync: jest.fn() } },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn(), get: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get(AuthService);
  });

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
  });
});
