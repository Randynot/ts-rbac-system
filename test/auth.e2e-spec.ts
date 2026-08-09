import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import type { UUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import { AccountStatus, UserRole } from '../src/core/auth/entities/user.entity';
import { EmailService } from '../src/core/email/email.service';
// import { EmailProcessor } from '../src/core/queue/processors/email.processor';
import { UsersService } from '../src/core/users/users.service';

async function registerAndVerify(
  app: INestApplication<App>,
  usersService: UsersService,
  credentials: { email: string; password: string },
): Promise<void> {
  await request(app.getHttpServer())
    .post('/auth/register')
    .send(credentials)
    .expect(201);

  const user = await usersService.findOneByEmail(credentials.email);
  await usersService.update(user!.id as UUID, {
    isVerified: true,
    status: AccountStatus.ACTIVE,
    emailVerifiedAt: new Date(),
  });
}

describe('AuthController (E2E)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let usersService: UsersService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue({
        sendEmail: jest.fn().mockResolvedValue(null),
        sendVerificationEmail: jest.fn().mockResolvedValue(null),
      })
      .compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    );

    await app.init();

    dataSource = moduleFixture.get(DataSource);
    usersService = moduleFixture.get(UsersService);
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE refresh_tokens CASCADE;');
    await dataSource.query('TRUNCATE TABLE users CASCADE;');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    const registerDto = {
      email: 'testuser@example.com',
      password: 'strongPassword123',
    };

    it('should successfully register a new user and return user metadata', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      expect(response.body).toEqual({
        message: 'Sign Up successful, verify Email.',
      });
    });

    it('should fail with a 400 bad request if the email is already registered', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(400);

      const body = response.body as { message?: string };
      expect(body.message).toBe('Email is already registered');
    });

    it('should fail if email validation fails', async () => {
      const invalidDto = {
        email: 'not-an-email', // should match email format
        password: 'strongPassword123',
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(invalidDto)
        .expect(400);
    });

    it('should fail if password validation fails (too short)', async () => {
      const invalidDto = {
        email: 'testuser@example.com',
        password: '123', // minimum for a password should be 8 chars
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(invalidDto)
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    const userCredentials = {
      email: 'loginuser@example.com',
      password: 'password12345',
    };

    beforeEach(async () => {
      await registerAndVerify(app, usersService, userCredentials);
    });

    it('should login successfully and return an access token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userCredentials)
        .expect(201);

      const body = response.body as { accessToken?: string };
      expect(body.accessToken).toBeDefined();
      expect(typeof body.accessToken).toBe('string');
    });

    it('should reject login if credentials are invalid (wrong password)', async () => {
      const wrongCredentials = {
        email: userCredentials.email,
        password: 'incorrectPassword',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(wrongCredentials)
        .expect(401); // unauthorized status code

      const body = response.body as { message?: string };
      expect(body.message).toBe('Invalid credentials');
    });

    it('should reject login if email does not exist', async () => {
      const nonexistentCredentials = {
        email: 'nonexistent@example.com',
        password: 'somePassword',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(nonexistentCredentials)
        .expect(401);

      const body = response.body as { message?: string };
      expect(body.message).toBe('Invalid credentials');
    });
  });

  describe('GET /auth/admin-test (Guards & Authorization)', () => {
    const regularUserCredentials = {
      email: 'user@example.com',
      password: 'password12345',
    };

    const adminUserCredentials = {
      email: 'admin@example.com',
      password: 'password12345',
    };

    beforeEach(async () => {
      await registerAndVerify(app, usersService, regularUserCredentials);
      await registerAndVerify(app, usersService, adminUserCredentials);

      const adminUser = await usersService.findOneByEmail(
        adminUserCredentials.email,
      );
      expect(adminUser).toBeDefined();
      await usersService.update(adminUser!.id as UUID, {
        role: UserRole.ADMIN,
      });
    });

    it('should prevent access if no token is provided (JWT Guard)', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/admin-test')
        .expect(401);

      const body = response.body as { message?: string };
      expect(body.message).toBe('Unauthorized');
    });

    it('should prevent access if token is provided but user role is regular (Roles Guard)', async () => {
      // login as the regular user to retrieve their access token
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send(regularUserCredentials)
        .expect(201);

      const loginBody = loginResponse.body as { accessToken?: string };
      const token = loginBody.accessToken;

      // access the admin resource using the regular user's token
      const response = await request(app.getHttpServer())
        .get('/auth/admin-test')
        .set('Authorization', `Bearer ${token}`)
        .expect(403); // should return forbidden status code

      const body = response.body as { message?: string };
      expect(body.message).toBe(
        'You do not have permission to access this resource.',
      );
    });

    it('should allow access if token belongs to an admin user', async () => {
      // login as the admin user to retrieve their access token
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send(adminUserCredentials)
        .expect(201);

      const loginBody = loginResponse.body as { accessToken?: string };
      const token = loginBody.accessToken;

      // access the admin resource using the admin user's token
      const response = await request(app.getHttpServer())
        .get('/auth/admin-test')
        .set('Authorization', `Bearer ${token}`)
        .expect(200); // success

      const body = response.body as { message?: string };
      expect(body.message).toBe('You have admin access');
    });
  });
});
