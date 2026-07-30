# Wedding Planner

A shared workspace for planning a wedding: an auto-generated checklist, a
budget that tracks deposits and final payments, a guest list with RSVPs and
meal choices, and a countdown — all updating live for everyone helping.

**Phases 1, 2 and 3 are complete** — core planning tools, the guest-facing
wedding website, seating chart and mood board, and vendor coordination with
per-vendor message threads. Phase 4 from the original brief (day-of features,
guest photo gallery, AI assistants) is not built yet.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL 16 via Prisma 7 (`@prisma/adapter-pg`) |
| Auth | Database-backed sessions in an HTTP-only cookie, bcrypt passwords |
| Realtime | Socket.IO on a custom Node server (`server.ts`) |
| File storage | Pluggable driver; local disk today (`src/lib/storage`) |
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
| `robin@example.com` | Family | Budget and vendors are hidden |

The seed is deliberately mid-planning — some RSVPs outstanding, one category
over budget, one overdue deposit, a florist mid-negotiation — so every dashboard
state is reachable without editing rows by hand. It also prints a working
`/vendor/…` link, which is what a vendor sees with no account at all.

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

### Phase 2 — the guest-facing side

**Wedding website** — a builder for the headline, story, events, travel notes
and registry links, in three templates (Classic, Garden, Modern). Publishing
puts it at `/wedding/<slug>` with no auth; unpublishing takes it straight back
offline without losing anything written. Slugs are normalised, so typing
"Sam & Alex" gives `sam-and-alex`.

**Seating chart** — a floor plan where tables are dragged into place and guests
are seated by tapping a guest then a table. Positions are stored as percentages
of the canvas, so a plan laid out on a laptop still reads on a phone; tap-to-
assign is used instead of HTML5 drag-and-drop, which is unreliable on touch.
Only guests who have accepted (or replied maybe) can hold a seat, a guest's seat
is unique in the database so double-booking is impossible, and declining an
invitation frees the seat automatically.

**Mood board** — images uploaded into categories with notes and source links,
laid out in columns so portrait and landscape sit together uncropped. A
revocable share link at `/moodboard/<token>` lets a florist or stylist see the
board without an account; revoking mints a new token, so an old link never comes
back to life.

### Phase 3 — vendor coordination

**Vendor directory** — a listing per business, shared across every wedding in the
app, searchable by name, city, category and rating. Ratings only mean anything if
couples review the same row, so `Vendor` is deliberately global and holds nothing
private; one review per wedding, and only for a vendor already on your shortlist,
which is the cheapest defence against drive-by ratings. Reviews publish a first
name and last initial, never which wedding they came from.

**Shortlist** — the couple's own view of a vendor: status from considering through
booked, the contact they deal with, private notes, and a link to the budget line
that pays for it.

**Message threads** — one thread per vendor, text and files in a single request so
a quote can never arrive without its message. Attachments accept PDFs as well as
images, because contracts are PDFs.

**Vendors have links, not logins.** A florist working with twenty couples will not
sign up twenty times, so each thread carries a revocable token; opening
`/vendor/<token>` shows the conversation and whatever has been shared into it,
with no account. Withdrawing access kills the link and every file behind it, and
re-granting mints a different one.

**Sharing into a thread** — the mood board goes across whole. A budget line goes
across as its payment schedule only: labels, dates, and paid or outstanding. No
amount ever reaches a vendor. The share dialog shows the couple the exact payload
first, because that is the only thing that catches a number they typed into a
payment label themselves.

## Architecture notes

**Money is integer cents everywhere.** `src/lib/money.ts` handles parsing and
formatting. Floats never touch an amount.

**Dates are whole UTC days.** `src/lib/dates.ts` — wedding planning is
calendar-day arithmetic, and doing it in local time shifts tasks by a day
across a DST boundary.

**Domain logic is pure and separately tested.** `src/lib/domain/` holds timeline
generation, budget rollups, RSVP counts, seating maths, thread unread counts and
the vendor redaction rules as functions over plain objects with no database
access — which is what the 172 tests in `tests/` exercise. Anything a client component needs (category labels, template themes)
belongs there too: importing it from `src/lib/services/` would drag Prisma into
the browser bundle and fail the build.

**PATCH schemas must strip `.default()`.** Zod's `.partial()` keeps defaults, so
a PATCH sending one field silently resets every other defaulted field — dragging
a table reset its capacity, and renaming a budget category zeroed its budget.
`partialForUpdate()` in `src/lib/validation.ts` strips them; `tests/validation.test.ts`
pins the behaviour.

**Authorisation is server-side only.** Every API route goes through
`requireWorkspace()` in `src/lib/api.ts`. The client's access map only decides
what to *offer*; it never decides what is *allowed*. A non-member gets a 404
rather than a 403, so other couples' weddings aren't discoverable. Sharing checks
two sections, not one — writing into a thread needs VENDORS, and the thing being
shared needs VIEW on wherever it came from, so family cannot forward a payment
schedule they were never allowed to see.

**A role change rewrites the permission overrides.** Per-section access is stored
rows, so demoting a planner to family would otherwise leave their planner-era EDIT
on vendors in place. `permissionsAfterUpdate()` in `src/lib/permissions.ts` resets
to the new role's defaults unless the caller supplies permissions explicitly.

**Vendors read a thread, never a shortlist row.** `VendorThread` is a separate
model from `WeddingVendor` for one reason: the couple's private notes and status
live on the shortlist row, and the vendor-facing loader cannot reach them from a
thread even by accident. `loadThreadByToken()` in `src/lib/services/vendors.ts`
lists every field a vendor receives.

**No amount ever goes to a vendor.** Enforced twice over — the loader selects a
narrow set of columns that excludes every amount, and the mappers in
`src/lib/domain/sharing.ts` rebuild the payload field by field.
`tests/sharing.test.ts` walks the serialised result and fails on any key that
looks like money, which is what stops a later "just add the total".

**Tokens are stored hashed.** Session and invite tokens exist in plaintext only
in a cookie or an invite link; the database holds SHA-256 hashes keyed with
`AUTH_SECRET`. Accepting an invite burns the token.

**`server.ts` must not import `next/headers`.** It runs outside Next's
bootstrap, and pulling in Next's request internals there fails at load. Shared
constants live in `src/lib/auth/constants.ts` for that reason.

**Uploads are validated by their bytes, not their name.** `inspectImage()` reads
the magic bytes to decide the format and pulls dimensions from the header;
`inspectFile()` adds PDFs for message attachments. The browser's declared MIME
type and filename are discarded, and the storage key is generated server-side.
Files are served through `/api/files/[uploadId]`, which re-checks workspace
permissions or a share token on every request — they are never static assets, and
a file reached with a vendor's thread token is served `private` so shared caches
cannot outlive a revoke.

## File storage

`STORAGE_DRIVER=local` writes to `UPLOAD_DIR` (default `.uploads/`, gitignored)
and is the only driver implemented. To run on S3, R2 or MinIO, implement the
three-method `StorageDriver` interface in `src/lib/storage/index.ts` —
`put`/`get`/`delete` over opaque keys — and register it in `getStorage()`.
Nothing above that interface needs to change. Local disk assumes a single
server with a persistent volume, so swap the driver before scaling out.

Mood board and website images are capped at 10MB and must be JPEG, PNG, WebP or
GIF. Message attachments go to 15MB and also accept PDFs, up to five per message.

## Known gaps

- **S3-compatible storage is not implemented** — only the local-disk driver
  ships, behind the interface described above.
- Invite links and share links are shown in the UI to copy manually — no email
  provider is wired up yet. This bites hardest on vendor links, which currently
  have to be pasted into an email by hand.
- **Anonymous vendor replies are not rate limited.** Anyone holding a thread link
  can post as often as they like. The link is revocable, which is the mitigation,
  but a real deployment wants a limiter in front of
  `/api/vendor-threads/[token]/messages`.
- The vendor directory has no moderation queue. Only whoever created a listing can
  edit it, and reviews require the vendor to be on your shortlist, but nothing
  stops a duplicate listing for the same business.
- Vendors have no realtime connection, so their page updates when they send
  something or reload — the couple's side is live, theirs is not.
- Video calls from a thread (a stretch goal in the brief) are not built.
- The default task catalog lives in code (`src/lib/domain/timeline.ts`), not in
  the database, so couples can't edit the templates themselves.
- Changing the wedding date does not reschedule existing tasks; use "Refresh
  timeline" on the checklist to add anything newly missing.
- Guests cannot RSVP from the public wedding site yet; it shows the deadline and
  how to reply, and the couple records replies in the workspace.
- Event times on the public site are rendered in UTC rather than the wedding's
  timezone.
- Uploaded images are stored at their original size — no thumbnailing yet.
