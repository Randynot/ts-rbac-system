# Project Structure

This document defines the intended folder structure for the application. It
separates business core, reusable application concerns, runtime
infrastructure adapters, deployment infrastructure, and tests.

## Application Structure

```text
src/
├── main.ts
│   └── Application bootstrap.
│       Example: src/main.ts
│
├── app.module.ts
│   └── Composes global core and feature core.
│       Example: src/app.module.ts
│
├── config/
│   ├── app.config.ts
│   │   └── Application and authentication configuration.
│   │       Example: src/shared/config/app.config.ts
│   ├── database.config.ts
│   │   └── TypeORM configuration.
│   │       Example: src/shared/config/database.config.ts
│   ├── redis.config.ts
│   │   └── Redis configuration.
│   │       Example: src/shared/config/redis.config.ts
│   └── cloudinary.config.ts
│       └── Cloudinary configuration.
│           Example: src/shared/config/cloudinary.config.ts
│
├── common/
│   ├── decorators/
│   │   └── roles.decorator.ts
│   │       Example: src/common/decorators/roles.decorator.ts
│   ├── guards/
│   │   └── roles.guard.ts
│   │       Example: src/common/guards/roles/roles.guard.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   │       Centralized HTTP error response formatting and logging.
│   ├── interceptors/
│   │   └── request-logging.interceptor.ts
│   │       Logs request method, route, status, duration, and request ID.
│   ├── middleware/
│   │   └── request-context.middleware.ts
│   │       Creates or reads the request ID.
│   ├── logger/
│   │   └── app-logger.service.ts
│   │       Shared structured logging service.
│   └── types/
│       └── authenticated-request.type.ts
│           Shared HTTP request type containing authenticated user data.
│
├── core/
│   ├── auth/
│   │   ├── dto/
│   │   │   ├── create-auth.dto.ts
│   │   │   │   Example: src/core/auth/dto/create-auth.dto.ts
│   │   │   ├── refresh-token.dto.ts
│   │   │   │   Example: src/core/auth/dto/refresh-token.dto.ts
│   │   │   └── verification-email.dto.ts
│   │   │       Example: src/core/auth/dto/verification-email.dto.ts
│   │   ├── entities/
│   │   │   ├── refresh-token.entity.ts
│   │   │   │   Example: src/core/auth/entities/refresh-token.entity.ts
│   │   │   ├── password-reset.entity.ts
│   │   │   │   Example: src/core/auth/entities/password-reset.entity.ts
│   │   │   └── otp-verification.entity.ts
│   │   │       Example: src/core/auth/entities/otp-verification.entity.ts
│   │   ├── guards/
│   │   │   └── jwt.guard.ts
│   │   │       Example: src/core/auth/guards/jwt.guard.ts
│   │   ├── listeners/
│   │   │   └── user-registered.listener.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts
│   │   │   │   Example: src/core/auth/strategy/jwt.strategy.ts
│   │   │   └── local.strategy.ts
│   │   │       Example: src/core/auth/strategy/local.strategy.ts
│   │   ├── types/
│   │   │   ├── auth-response.type.ts
│   │   │   └── auth-token-payload.type.ts
│   │   ├── controller/
│   │   │   Example: src/core/auth/auth.controller.ts
│   │   ├── service/
│   │   │   Example: src/core/auth/auth.service.ts
│   │   └── auth.module.ts
│   │       Example: src/core/auth/auth.module.ts
│   │
│   ├── users/
│   │   ├── entities/
│   │   │   └── user.entity.ts
│   │   │       Current implementation: src/core/auth/entities/user.entity.ts
│   │   ├── listeners/
│   │   │   └── profile-picture-upload.listener.ts
│   │   ├── types/
│   │   │   └── profile-picture-upload-event.type.ts
│   │   ├── controller/
│   │   │   Example: src/core/users/users.controller.ts
│   │   ├── services/
│   │   │   ├── users.service.utils.ts
│   │   │   ├── users.service.ts
│   │   │   └── users.service.spec.ts
│   │   └── users.module.ts
│   │       Example: src/core/users/users.module.ts
│   │
│   └── health/
│       ├── health.controller.ts
│       │   Current implementation: src/app.controller.ts
│       └── health.service.ts
│           Current implementation: src/app.service.ts
│
├── infrastructure/
│   ├── cloudinary/
│   │   ├── cloudinary.module.ts
│   │   │   Example: src/core/cloudinary/cloudinary.module.ts
│   │   ├── cloudinary.provider.ts
│   │   └── cloudinary.service.ts
│   │       Example: src/core/cloudinary/cloudinary.service.ts
│   ├── email/
│   │   ├── types/
│   │   │   └── send-email-params.type.ts
│   │   ├── email.module.ts
│   │   │   Example: src/core/email/email.module.ts
│   │   └── email.service.ts
│   │       Example: src/core/email/email.service.ts
│   ├── queues/
│   │   ├── queues.module.ts
│   │   └── email/
│   │       ├── email-job.type.ts
│   │       ├── email.processor.ts
│   │       │   Example: src/core/queue/processors/email.processor.ts
│   │       └── email-queue-error-handler.provider.ts
│   │           Example: src/core/queue/email-queue-error-handler.provider.ts
│   └── redis/
│       ├── redis.module.ts
│       │   Example: src/core/redis/redis.module.ts
│       ├── redis.provider.ts
│       │   Example: src/core/redis/redis.provider.ts
│       └── redis-health.service.ts
│
├── database/
│   ├── data-source.ts
│   │   Example: src/database/data-source.ts
│   └── migrations/
│       └── 1753891200000-AddUserLoginLockout.ts
│           Example: src/database/migrations/1753891200000-AddUserLoginLockout.ts
│
└── types/
    ├── bcrypt.d.ts
    │   Example: src/types/bcrypt.d.ts
    └── vendor.d.ts
        Example: src/types/vendor.d.ts
```

## Unit Tests

Unit tests are colocated beside implementation files.

```text
src/core/auth/
├── auth.service.ts
├── auth.service.spec.ts

src/infrastructure/queues/email/
├── email.processor.ts
└── email.processor.spec.ts
```

## End-to-End Tests

End-to-end tests boot the whole Nest application and remain outside `src/`.

```text
test/
├── app.e2e-spec.ts
├── core/
│   ├── auth/
│   │   └── auth.e2e-spec.ts
│   └── users/
│       └── users.e2e-spec.ts
│           Add user profile-picture and future user route coverage here.
└── jest-e2e.json
```

## Deployment Infrastructure (Optional)

When AWS CDK or another infrastructure-as-code solution is introduced, keep it
outside the NestJS source tree.

```text
infrastructure/
└── cdk/
    ├── bin/
    │   └── app.ts
    ├── lib/
    │   ├── api-stack.ts
    │   ├── database-stack.ts
    │   ├── redis-stack.ts
    │   ├── storage-stack.ts
    │   └── observability-stack.ts
    └── test/
        └── api-stack.spec.ts
```