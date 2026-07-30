import { AuthService } from './auth.service';

import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { hash } from 'bcrypt';

import { UsersService } from '../users/users.service';

import { User, UserRole } from './entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<
    Pick<
      UsersService,
      | 'findOneByEmailWithPassword'
      | 'isAccountLocked'
      | 'incrementFailedAttempts'
      | 'resetFailedAttempts'
    >
  >;

  let user: User;

  beforeEach(async () => {
    user = {
      id: '1aa6c952-c649-4d02-8f5b-d705caea7f75',
      email: 'user@example.com',
      password: await hash('correct-password', 4),
      role: UserRole.USER,
    } as User;

    usersService = {
      findOneByEmailWithPassword: jest.fn(),
      isAccountLocked: jest.fn(),
      incrementFailedAttempts: jest.fn(),
      resetFailedAttempts: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('increments failed attempts when the password is wrong', async () => {
    usersService.findOneByEmailWithPassword.mockResolvedValue(user);
    usersService.isAccountLocked.mockResolvedValue(false);

    await expect(
      service.validateUser(user.email, 'wrong-password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(usersService.incrementFailedAttempts).toHaveBeenCalledWith(user.id);
    expect(usersService.resetFailedAttempts).not.toHaveBeenCalled();
  });

  it('rejects an active lockout before checking a correct password', async () => {
    usersService.findOneByEmailWithPassword.mockResolvedValue(user);
    usersService.isAccountLocked.mockResolvedValue(true);

    await expect(
      service.validateUser(user.email, 'correct-password'),
    ).rejects.toThrow('Account temporarily locked');

    expect(usersService.incrementFailedAttempts).not.toHaveBeenCalled();
    expect(usersService.resetFailedAttempts).not.toHaveBeenCalled();
  });

  it('resets consecutive failed attempts after a successful login', async () => {
    usersService.findOneByEmailWithPassword.mockResolvedValue(user);
    usersService.isAccountLocked.mockResolvedValue(false);

    await expect(
      service.validateUser(user.email, 'correct-password'),
    ).resolves.toBe(user);

    expect(usersService.resetFailedAttempts).toHaveBeenCalledWith(user.id);
    expect(usersService.incrementFailedAttempts).not.toHaveBeenCalled();
  });
});
