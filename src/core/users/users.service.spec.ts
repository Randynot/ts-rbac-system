import { UsersService } from './users.service';

import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import type { UUID } from 'node:crypto';
import { Repository } from 'typeorm';

import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { User } from '../auth/entities/user.entity';

describe('UsersService', () => {
  type LockoutUpdate = {
    loginAttempts: () => string;
    lockedUntil: () => string;
  };

  let service: UsersService;
  let repository: {
    createQueryBuilder: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    findOneBy: jest.Mock;
    find: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let refreshTokenRepository: {
    createQueryBuilder: jest.Mock;
  };
  let queryBuilder: {
    update: jest.Mock;
    set: jest.Mock;
    where: jest.Mock;
    execute: jest.Mock;
    addSelect: jest.Mock;
    getOne: jest.Mock;
  };
  let config: { get: jest.Mock };
  let events: { emit: jest.Mock };
  let lockoutUpdate: LockoutUpdate | undefined;

  const getLockoutUpdate = (): LockoutUpdate => {
    if (!lockoutUpdate) {
      throw new Error('Expected the query builder set payload');
    }
    return lockoutUpdate;
  };

  beforeEach(() => {
    queryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
      addSelect: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };
    lockoutUpdate = undefined;
    queryBuilder.set.mockImplementation(
      (value: LockoutUpdate): typeof queryBuilder => {
        lockoutUpdate = value;
        return queryBuilder;
      },
    );
    repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      create: jest.fn(),
      save: jest.fn(),
      findOneBy: jest.fn(),
      find: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    refreshTokenRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    config = {
      get: jest.fn((_key: string, fallback: number): number => fallback),
    };
    events = { emit: jest.fn() };
    service = new UsersService(
      repository as unknown as Repository<User>,
      refreshTokenRepository as unknown as Repository<RefreshToken>,
      config as unknown as ConfigService,
      events as unknown as EventEmitter2,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('increments failures and applies the lock threshold atomically', async () => {
    const userId = '1aa6c952-c649-4d02-8f5b-d705caea7f75';

    await service.incrementFailedAttempts(userId);

    expect(queryBuilder.set).toHaveBeenCalledTimes(1);
    const update = getLockoutUpdate();
    expect(update.loginAttempts()).toBe('"loginAttempts" + 1');
    expect(update.lockedUntil()).toContain('"loginAttempts" + 1 >= 5');
    expect(update.lockedUntil()).toContain("INTERVAL '900 seconds'");
    expect(queryBuilder.where).toHaveBeenCalledWith('id = :userId', {
      userId,
    });
    expect(queryBuilder.execute).toHaveBeenCalledTimes(1);
  });

  it('uses valid configured lockout values', async () => {
    config.get.mockReturnValueOnce(3).mockReturnValueOnce(120);

    await service.incrementFailedAttempts('user-id');

    const update = getLockoutUpdate();
    expect(update.lockedUntil()).toContain('>= 3');
    expect(update.lockedUntil()).toContain("INTERVAL '120 seconds'");
  });

  it('falls back when lockout configuration is invalid', async () => {
    config.get.mockReturnValueOnce(0).mockReturnValueOnce(Number.NaN);

    await service.incrementFailedAttempts('user-id');

    const update = getLockoutUpdate();
    expect(update.lockedUntil()).toContain('>= 5');
    expect(update.lockedUntil()).toContain("INTERVAL '900 seconds'");
  });

  it('resets attempts and the lock together', async () => {
    await service.resetFailedAttempts('user-id');

    expect(repository.update).toHaveBeenCalledWith('user-id', {
      loginAttempts: 0,
      lockedUntil: null,
    });
  });

  it('normalizes email addresses for standard and password lookups', async () => {
    repository.findOneBy.mockResolvedValue(null);
    queryBuilder.getOne.mockResolvedValue(null);

    await service.findOneByEmail('  User@Example.COM ');
    await service.findOneByEmailWithPassword('  User@Example.COM ');

    expect(repository.findOneBy).toHaveBeenCalledWith({
      email: 'user@example.com',
    });
    expect(queryBuilder.addSelect).toHaveBeenCalledWith('user.password');
    expect(queryBuilder.where).toHaveBeenCalledWith('user.email = :email', {
      email: 'user@example.com',
    });
  });

  it.each([
    ['missing', null, false],
    ['future', 1, true],
    ['exact boundary', 0, false],
    ['past', -1, false],
  ])(
    'reports a %s lock correctly',
    async (_label, offset: number | null, expected) => {
      const now = new Date('2026-07-30T12:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);
      repository.findOneBy.mockResolvedValue({
        lockedUntil: offset === null ? null : new Date(now.getTime() + offset),
      });

      await expect(service.isAccountLocked('user-id')).resolves.toBe(expected);
    },
  );

  it('creates and saves a repository entity', async () => {
    const entity = { id: 'user-id', email: 'user@example.com' } as User;
    repository.create.mockReturnValue(entity);
    repository.save.mockResolvedValue(entity);

    await expect(service.create({ email: entity.email })).resolves.toBe(entity);
    expect(repository.save).toHaveBeenCalledWith(entity);
  });

  it('delegates basic repository operations', async () => {
    const id = '1aa6c952-c649-4d02-8f5b-d705caea7f75' as UUID;
    repository.findOneBy.mockResolvedValue(null);
    repository.find.mockResolvedValue([]);

    await service.findOneById(id);
    await service.findAll();
    await service.update(id, { name: 'Updated' });
    await service.remove(id);

    expect(repository.findOneBy).toHaveBeenCalledWith({ id });
    expect(repository.find).toHaveBeenCalledTimes(1);
    expect(repository.update).toHaveBeenCalledWith(id, { name: 'Updated' });
    expect(repository.delete).toHaveBeenCalledWith(id);
  });

  it('emits profile uploads and returns an immediate acknowledgement', () => {
    const file = { buffer: Buffer.from('image') } as Express.Multer.File;

    expect(service.uploadProfilePicture('user-id', file)).toEqual({
      message: 'Profile picture upload started',
    });
    expect(events.emit).toHaveBeenCalledWith('user.profile_picture.upload', {
      userId: 'user-id',
      file,
    });
  });

  it('updates the stored profile picture URL', async () => {
    await service.updateProfilePicture('user-id', 'https://image.test/a.jpg');

    expect(repository.update).toHaveBeenCalledWith('user-id', {
      profilePicture: 'https://image.test/a.jpg',
    });
  });
});
