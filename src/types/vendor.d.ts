declare module 'bcrypt' {
  export interface BcryptModule {
    compare(plainText: string, hashedPassword: string): Promise<boolean>;
    hash(plainText: string, saltRounds: number): Promise<string>;
  }

  const bcrypt: BcryptModule;
  export default bcrypt;
}
