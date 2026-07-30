import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserLoginLockout1753891200000 implements MigrationInterface {
  name = 'AddUserLoginLockout1753891200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "loginAttempts" integer NOT NULL DEFAULT 0',
    );
    await queryRunner.query(
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lockedUntil" timestamp NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN IF EXISTS "lockedUntil"',
    );
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN IF EXISTS "loginAttempts"',
    );
  }
}
