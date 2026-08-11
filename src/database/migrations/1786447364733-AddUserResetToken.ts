import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserResetToken1786447364733 implements MigrationInterface {
    name = 'AddUserResetToken1786447364733'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "resetToken" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "resetToken"`);
    }

}