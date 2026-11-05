# SIIP frontend

Next.js 15 (App Router), TypeScript, Tailwind v4, Radix/shadcn-style components, TanStack Query and Table, React Hook Form with the backend's own Zod schemas (from `shared/`), Recharts, Motion and Sonner. The design system is described in [DESIGN.md](DESIGN.md).

## Run it

```bash
pnpm install                 # at the repo root
cp frontend/.env.example frontend/.env.local
pnpm dev:frontend            # http://localhost:3000
```

With `NEXT_PUBLIC_USE_MOCKS=true` (the default), no backend is needed.

**Switching accounts:** use the **Switch role** button (bottom right; development only) to jump between demo accounts:

- graduates at every stage (just signed up, applied, in training, final assessment, matched, on internship, certified)
- a verified company owner and a pending company owner
- a supervisor
- the admin

You can also sign in with any demo email (e.g. `admin@siip.ng`, `owner@lagosmediahub.ng`) and any password.

**Mock behaviour:**

- **Realistic responses:** mock data comes from a seeded generator in [src/client/mocks](src/client/mocks), so it's the same on every load. Responses take 300–800ms, and about 3% of reads fail on purpose so error states get exercised. Set `NEXT_PUBLIC_MOCK_ERROR_RATE=0` to stop that.
- **Changes are kept in memory** (applying, accepting a match, submitting an evaluation, and so on), so the UI reacts realistically. A page reload resets them.

## Switch to the real backend

1. Set `NEXT_PUBLIC_USE_MOCKS=false` and `API_URL=http://localhost:4000` (the backend's URL) in `frontend/.env.local`.
2. Start the backend (`pnpm dev:backend`).

Every call in [src/client/api](src/client/api) then goes to `/api/v1/*`. The frontend's [next.config.ts](next.config.ts) proxies those requests to `API_URL`, so session cookies stay first-party. Request and response shapes already match the backend (`{ data, error, meta }`). On Vercel, set the backend's `APP_URL` to the frontend's public URL.

## Where things live

```
app/(public)     landing, for companies, about, contact, privacy, terms, verify
app/(auth)       sign-up, sign-in, verify-email, forgot-password, reset-password
app/(graduate)   graduate portal (bottom tabs on phones, sidebar on desktop)
app/company      company portal (collapsible sidebar, Ctrl/Cmd K)
app/admin        admin portal (collapsible sidebar, Ctrl/Cmd K)
src/client/api   one typed function per backend endpoint (mock or real)
src/client/mocks in-memory demo data and mock business rules
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

## Backend gaps found while building the UI

The UI is built for these; in mock mode they work, in real mode they need a backend route first:

1. **Audit log list:** `GET /admin/audit`.
2. **Change password:** expose Better Auth's change-password under `/api/v1/auth/change-password`.
3. **Notification preferences:** currently stored on the device only.
4. **Read the company's evaluation:** `GET /company/interns/:id/evaluation` (only POST exists).
5. **Certificates in admin data:** include `certificate` in `GET /admin/placements/:id`, and add a certificates list for the issued tab.
6. **Check-in counts on the placements list,** so overdue check-ins can be flagged in the table (today they're flagged in the detail panel only).
7. **Contact form endpoint:** the form currently simulates sending.
8. **LGA by state:** LGA is a free-text field for now; a verified LGA dataset should replace it.
9. **Rate limiting behind the proxy:** confirm the backend sees the client's real IP in `x-forwarded-for`.
