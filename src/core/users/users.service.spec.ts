import { UsersService } from './users.service';

import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { User } from '../auth/entities/user.entity';

describe('UsersService login lockout', () => {
  type LockoutUpdate = {
    loginAttempts: () => string;
    lockedUntil: () => string;
  };

  let service: UsersService;
  let repository: {
    createQueryBuilder: jest.Mock;
    findOneBy: jest.Mock;
    update: jest.Mock;
  };
  let queryBuilder: {
    update: jest.Mock;
    set: jest.Mock;
    where: jest.Mock;
    execute: jest.Mock;
  };

  beforeEach(async () => {
    queryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      findOneBy: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: repository,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((_key: string, fallback: number) => fallback),
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  it('increments and applies the threshold in one atomic update', async () => {
    await service.incrementFailedAttempts(
      '1aa6c952-c649-4d02-8f5b-d705caea7f75',
    );

    expect(queryBuilder.set).toHaveBeenCalledTimes(1);
    const setCalls = queryBuilder.set.mock.calls as unknown[][];
    const update = setCalls[0][0] as LockoutUpdate;
    expect(update.loginAttempts()).toBe('"loginAttempts" + 1');
    expect(update.lockedUntil()).toContain('"loginAttempts" + 1 >= 5');
    expect(update.lockedUntil()).toContain("INTERVAL '900 seconds'");
    expect(queryBuilder.where).toHaveBeenCalledWith('id = :userId', {
      userId: '1aa6c952-c649-4d02-8f5b-d705caea7f75',
    });
    expect(queryBuilder.execute).toHaveBeenCalled();
  });

  it('resets attempts and the lock together', async () => {
    await service.resetFailedAttempts('1aa6c952-c649-4d02-8f5b-d705caea7f75');

    expect(repository.update).toHaveBeenCalledWith(
      '1aa6c952-c649-4d02-8f5b-d705caea7f75',
      { loginAttempts: 0, lockedUntil: null },
    );
  });

  it('normalizes email addresses before lookup', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await service.findOneByEmail('  User@Example.COM ');

    expect(repository.findOneBy).toHaveBeenCalledWith({
      email: 'user@example.com',
    });
  });

  it.each([
    ['future', 1, true],
    ['exact boundary', 0, false],
    ['past', -1, false],
  ])('reports a %s lock correctly', async (_label, offset, expected) => {
    const now = new Date('2026-07-30T12:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);
    repository.findOneBy.mockResolvedValue({
      lockedUntil: new Date(now.getTime() + offset),
    });

    await expect(
      service.isAccountLocked('1aa6c952-c649-4d02-8f5b-d705caea7f75'),
    ).resolves.toBe(expected);

    jest.useRealTimers();
  });
});
