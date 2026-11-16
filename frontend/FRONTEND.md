# SIIP frontend

Next.js 15 (App Router), TypeScript, Tailwind v4, Radix/shadcn-style components, TanStack Query and Table, React Hook Form with the backend's own Zod schemas (from `shared/`), Recharts, Motion and Sonner. The design system is described in [DESIGN.md](DESIGN.md).

## Run it

```bash
pnpm install                 # at the repo root
cp frontend/.env.example frontend/.env.local
pnpm dev:frontend            # http://localhost:3000
```

The frontend has no demo data: every screen reads from and writes to the backend.

1. Set `API_URL` in `frontend/.env.local` to the backend's URL (`http://localhost:4000` locally).
2. Start the backend (`pnpm dev:backend`, with its database running) and sign in with a real account.

Every call in [src/client/api](src/client/api) goes to `/api/v1/*`. [next.config.ts](next.config.ts) proxies those requests to `API_URL`, so session cookies stay first-party and no CORS is needed. On Vercel, set `API_URL` on the frontend project to the deployed backend, and the backend's `APP_URL` to the frontend's public URL.

For local testing with sample people and companies, seed the backend with `SEED_DEMO=true` (never on production).

## Where things live

```
app/(public)     landing, for companies, about, contact, privacy, terms, verify
app/(auth)       sign-up, sign-in, verify-email, forgot-password, reset-password
app/(graduate)   graduate portal (bottom tabs on phones, sidebar on desktop)
app/company      company portal (collapsible sidebar, Ctrl/Cmd K)
app/admin        admin portal (collapsible sidebar, Ctrl/Cmd K)
src/client/api   one typed function per backend endpoint
src/components   ui/ (design system), shell/, marketing/, graduate/, company/, admin/
```

## Screens and routes

**Public:** `/` · `/companies` · `/about` · `/contact` · `/privacy` · `/terms` · `/verify?code=`

**Auth:** `/sign-up` · `/sign-in` · `/verify-email` · `/forgot-password` · `/reset-password?token=`

**Graduate:**

| Route                                 | Screen                                                             |
| ------------------------------------- | ------------------------------------------------------------------ |
| `/dashboard`                          | Journey tracker and your next step                                 |
| `/onboarding`                         | 6-step profile setup                                               |
| `/applications`, `/applications/[id]` | Apply, status and timeline                                         |
| `/training`, `/training/lessons/[id]` | Courses and lessons                                                |
| `/assessments`, `/assessments/[id]`   | Tests list and pre-test instructions                               |
| `/assessments/attempt/[id]`           | Timed test and result                                              |
| `/placement`                          | Internship and monthly check-ins                                   |
| `/certificates`                       | Certificate preview, download and share                            |
| `/notifications`                      | Notifications                                                      |
| `/settings`                           | Profile, notifications, password, data export and account deletion |

**Company:**

| Route                                                                  | Screen                                          |
| ---------------------------------------------------------------------- | ----------------------------------------------- |
| `/company`                                                             | Dashboard                                       |
| `/company/onboarding`                                                  | Registration and verification status            |
| `/company/openings`, `/company/openings/new`, `/company/openings/[id]` | Openings                                        |
| `/company/matches`, `/company/matches/[id]`                            | Candidates: why this match, accept or decline   |
| `/company/interns`, `/company/interns/[id]`                            | Interns: check-ins, evaluation, permanent offer |
| `/company/team`                                                        | Members and invitations                         |
| `/company/settings`                                                    | Company profile and account                     |
| `/company/notifications`                                               | Notifications                                   |

**Admin:**

| Route                                           | Screen                                                |
| ----------------------------------------------- | ----------------------------------------------------- |
| `/admin`                                        | Overview                                              |
| `/admin/analytics`                              | Analytics and CSV exports                             |
| `/admin/cohorts`, `/admin/cohorts/[id]`         | Cohorts                                               |
| `/admin/applications`                           | Applications: filters, bulk status change, side panel |
| `/admin/training`, `/admin/training/[courseId]` | Training content editor                               |
| `/admin/assessments`, `/admin/assessments/[id]` | Question builder and attempts                         |
| `/admin/companies`                              | Verification queue                                    |
| `/admin/matching`                               | Ranked suggestions and proposals                      |
| `/admin/placements`                             | Placements                                            |
| `/admin/certificates`                           | Approval queue and issued certificates                |
| `/admin/audit`                                  | Audit log                                             |

## Known limits

1. **Notification preferences** are stored on the device only; the backend has no setting for them yet.
2. **LGA** is a free-text field; a verified LGA dataset could replace it.
3. **Rate limiting behind the proxy:** confirm the backend sees the client's real IP in `x-forwarded-for`.
