import { UsersService } from './users.service';

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { User } from '../auth/entities/user.entity';

describe('UsersService login lockout', () => {
  let service: UsersService;
  let repository: jest.Mocked<Pick<Repository<User>, 'findOneBy' | 'save'>>;

  beforeEach(async () => {
    repository = {
      findOneBy: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sets a 15-minute lockout on the fifth consecutive failure', async () => {
    const now = new Date('2026-07-30T12:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);

    const user = {
      id: '1aa6c952-c649-4d02-8f5b-d705caea7f75',
      loginAttempts: 4,
      lockedUntil: null,
    } as User;

    repository.findOneBy.mockResolvedValue(user);
    repository.save.mockImplementation((savedUser) =>
      Promise.resolve(savedUser as User),
    );

    await service.incrementFailedAttempts(user.id);

    expect(user.loginAttempts).toBe(5);
    expect(user.lockedUntil).toEqual(new Date(now.getTime() + 15 * 60 * 1000));
    expect(repository.save).toHaveBeenCalledWith(user);
  });

  it('reports an account as locked while its timestamp is in the future', async () => {
    const now = new Date('2026-07-30T12:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);

    repository.findOneBy.mockResolvedValue({
      id: '1aa6c952-c649-4d02-8f5b-d705caea7f75',
      lockedUntil: new Date(now.getTime() + 1),
    } as User);

    await expect(
      service.isAccountLocked('1aa6c952-c649-4d02-8f5b-d705caea7f75'),
    ).resolves.toBe(true);
  });

  it('reports an account as unlocked after its timestamp expires', async () => {
    const now = new Date('2026-07-30T12:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);

    repository.findOneBy.mockResolvedValue({
      id: '1aa6c952-c649-4d02-8f5b-d705caea7f75',
      lockedUntil: new Date(now.getTime() - 1),
    } as User);

    await expect(
      service.isAccountLocked('1aa6c952-c649-4d02-8f5b-d705caea7f75'),
    ).resolves.toBe(false);
  });
});
