# Enterprise Role-Based Access Control (RBAC) & Event-Driven Engine

An enterprise-grade, open-source backend engine built with **NestJS**, **TypeScript**, and **PostgreSQL**. This system provides a secure authentication & authorization foundation featuring multi-channel auth, token lifecycle management, defensive account lockout mechanisms, an event-driven email delivery pipeline, and a vendor-agnostic file upload engine.

---

## 📸 Key Features & Architecture

### 1. Multi-Channel Authentication & Security
- **Hybrid Authentication Mechanics:**
  - **Traditional Credentials:** Email + Password authentication secured with `bcrypt` password hashing.
  - **Social Identity Federation:** Google OAuth 2.0 with automatic account linking.
  - **Passwordless Magic OTP:** 6-digit email-delivered passcodes for friction-free authentication.
- **Token Lifecycle Management:**
  - Short-lived **Access Tokens** (15-minute expiration).
  - Single-use **Refresh Tokens** (7-day longevity) utilizing strict sliding-window token rotation.
  - Automated session revocation on password modifications or explicit logouts.
- **Account Lockout Defense:**
  - Real-time failed login attempt tracking.
  - Automatic 15-minute account lockout after 5 consecutive failed login attempts.
  - Instant security alert emails dispatched upon trigger.
- **Role-Based Access Control (RBAC):**
  - Granular multi-tier authorization (`USER`, `ADMIN`).
  - Custom `@Roles()` decorator paired with `RolesGuard` metadata extraction.
- **Endpoint Protection:**
  - Security header masking via `Helmet` (XSS, clickjacking prevention).
  - Dynamic CORS origin validation.
  - Global `ValidationPipe` for strict payload sanitization.

### 2. Asynchronous Event-Driven Engine
- **Decoupled Architecture:** Utilizes `@nestjs/event-emitter` to offload heavy background tasks (emails, analytics) from the main HTTP request-response thread.
- **Transactional Audit Ledger:** Dedicated `email_logs` relational table tracking every outbound email dispatch.
- **State Machine Pipeline:** Full delivery lifecycle tracking:  
  `Pending` ➡️ `Sent` ➡️ `Delivered` ➡️ `Opened` ➡️ `Clicked`
- **Resilience Engineering:** Automated exponential backoff and retry mechanisms wrapping outbound third-party API calls.
- **Telemetry Engine:** Real-time data parser aggregating open, bounce, and click rates.

### 3. Modular File Upload Subsystem
- **Standalone Architecture:** Vendor-agnostic file module allowing seamless provider swaps without breaking core domain logic.
- **Memory Streaming:** Direct streaming from disk-less `Multer` buffers to Cloudinary, ensuring zero temporary files land on the server filesystem.

---

## 🛠 Tech Stack

- **Framework:** NestJS (TypeScript)
- **Database:** PostgreSQL
- **ORM:** TypeORM / Prisma
- **Security:** Passport.js, JWT, Bcrypt, Helmet
- **Event Bus:** NestJS EventEmitter2
- **File Storage:** Multer, Cloudinary
- **Containerization:** Docker & Docker Compose (Optional)

---

## 🚀 Getting Started

### Prerequisites
Make sure you have the following installed locally:
- [Node.js](https://nodejs.org/) (v18+ or v20+)
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)
- [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)

---

### Installation & Environment Setup

1. **Clone the Repository:**
   ```bash
   git clone [https://github.com/your-username/rbac-event-engine.git](https://github.com/your-username/rbac-event-engine.git)
   cd rbac-event-engine

2. ### Install dependencies:
    ```bash
    npm install

3. ### Configure Environment Variables:
    Create a .env file in the root directory and configure your credentials:

    #### App Config 
    PORT=1000

    #### Database Config (Neon PostgreSQL)
    DATABASE_URL=postgresql://user:password@host/db?sslmode=require

    #### JWT Configuration Secrets
    JWT_ACCESS_SECRET=your_super_secret_access_key
    JWT_ACCESS_EXPIRY=15m
    JWT_VERIFICATION_SECRET=your_email_verification_secret_key

    #### Cloudinary Credentials
    CLOUDINARY_CLOUD_NAME=your_cloud_name
    CLOUDINARY_API_KEY=your_api_key
    CLOUDINARY_API_SECRET=your_api_secret

    OR: Copy the example environment configuration:
    cp .env.example .env
    And fill in your local setup details inside .env:

4. ### Run Database Migrations / Sync Engine:
    Ensure your target database instance is up and running.
    npm run migration:run

5. ### Fire Up the Engine Server:
    #### Development watch mode
    npm run start:dev

    #### Production build compilation
    npm run build
    npm run start:prod

## Security Workflows
    Role-Based Authorization Usage
    Protect routes using the @Roles() decorator and RolesGuard:

    import { Controller, Get, UseGuards } from '@nestjs/common';
    import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
    import { RolesGuard } from '../auth/guards/roles.guard';
    import { Roles } from '../auth/decorators/roles.decorator';
    import { Role } from '../users/enums/role.enum';

    @Controller('admin')
    @UseGuards(JwtAuthGuard, RolesGuard)
    export class AdminController {
  
    @Get('dashboard')
    @Roles(Role.ADMIN)
    getAdminDashboard() {
            return { message: 'Welcome to the privileged admin panel.' };
        }
    }

## Testing & Quality Assurance
    The code maintains strict behavioral unit testing isolates along with end-to-end integration boundaries via Jest.

#### Execute Unit Isolated Suites
    npm run test

#### Run tests in watch mode	
    npm run test:watch

#### Run End-To-End HTTP Route Tests
    npm run test:e2e

#### Inspect Automated Code Coverage Matrix
    npm run test:cov

#### Debug tests with breakpoints 	
    npm run test:debug

#### Run database integration tests 	
    npm run test:integration

#### Code formatting & linting checks
    npm run lint
    npm run format

## CI/CD Pipeline

### Tests automatically run on:

    ✅ Pull requests to main branch

    ✅ Push to develop branch

    ✅ Pre-commit hooks (via Husky)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

    Fork the repository

    Pick an Issue: Check open issues or pick a milestone task.

    Branching Strategy: Name your feature branches cleanly (e.g feat/feature-name, fix/bug-fix, or chore/task-name).

    Commit Conventions: Follow Conventional Commits format (e.g., feat(auth): implement refresh token rotation).

    Pull Requests: Ensure all unit/E2E tests pass and linting checks run cleanly before pushing/requesting code review.

    Push to the branch (git push origin feat/feature-name)

    Open a Pull Request

## Development Guidelines

    Write tests for new features

    Maintain or improve test coverage

    Follow existing code style and patterns

    Update documentation as needed

## 📝 **License**
  This project is MIT licensed.

## 🙏 Acknowledgments

A massive thank you to the incredible tools, frameworks, and platforms that power this ecosystem:

| Platform / Tool | Ecosystem Role |  |
| :--- | :--- | :--- |
| **[NestJS](https://nestjs.com)** | The progressive Node.js framework for building efficient, reliable, and scalable server-side applications. | ![NestJS](https://img.shields.io/badge/NestJS-EA284E?style=flat-square&logo=nestjs&logoColor=white) |
| **[Neon](https://neon.tech)** | Serverless open-source alternative to AWS Aurora PostgreSQL, separating compute and storage for modern backends. | ![Neon](https://img.shields.io/badge/Neon-00E599?style=flat-square&logo=neon&logoColor=black) |
| **[TypeORM](https://typeorm.io)** | Powerful Object-Relational Mapper that runs on NodeJS and enables elegant SQL management via TypeScript. | ![TypeORM](https://img.shields.io/badge/TypeORM-FE2C55?style=flat-square&logo=sequelize&logoColor=white) |
| **[Passport.js](https://passportjs.org)** | Flexible and modular authentication middleware for Node.js, supporting seamless JWT integration strategies. | ![Passport.js](https://img.shields.io/badge/Passport.js-34E0A1?style=flat-square&logo=passport&logoColor=white) |

