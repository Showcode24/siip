# SIIP Backend

This is the `backend/` package of the SIIP monorepo (see the [root README](../README.md)). Run the commands below from this folder, or from the repo root with `pnpm --filter @siip/backend <script>`. The Zod schemas live in [`shared/`](../shared/) so the frontend can reuse them. `src/server/validators/*` re-exports them.

Backend for **SIIP**, a free graduate internship and development programme for Nigeria. Graduates register, pass screening, complete training and a final assessment, get matched with a verified partner company for a three-month internship, and receive a verifiable certificate.

- **Stack:** Next.js 15 (App Router route handlers), TypeScript (strict), PostgreSQL on Neon, Prisma 7, Better Auth, Resend + React Email, Cloudinary, Zod 4, `@react-pdf/renderer`, Upstash rate limiting, Vercel Cron, Vitest.
- **API:** `/api/v1/*`. Every JSON response is `{ data, error, meta }`. The OpenAPI 3.1 spec is served at `/api/v1/openapi.json`.

## Contents

1. [Local setup](#local-setup)
2. [Environment variables](#environment-variables)
3. [Database: migrations and seed](#database-migrations-and-seed)
4. [Tests and quality checks](#tests-and-quality-checks)
5. [Deploying to Vercel and Neon](#deploying-to-vercel-and-neon)
6. [Architecture](#architecture)
7. [Business rules](#business-rules)
8. [Endpoints](#endpoints)

## Local setup

Requirements: Node.js 20+ and pnpm 9+.

```bash
pnpm install                 # run at the repo root; also runs `prisma generate`
cp .env.example .env         # then fill in BETTER_AUTH_SECRET at least
pnpm db:local                # local Postgres 17 on port 5433 (keep this terminal open)
pnpm db:deploy               # apply migrations
pnpm db:seed                 # demo data
pnpm dev                     # http://localhost:4000
```

`pnpm db:local` runs an embedded PostgreSQL with no Docker needed, and creates the `siip` and `siip_test` databases. If you prefer Docker, `docker compose up -d` provides the same databases on the same port.

With the defaults below, the app works locally with no third-party accounts:

- **No `RESEND_API_KEY`:** emails are rendered and recorded in `EmailLog` but not sent.
- **No Upstash keys:** rate limits use an in-memory fallback.
- **No Cloudinary keys:** everything works except uploads and certificate PDFs, which return a clear error.

## Environment variables

See [.env.example](.env.example) for a commented template.

| Variable                                                               | Required         | Purpose                                                                                                            |
| ---------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                                                         | Yes              | Neon **pooled** URL (host contains `-pooler`). Used by the app.                                                    |
| `DIRECT_URL`                                                           | Yes (migrations) | Neon **direct** URL. Used by Prisma migrations only.                                                               |
| `DATABASE_POOL_MAX`                                                    | No               | Connections per serverless instance. Default 5.                                                                    |
| `APP_URL`                                                              | Yes              | Public URL of the **frontend** (which proxies `/api/*` here). Used in email links and as the Better Auth base URL. |
| `BETTER_AUTH_SECRET`                                                   | Yes              | 32+ random characters (`openssl rand -base64 32`).                                                                 |
| `CONSENT_VERSION`                                                      | No               | Version of the privacy notice, stored with each user's consent.                                                    |
| `RESEND_API_KEY`                                                       | Production       | Resend API key.                                                                                                    |
| `EMAIL_FROM`                                                           | Production       | Sender, e.g. `SIIP <no-reply@your-domain.ng>`. The domain must be verified in Resend.                              |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Production       | File storage: CVs, photos, logos, lesson files, certificates.                                                      |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                   | Production       | Rate limiting.                                                                                                     |
| `CRON_SECRET`                                                          | Production       | 16+ characters. Vercel sends it as `Authorization: Bearer …` to the cron route.                                    |
| `SEED_SUPER_ADMIN_EMAIL`, `SEED_SUPER_ADMIN_PASSWORD`                  | Seed only        | The first super admin account.                                                                                     |

In production the app refuses to start if any variable marked "Production" is missing.

## Database: migrations and seed

| Command           | What it does                                                              |
| ----------------- | ------------------------------------------------------------------------- |
| `pnpm db:migrate` | Create a new migration from `prisma/schema.prisma` changes (development). |
| `pnpm db:deploy`  | Apply pending migrations (CI and production).                             |
| `pnpm db:seed`    | Load demo data. Safe to re-run.                                           |
| `pnpm db:reset`   | Drop, re-migrate and re-seed the local database.                          |

The seed creates:

- a super admin (from `SEED_SUPER_ADMIN_*`)
- one cohort
- 15 skills
- a sample course and screening test
- two verified companies with openings
- ten graduates at different stages

Demo graduates (e.g. `chidinma.okafor@graduate.test`) and company owners (`owner@lagosmediahub.test`, `owner@abujabiz.test`) use the password `Password123!`.

The full-text search index on graduate profiles is maintained by database triggers defined in the initial migration. It is ready for the planned company-search feature.

## Tests and quality checks

```bash
pnpm typecheck               # tsc --noEmit
pnpm lint                    # ESLint (no `any`, no unused code)
pnpm format:check            # Prettier
pnpm test:unit               # pure logic: state machines, scoring, matching, CSV, etc.
pnpm test:integration        # needs the local database running (pnpm db:local)
pnpm test                    # both
pnpm openapi                 # regenerate the OpenAPI spec and the endpoint table below
```

Integration tests call the real route handlers against the `siip_test` database. Email is mocked, and Cloudinary is mocked where uploads are involved. They refuse to run against any database whose name does not end in `_test`.

They cover:

- the graduate journey from sign-up to certificate
- the company journey from registration to evaluation
- training and timed, server-scored exams
- matching and placement
- access control (graduate A cannot read graduate B's data; company A cannot see company B's interns)
- the daily cron and the data-protection features

## Deploying to Vercel and Neon

1. **Neon:**
   - Create a project in the region closest to your users.
   - Copy the **pooled** connection string into `DATABASE_URL` and the **direct** one into `DIRECT_URL`.
   - Optionally create a `preview` branch for Vercel preview deployments.
2. **Resend:** verify your sending domain and create an API key.
3. **Cloudinary:** create a free account and copy the cloud name, API key and secret.
4. **Upstash:** create a free Redis database and copy its REST URL and token.
5. **Vercel:**
   - Import the repository as a project with **Root Directory `backend`**, and add every variable from the table above to Production (and Preview).
   - Set the build command to `pnpm db:deploy && pnpm build`, so migrations run before each deploy.
6. **Cron:** [vercel.json](vercel.json) schedules `GET /api/v1/cron/daily` for 06:00 UTC (07:00 in Lagos). Vercel sends `CRON_SECRET` automatically. The Hobby plan allows one run per day, which is all this needs.
7. **Seed the first admin:** run `pnpm db:seed` once against production, or create the admin manually. Then change the seed password.
8. **Smoke test:**
   - `GET /api/v1/health` should return `200`.
   - `GET /api/v1/openapi.json` should return the spec.
   - Sign up a test account and check that the verification email arrives.

Running costs at launch are $0: Vercel Hobby, Neon Free, Resend Free (100 emails/day), Cloudinary Free, Upstash Free. The first limits you are likely to hit are Resend's daily email cap and Neon's compute hours. Upgrade those first.

## Architecture

```
app/api/v1/...            thin route handlers: validate → guard → service
src/server/services/      business logic, one file per domain
src/server/auth/          Better Auth config, session and role guards, cron guard
src/server/validators/    Zod schemas (also the source of the OpenAPI spec)
src/server/lib/           errors, HTTP helpers, pagination, audit log, state machines,
                          rate limits, scoring (assessments, matching), CSV
src/server/email/         Resend sender (idempotent, logged) + React Email templates
src/server/storage/       Cloudinary signed uploads and private downloads
src/server/pdf/           certificate PDF
prisma/                   schema, migrations, seed
```

Key design decisions:

- **State machines:** applications, cohorts, companies, openings, matches and placements can only change status through [state-machine.ts](src/server/lib/state-machine.ts). Illegal moves return `409 INVALID_TRANSITION`. Every application status change goes through one function (`transitionApplication`), which writes the timeline event, the audit row and the in-app notification in the same transaction.
- **Audit log:** every admin action and status change is recorded with who, what, before, after and when. Personal data is never written to the audit log or to application logs.
- **Idempotent side effects:** each email has a unique key per event (e.g. `certificate-issued:<id>`). Certificates are unique per placement. Retries never send or issue twice, and a failed email never breaks the action that triggered it.
- **Exams:** questions and options are shuffled per attempt on the server. Answer keys never leave the server. The deadline is enforced server-side, with 30 seconds of grace for network delay.
- **Privacy:**
  - Companies see limited graduate profiles (no phone, email or CV) until they accept a match.
  - CVs and certificates are private Cloudinary files, served through links that expire after 10 minutes.
  - Downloading a CV and every CSV export are recorded in the audit log.
- **Matching:** all weights and rules live in [matching.ts](src/server/lib/matching.ts). `createMatch` is shared, so a future company-request feature can create matches the same way admins do.

## Business rules

Rules where the brief left room for a choice. Each one is easy to change in the file named.

| Rule                                                                                                                                                                                        | Where                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| To apply, a graduate needs phone, state, institution, course, graduation year, availability, a CV and at least one skill.                                                                   | `lib/profile-completeness.ts`                        |
| One active application per graduate at a time.                                                                                                                                              | `services/application.service.ts`                    |
| Cohort capacity is enforced at shortlisting, not at application.                                                                                                                            | `services/application.service.ts`                    |
| Rejecting an application or a company requires a reason, which the applicant sees.                                                                                                          | services                                             |
| Finishing every lesson moves the application to `FINAL_ASSESSMENT`. Passing the final assessment moves it to `QUALIFIED`. Taking the screening test moves a new application to `SCREENING`. | `training.service.ts`, `attempt.service.ts`          |
| Failing the final assessment with no attempts left does **not** reject the graduate automatically. An admin rejects them or grants a retake.                                                | `attempt.service.ts`                                 |
| No partial credit on multiple-choice questions. Questions and pass mark lock once anyone has attempted the assessment.                                                                      | `lib/assessment-scoring.ts`, `assessment.service.ts` |
| Only the company owner manages the profile, openings, invitations and match decisions. Supervisors can view.                                                                                | routes (`ownerOnly`)                                 |
| Openings can be drafted while the company is pending, but only published once it is verified. Suspending a company closes its openings.                                                     | `opening.service.ts`, `company.service.ts`           |
| Admins may propose more graduates than an opening has slots. Slots are enforced when the company accepts. Filling the last slot closes the opening and releases the other proposals.        | `match.service.ts`                                   |
| Placements default to 3 months, starting on the later of today and the cohort's internship start date.                                                                                      | `match.service.ts`                                   |
| Check-ins: one per month (1–3) from each side. The evaluation opens 14 days before the end date.                                                                                            | `internship.service.ts`                              |
| Certificates need: placement completed, company evaluation submitted, admin approval.                                                                                                       | `certificate.service.ts`                             |
| Deleted accounts are anonymised after 30 days. Graduates with an active internship and company owners must contact SIIP first.                                                              | `privacy.service.ts`                                 |

## Endpoints

Generated from the route handlers by `pnpm openapi`. "Company owner" routes require the `OWNER` role within the company. All company routes only ever return data belonging to the caller's own company.

<!-- endpoints:start -->
| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/v1/admin/analytics` | Admin | Get analytics |
| GET | `/api/v1/admin/applications` | Admin | List applications for admin |
| GET | `/api/v1/admin/applications/{id}` | Admin | Get application for admin |
| POST | `/api/v1/admin/applications/{id}/notes` | Admin | Add application note |
| POST | `/api/v1/admin/applications/{id}/status` | Admin | Change application status |
| POST | `/api/v1/admin/applications/bulk-status` | Admin | Bulk change application status |
| GET | `/api/v1/admin/assessments` | Admin | List assessments |
| POST | `/api/v1/admin/assessments` | Admin | Create assessment |
| GET | `/api/v1/admin/assessments/{id}` | Admin | Get assessment for admin |
| PATCH | `/api/v1/admin/assessments/{id}` | Admin | Update assessment |
| DELETE | `/api/v1/admin/assessments/{id}` | Admin | Delete assessment |
| GET | `/api/v1/admin/assessments/{id}/attempts` | Admin | List attempts |
| POST | `/api/v1/admin/assessments/{id}/questions` | Admin | Add question |
| POST | `/api/v1/admin/assessments/{id}/retakes` | Admin | Grant retake |
| GET | `/api/v1/admin/cohorts` | Admin | List cohorts for admin |
| POST | `/api/v1/admin/cohorts` | Admin | Create cohort |
| GET | `/api/v1/admin/cohorts/{id}` | Admin | Get cohort for admin |
| PATCH | `/api/v1/admin/cohorts/{id}` | Admin | Update cohort |
| POST | `/api/v1/admin/cohorts/{id}/status` | Admin | Change cohort status |
| GET | `/api/v1/admin/companies` | Admin | List companies for admin |
| GET | `/api/v1/admin/companies/{id}` | Admin | Get company for admin |
| POST | `/api/v1/admin/companies/{id}/status` | Admin | Change company status |
| GET | `/api/v1/admin/courses` | Admin | List courses |
| POST | `/api/v1/admin/courses` | Admin | Create course |
| GET | `/api/v1/admin/courses/{id}` | Admin | Get course for admin |
| PATCH | `/api/v1/admin/courses/{id}` | Admin | Update course |
| DELETE | `/api/v1/admin/courses/{id}` | Admin | Delete course |
| POST | `/api/v1/admin/courses/{id}/modules` | Admin | Create module |
| GET | `/api/v1/admin/exports/applications` | Admin | Export applications |
| GET | `/api/v1/admin/exports/placements` | Admin | Export placements |
| GET | `/api/v1/admin/graduates/{id}/cv` | Admin | Get cv download url for admin |
| PATCH | `/api/v1/admin/lessons/{id}` | Admin | Update lesson |
| DELETE | `/api/v1/admin/lessons/{id}` | Admin | Delete lesson |
| POST | `/api/v1/admin/lessons/{id}/attachment` | Admin | Attach lesson file |
| POST | `/api/v1/admin/lessons/{id}/attachment/sign` | Admin | Sign lesson attachment |
| POST | `/api/v1/admin/matches` | Admin | Propose match |
| POST | `/api/v1/admin/matches/{id}/withdraw` | Admin | Withdraw match |
| GET | `/api/v1/admin/matching/suggestions` | Admin | Get suggestions |
| PATCH | `/api/v1/admin/modules/{id}` | Admin | Update module |
| DELETE | `/api/v1/admin/modules/{id}` | Admin | Delete module |
| POST | `/api/v1/admin/modules/{id}/lessons` | Admin | Create lesson |
| GET | `/api/v1/admin/openings` | Admin | List openings for admin |
| POST | `/api/v1/admin/openings/{id}/status` | Admin | Change opening status as admin |
| GET | `/api/v1/admin/placements` | Admin | List placements for admin |
| GET | `/api/v1/admin/placements/{id}` | Admin | Get placement for admin |
| POST | `/api/v1/admin/placements/{id}/certificate` | Admin | Issue certificate |
| POST | `/api/v1/admin/placements/{id}/complete` | Admin | Complete placement |
| POST | `/api/v1/admin/placements/{id}/review` | Admin | Review placement |
| POST | `/api/v1/admin/placements/{id}/terminate` | Admin | Terminate placement |
| PUT | `/api/v1/admin/questions/{id}` | Admin | Replace question |
| DELETE | `/api/v1/admin/questions/{id}` | Admin | Delete question |
| GET | `/api/v1/admin/reviews` | Admin | List review queue |
| GET | `/api/v1/admin/reviews/{id}` | Admin | Get review |
| POST | `/api/v1/admin/reviews/{id}/decision` | Admin | Decide profile |
| POST | `/api/v1/admin/reviews/{id}/skills/{skillId}` | Admin | Decide skill |
| GET | `/api/v1/admin/siip-test` | Admin | Get siip test for admin |
| POST | `/api/v1/admin/siip-test/videos` | Admin | Create video |
| PATCH | `/api/v1/admin/siip-test/videos/{id}` | Admin | Update video |
| DELETE | `/api/v1/admin/siip-test/videos/{id}` | Admin | Delete video |
| POST | `/api/v1/admin/siip-test/videos/reorder` | Admin | Reorder videos |
| GET | `/api/v1/admin/skill-documents/{id}/url` | Admin | Get skill document url for admin |
| POST | `/api/v1/auth/forgot-password` | Public | Request password reset |
| GET | `/api/v1/auth/me` | Any signed-in user | Get me |
| POST | `/api/v1/auth/resend-verification` | Public | Resend verification |
| POST | `/api/v1/auth/reset-password` | Public | Reset password |
| POST | `/api/v1/auth/sign-in` | Public | Sign in |
| POST | `/api/v1/auth/sign-out` | Public | Sign out |
| POST | `/api/v1/auth/sign-up` | Public | Sign up |
| GET | `/api/v1/auth/verify-email` | Public | Verify email |
| GET | `/api/v1/cohorts` | Public | List open cohorts |
| GET | `/api/v1/company/interns` | Company member | List my interns |
| GET | `/api/v1/company/interns/{id}` | Company member | Get my intern |
| GET | `/api/v1/company/interns/{id}/check-ins` | Company member | List intern check ins |
| POST | `/api/v1/company/interns/{id}/check-ins` | Company member | Submit supervisor check in |
| POST | `/api/v1/company/interns/{id}/evaluation` | Company member | Submit evaluation |
| POST | `/api/v1/company/interns/{id}/permanent-offer` | Company owner | Record permanent offer |
| POST | `/api/v1/company/interns/{id}/supervisor` | Company owner | Assign supervisor |
| GET | `/api/v1/company/invitations` | Company owner | List invitations |
| POST | `/api/v1/company/invitations` | Company owner | Invite supervisor |
| DELETE | `/api/v1/company/invitations/{id}` | Company owner | Revoke invitation |
| POST | `/api/v1/company/invitations/accept` | Company member | Accept invitation |
| POST | `/api/v1/company/logo` | Company owner | Confirm logo |
| POST | `/api/v1/company/logo/sign` | Company owner | Sign logo upload |
| GET | `/api/v1/company/matches` | Company member | List company matches |
| GET | `/api/v1/company/matches/{id}` | Company member | Get company match |
| POST | `/api/v1/company/matches/{id}/accept` | Company owner | Accept match |
| GET | `/api/v1/company/matches/{id}/cv` | Company member | Get match cv for company |
| POST | `/api/v1/company/matches/{id}/reject` | Company owner | Reject match |
| GET | `/api/v1/company/members` | Company member | List members |
| DELETE | `/api/v1/company/members/{id}` | Company owner | Remove member |
| GET | `/api/v1/company/openings` | Company member | List my openings |
| POST | `/api/v1/company/openings` | Company owner | Create opening |
| GET | `/api/v1/company/openings/{id}` | Company member | Get my opening |
| PATCH | `/api/v1/company/openings/{id}` | Company owner | Update opening |
| POST | `/api/v1/company/openings/{id}/status` | Company owner | Change my opening status |
| GET | `/api/v1/company/profile` | Company member | Get my company |
| PATCH | `/api/v1/company/profile` | Company owner | Update my company |
| POST | `/api/v1/company/register` | Company member | Register company |
| POST | `/api/v1/company/resubmit` | Company owner | Resubmit company |
| GET | `/api/v1/cron/daily` | Cron (secret) | Run daily jobs |
| GET | `/api/v1/graduate/applications` | Graduate | List my applications |
| POST | `/api/v1/graduate/applications` | Graduate | Apply to cohort |
| GET | `/api/v1/graduate/applications/{id}` | Graduate | Get my application |
| POST | `/api/v1/graduate/applications/{id}/withdraw` | Graduate | Withdraw application |
| GET | `/api/v1/graduate/assessments` | Graduate | List my assessments |
| POST | `/api/v1/graduate/assessments/{id}/attempts` | Graduate | Start attempt |
| GET | `/api/v1/graduate/attempts/{id}` | Graduate | Get my attempt |
| PUT | `/api/v1/graduate/attempts/{id}/answers` | Graduate | Save answers |
| POST | `/api/v1/graduate/attempts/{id}/submit` | Graduate | Submit attempt |
| GET | `/api/v1/graduate/certificates` | Graduate | List my certificates |
| GET | `/api/v1/graduate/certificates/{id}/download` | Graduate | Get my certificate download |
| GET | `/api/v1/graduate/placement` | Graduate | Get my placement |
| GET | `/api/v1/graduate/placement/check-ins` | Graduate | List my check ins |
| POST | `/api/v1/graduate/placement/check-ins` | Graduate | Submit intern check in |
| GET | `/api/v1/graduate/profile` | Graduate | Get profile |
| PATCH | `/api/v1/graduate/profile` | Graduate | Update profile |
| GET | `/api/v1/graduate/profile/cv` | Graduate | Get cv download url |
| POST | `/api/v1/graduate/profile/submit` | Graduate | Submit for review |
| GET | `/api/v1/graduate/siip-test` | Graduate | Get my siip test |
| POST | `/api/v1/graduate/siip-test/videos/{id}/watched` | Graduate | Mark video watched |
| GET | `/api/v1/graduate/skill-documents/{id}/url` | Graduate | Get skill document url |
| GET | `/api/v1/graduate/skills` | Graduate | List my skills |
| POST | `/api/v1/graduate/skills` | Graduate | Add skill |
| PATCH | `/api/v1/graduate/skills/{id}` | Graduate | Update skill |
| DELETE | `/api/v1/graduate/skills/{id}` | Graduate | Remove skill |
| POST | `/api/v1/graduate/skills/{id}/documents` | Graduate | Add skill file |
| DELETE | `/api/v1/graduate/skills/{id}/documents/{documentId}` | Graduate | Remove skill document |
| POST | `/api/v1/graduate/skills/{id}/documents/sign` | Graduate | Sign skill document |
| GET | `/api/v1/graduate/training` | Graduate | Get my training |
| GET | `/api/v1/graduate/training/lessons/{id}` | Graduate | Get my lesson |
| POST | `/api/v1/graduate/training/lessons/{id}/complete` | Graduate | Complete lesson |
| GET | `/api/v1/graduate/training/progress` | Graduate | Get my progress |
| POST | `/api/v1/graduate/uploads` | Graduate | Sign graduate upload |
| POST | `/api/v1/graduate/uploads/confirm` | Graduate | Confirm graduate upload |
| GET | `/api/v1/health` | Public | GET /api/v1/health |
| GET | `/api/v1/me/data-export` | Any signed-in user | Export my data |
| POST | `/api/v1/me/delete-account` | Any signed-in user | Request account deletion |
| GET | `/api/v1/notifications` | Any signed-in user | List notifications |
| POST | `/api/v1/notifications/{id}/read` | Any signed-in user | Mark notification read |
| POST | `/api/v1/notifications/read-all` | Any signed-in user | Mark all notifications read |
| GET | `/api/v1/openapi.json` | Public | GET /api/v1/openapi.json |
| GET | `/api/v1/public/certificates/verify/{code}` | Public | Verify certificate |
| GET | `/api/v1/skills` | Public | List skills |
<!-- endpoints:end -->
