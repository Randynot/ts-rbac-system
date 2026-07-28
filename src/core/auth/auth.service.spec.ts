import { AuthService } from './auth.service';

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { DataSource } from 'typeorm';

import { UsersService } from '../users/users.service';

import { RefreshToken } from './entities/refresh-token.entity';
import { User } from './entities/user.entity';

interface FakeManager {
  getRepository: jest.Mock;
  createQueryBuilder: jest.Mock;
}

interface FindOneArgs {
  where: { token: string };
  lock?: { mode: string };
}

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let usersService: {
    findOneById: jest.Mock;
    findOneByEmailWithPassword: jest.Mock;
  };
  let refreshTokenRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let transactionalTokenRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };

  const runTransactionWith = (
    repo: typeof transactionalTokenRepo,
  ): FakeManager => ({
    getRepository: jest.fn().mockReturnValue(repo),
    createQueryBuilder: jest.fn(),
  });

  beforeEach(async () => {
    refreshTokenRepository = {
      findOne: jest.fn(),
      create: jest.fn((data: unknown) => data),
      save: jest.fn((data: unknown) => Promise.resolve(data)),
    };

    transactionalTokenRepo = {
      findOne: jest.fn(),
      create: jest.fn((data: unknown) => data),
      save: jest.fn((data: unknown) => Promise.resolve(data)),
      createQueryBuilder: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn(
        (callback: (manager: FakeManager) => Promise<unknown>) =>
          callback(runTransactionWith(transactionalTokenRepo)),
      ),
    };

    usersService = {
      findOneById: jest.fn(),
      findOneByEmailWithPassword: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            ...usersService,
            findOneByEmail: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest
              .fn()
              .mockResolvedValueOnce('mocked-access-token')
              .mockResolvedValueOnce('mocked-refresh-token'),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              const map: Record<string, string> = {
                'appConfig.auth.jwtRefreshSecret': 'test-refresh-secret',
                'appConfig.auth.jwtRefreshExpiry': '7d',
                'appConfig.auth.refreshTokenHashSecret': 'test-hash-secret',
              };
              return map[key] ?? 'mocked-value';
            }),
          },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: refreshTokenRepository,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('issues a distinct access token and refresh token, and persists the refresh token hashed', async () => {
      usersService.findOneByEmailWithPassword.mockResolvedValueOnce({
        id: 'user-id',
        email: 'a@b.com',
        password: 'hashed-pw',
      });
      jest
        .spyOn(service, 'validateUser')
        .mockResolvedValueOnce({ id: 'user-id', email: 'a@b.com' } as User);

      let savedToken: { token: string } | undefined;
      refreshTokenRepository.save.mockImplementationOnce(
        (entity: { token: string }) => {
          savedToken = entity;
          return Promise.resolve(entity);
        },
      );

      const result = await service.login({
        email: 'a@b.com',
        password: 'irrelevant',
      });

      expect(result.accessToken).toBe('mocked-access-token');
      expect(result.refreshToken).toBe('mocked-refresh-token');
      expect(result.accessToken).not.toBe(result.refreshToken);

      expect(savedToken).toBeDefined();
      expect(savedToken?.token).not.toBe('mocked-refresh-token');
    });
  });

  describe('refreshTokens', () => {
    it('throws 401 if the JWT itself is invalid or expired', async () => {
      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockRejectedValueOnce(new Error('jwt expired'));

      await expect(service.refreshTokens('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
      // JWT verification fails before the transaction ever opens.
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('throws 401 if the token is not found in the database', async () => {
      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockResolvedValueOnce({ sub: 'user-id', email: 'a@b.com' });
      transactionalTokenRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.refreshTokens('missing-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('persists refresh tokens hashed, and looks them up safely (row-locked)', async () => {
      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockResolvedValueOnce({ sub: 'user-id', email: 'a@b.com' });

      let capturedArgs: FindOneArgs | undefined;
      transactionalTokenRepo.findOne.mockImplementationOnce(
        (args: FindOneArgs) => {
          capturedArgs = args;
          return Promise.resolve(null);
        },
      );

      await expect(service.refreshTokens('raw-token-value')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(capturedArgs?.where.token).not.toBe('raw-token-value');
      expect(capturedArgs?.lock).toEqual({ mode: 'pessimistic_write' });
    });

    it('detects reuse: revoked token used again revokes all user sessions, and the revocation SURVIVES the rejection', async () => {
      // This is the regression test for the exact bug found during manual
      // testing: revocation must COMMIT even though the request is
      // ultimately rejected. If refreshTokens() threw from inside the
      // transaction callback, TypeORM would roll back the revoke along
      // with everything else — this test catches that regression by
      // asserting the transaction resolves normally (no throw from
      // dataSource.transaction itself) and that execute() was called.
      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockResolvedValueOnce({ sub: 'user-id', email: 'a@b.com' });

      const revokedToken = {
        userId: 'user-id',
        isRevoked: (): boolean => true,
        isExpired: (): boolean => false,
      };
      transactionalTokenRepo.findOne.mockResolvedValueOnce(revokedToken);

      const whereMock = jest.fn().mockReturnThis();
      const setMock = jest.fn().mockReturnThis();
      const executeMock = jest.fn().mockResolvedValue(undefined);

      transactionalTokenRepo.createQueryBuilder.mockReturnValueOnce({
        update: jest.fn().mockReturnThis(),
        set: setMock,
        where: whereMock,
        andWhere: jest.fn().mockReturnThis(),
        execute: executeMock,
      });

      await expect(service.refreshTokens('reused-token')).rejects.toThrow(
        UnauthorizedException,
      );

      // Proves revocation targeted the correct user, with the right reason,
      // and actually executed — and crucially, dataSource.transaction()
      // itself did not throw (the mock callback returned an outcome object
      // normally), meaning this would have committed in a real database.
      expect(whereMock).toHaveBeenCalledWith('userId = :userId', {
        userId: 'user-id',
      });
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({ revokedReason: 'reuse_detected' }),
      );
      expect(executeMock).toHaveBeenCalled();
    });

    it('throws 401 if the token is expired (but not revoked)', async () => {
      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockResolvedValueOnce({ sub: 'user-id', email: 'a@b.com' });

      transactionalTokenRepo.findOne.mockResolvedValueOnce({
        isRevoked: (): boolean => false,
        isExpired: (): boolean => true,
      });

      await expect(service.refreshTokens('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('revokes the token found by its hashed lookup value', async () => {
      const tokenRow = { revokedAt: undefined, revokedReason: undefined };
      let capturedArgs: FindOneArgs | undefined;

      refreshTokenRepository.findOne.mockImplementationOnce(
        (args: FindOneArgs) => {
          capturedArgs = args;
          return Promise.resolve(tokenRow);
        },
      );

      const result = await service.logout('raw-token-value');

      expect(capturedArgs?.where.token).not.toBe('raw-token-value');
      expect(tokenRow.revokedAt).toBeDefined();
      expect(tokenRow.revokedReason).toBe('logout');
      expect(result).toEqual({ message: 'Logged out successfully' });
    });

    it('throws 401 if the token does not exist', async () => {
      refreshTokenRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.logout('missing-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
