import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';

import { ExtractJwt, Strategy } from 'passport-jwt';

import { UserRole } from './../../auth/entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('appConfig.auth.jwtAccessSecret'),
    });
  }

  async validate(payload: { sub: string; email: string; role: UserRole }) {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
