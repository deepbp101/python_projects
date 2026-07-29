# Wedding Planner

A shared workspace for planning a wedding: an auto-generated checklist, a
budget that tracks deposits and final payments, a guest list with RSVPs and
meal choices, and a countdown — all updating live for everyone helping.

**Phase 1 (MVP) is complete.** Phases 2–4 from the original brief (wedding
website builder, seating chart, vendor directory, messaging, day-of features,
AI assistants) are not built yet.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL 16 via Prisma 7 (`@prisma/adapter-pg`) |
| Auth | Database-backed sessions in an HTTP-only cookie, bcrypt passwords |
| Realtime | Socket.IO on a custom Node server (`server.ts`) |
| Tests | Vitest |

Next and Socket.IO share one HTTP server because serverless platforms cannot
hold WebSocket connections, and live collaboration is a core requirement.
Deploy to a platform with long-lived processes — Railway, Render, Fly — rather
than Vercel.

## Getting started

```bash
npm install
cp .env.example .env          # then set DATABASE_URL and AUTH_SECRET
npm run db:migrate            # create the schema
npm run db:seed               # load a realistic demo wedding
npm run dev                   # http://localhost:3000
```

`AUTH_SECRET` can be any long random string (`openssl rand -hex 32`). It keys
the hashes of session and invite tokens, so changing it signs everyone out.

### Demo accounts

After seeding, sign in with password `wedding-demo-2026`:

| Email | Role | What they see |
|---|---|---|
| `sam@example.com` | Owner | Everything |
| `alex@example.com` | Partner | Everything |
| `jamie@example.com` | Planner | Budget is view-only |
| `robin@example.com` | Family | Budget is hidden |

The seed is deliberately mid-planning — some RSVPs outstanding, one category
over budget, one overdue deposit — so every dashboard state is reachable
without editing rows by hand.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server with Socket.IO |
| `npm run build` | `prisma generate` + `next build` |
| `npm start` | Production server |
| `npm test` | Vitest run |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:seed` | Reset and reseed demo data |
| `npm run db:studio` | Prisma Studio |

## What's built

**Auth & workspace** — sign up, sign in, create a wedding, invite collaborators
by email with a single-use link, per-section view/edit permissions.

**Checklist** — 53 default tasks generated from the wedding date across 12mo /
9mo / 6mo / 3mo / 1mo / 1wk / day-of / after milestones, plus custom tasks,
assignment, and completion tracking. Regenerating is idempotent: it only adds
catalog entries the wedding is missing, so it never destroys your own edits.
For a short engagement, tasks whose natural due date has already passed are
pulled forward to today rather than created pre-overdue.

**Budget** — categories with their own caps and alert thresholds, line items,
and a payment schedule per item (deposit, instalments, final payment) so
due-date reminders work at the right granularity. Warns when a category nears
its limit, when it goes over, and when the category caps together exceed the
overall budget.

**Guests & RSVP** — households with mailing addresses, group tags, plus-ones as
real guest rows, age groups, dietary needs, meal choices, and a bulk paste
import. Counts feed the caterer's headcount.

**Countdown** — live days/hours/minutes/seconds on the dashboard, plus a
compact version in the workspace header.

**Realtime** — every mutation broadcasts to a per-wedding Socket.IO room and
other collaborators refresh automatically. Presence shows who else is looking.

## Architecture notes

**Money is integer cents everywhere.** `src/lib/money.ts` handles parsing and
formatting. Floats never touch an amount.

**Dates are whole UTC days.** `src/lib/dates.ts` — wedding planning is
calendar-day arithmetic, and doing it in local time shifts tasks by a day
across a DST boundary.

**Domain logic is pure and separately tested.** `src/lib/domain/` holds timeline
generation, budget rollups and RSVP counts as functions over plain objects with
no database access, which is what the 70 tests in `tests/` exercise.

**Authorisation is server-side only.** Every API route goes through
`requireWorkspace()` in `src/lib/api.ts`. The client's access map only decides
what to *offer*; it never decides what is *allowed*. A non-member gets a 404
rather than a 403, so other couples' weddings aren't discoverable.

**Tokens are stored hashed.** Session and invite tokens exist in plaintext only
in a cookie or an invite link; the database holds SHA-256 hashes keyed with
`AUTH_SECRET`. Accepting an invite burns the token.

**`server.ts` must not import `next/headers`.** It runs outside Next's
bootstrap, and pulling in Next's request internals there fails at load. Shared
constants live in `src/lib/auth/constants.ts` for that reason.

## Known gaps

- Invite links are shown in the UI to copy manually — no email provider is
  wired up yet.
- The default task catalog lives in code (`src/lib/domain/timeline.ts`), not in
  the database, so couples can't edit the templates themselves.
- Changing the wedding date does not reschedule existing tasks; use "Refresh
  timeline" on the checklist to add anything newly missing.
- No file/photo storage yet (that arrives with the mood board in Phase 2).
