import { RolesGuard } from './roles.guard';

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { UserRole } from '../../../core/auth/entities/user.entity';

import { Reflector } from '@nestjs/core';

describe('RolesGuard', () => {
  const createContext = (user?: { role: UserRole }): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  it('allows routes without role metadata', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;

    expect(new RolesGuard(reflector).canActivate(createContext())).toBe(true);
  });

  it('rejects an unauthenticated request to a protected route', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADMIN]),
    } as unknown as Reflector;

    expect(() =>
      new RolesGuard(reflector).canActivate(createContext()),
    ).toThrow(new ForbiddenException('User not authenticated.'));
  });

  it('rejects a user without a required role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADMIN]),
    } as unknown as Reflector;

    expect(() =>
      new RolesGuard(reflector).canActivate(
        createContext({ role: UserRole.USER }),
      ),
    ).toThrow(
      new ForbiddenException(
        'You do not have permission to access this resource.',
      ),
    );
  });

  it('allows a user with a required role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADMIN]),
    } as unknown as Reflector;

    expect(
      new RolesGuard(reflector).canActivate(
        createContext({ role: UserRole.ADMIN }),
      ),
    ).toBe(true);
  });
});
