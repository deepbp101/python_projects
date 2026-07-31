# Wedding Planner

A shared workspace for planning a wedding: an auto-generated checklist, a
budget that tracks deposits and final payments, a guest list with RSVPs and
meal choices, and a countdown — all updating live for everyone helping.

**All four phases from the original brief are complete** — core planning tools,
the guest-facing wedding website, seating chart and mood board, vendor
coordination with per-vendor message threads, and the day-of features: a shared
photo gallery, a virtual guest book, personal guest itineraries, 360° venue
tours, and two assistants running on Claude Haiku 4.5.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL 16 via Prisma 7 (`@prisma/adapter-pg`) |
| Auth | Database-backed sessions in an HTTP-only cookie, bcrypt passwords |
| Realtime | Socket.IO on a custom Node server (`server.ts`) |
| AI | `claude-haiku-4-5` via `@anthropic-ai/sdk`, optional |
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

`ANTHROPIC_API_KEY` is optional. Without it the writing assistant reports itself
off rather than failing, and the style matchmaker still works — see **The
assistants** below.

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
state is reachable without editing rows by hand. It also prints working links to
everything guests and vendors see with no account at all: the public site, the
photo gallery, the guest book, a florist's message thread, and one guest's
personal itinerary. A photo and a guest book entry are left unapproved, so the
moderation queue is not empty on first look.

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
| `npm run plan:mint-code` | Mint one-time Pro unlock codes |

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

### Phase 4 — the day itself

**Shared photo gallery** — guests post photos from their phones with no account at
all, through a QR code printed for the tables. The code is generated server-side
as SVG so it stays sharp at any print size, and scanning it opens straight onto
the upload form rather than a browse view: someone scanning mid-reception wants to
post the photo they just took.

**Virtual guest book** — written notes, voice messages and short videos. The file
pickers carry `capture` hints so a phone offers its recorder directly.

**Moderation is on by default.** Anyone with the site link can post, so nothing
appears until the couple approves it. Approving and hiding are independent flags,
not one status: un-hiding never silently re-approves, a pulled item stays pulled
even if moderation is later switched off, and switching moderation off publishes
the waiting queue — which is what "I trust this crowd after all" should mean.

**Personal guest itineraries** — each guest gets their own link showing only their
day: their events, their table, their meal, their dietary note. A guest who
declined, or has not replied, gets the date and a nudge instead of a schedule —
sending arrival times and a table number to someone who said no is worse than
sending nothing.

**Guests reply from the site.** A guest who has their personal link replies there
— attending, maybe or declining, with a meal, a dietary note, a message and an
answer for a plus-one they are hosting. Replies can be changed; a form that works
once is just a phone call to the couple later. A guest who has lost the link finds
themselves by name on the public site and is handed one.

The name lookup is the weak link and is treated as one. A name is not a secret, so
it is rate limited, it never lists names, and an ambiguous match returns nothing
rather than guessing — you must already know the name to match it, and two guests
with the same name reveal neither. The reply itself always happens against the
token, never against a typed name, so nobody replies for someone else by guessing.
Couples who want none of this can send the personal links directly.

**Virtual venue tours** — 360° panoramas on a vendor's listing, in a drag-to-pan
viewer, plus embedded links to externally hosted walkthroughs. The viewer pans a
repeating strip rather than projecting a sphere: no WebGL, no library, works on
anything that can show a background image. The trade-off is honest — vertical look
and true perspective are missing, so a panorama reads a little flatter than in a
dedicated viewer.

### The assistants

Both run on **`claude-haiku-4-5`** — the cheapest and fastest current model, which
is the right tier for short, well-specified generation. Nothing here needs deep
reasoning, and a couple iterating on a toast cares more about latency than ceiling.

**Writing assistant** — vows, speeches, thank-you notes and invitation wording.
Grounded in a short, reviewable list of facts (names, date, venue, style) and
instructed not to invent beyond it: it leaves `[brackets]` where it needs a detail
rather than making one up. Drafts are saved with the brief that produced them and
the model that wrote them, since a draft from last year was not written by whatever
is current now.

Limited to the couple. Vows and speeches are the most personal writing in the app,
and a planner or a relative having them on tap is not a default anyone would pick.

**Style matchmaker** — a six-question quiz scored into themes, palettes, decor
notes and which vendor categories to book first. **The scoring is deterministic and
model-free** (`src/lib/domain/style.ts`): the model writes only the summary
paragraph. So the recommendations are reproducible, testable, and identical with or
without an API key — the summary is simply absent when there is no key. The mood
board feeds in as a weak signal, weighted well below a quiz answer.

**With no `ANTHROPIC_API_KEY` set**, the writing assistant says so in a sentence
and returns 503 rather than 500 — "the assistant is off" is a configuration state,
not a crash. Every failure a couple can actually hit (no key, rejected key, rate
limited, network down) becomes an explanation.

## Plans and limits

`FREE` and `PRO` live in `src/lib/domain/plans.ts` — one table, no per-wedding
override rows to drift. The only thing stored on a wedding is the plan name;
every number is derived from it, so changing an allowance takes effect
immediately for everyone on that plan. The same table drives enforcement and the
settings panel, because a UI that offers what the server then refuses is worse
than no UI.

Free is a real product: a couple can plan a small wedding on it. What it caps is
the expensive surface — model tokens, guest uploads, and the vendor and tour
features that cost storage and support.

|                        | Free   | Pro       |
| ---------------------- | ------ | --------- |
| Guests                 | 40     | unlimited |
| Helpers                | 2      | unlimited |
| Vendors                | 5      | unlimited |
| Mood board items       | 20     | unlimited |
| Gallery photos         | 50     | unlimited |
| Guest book entries     | 25     | unlimited |
| Tables                 | 8      | unlimited |
| Saved AI drafts        | 5      | unlimited |
| Assistant tokens/month | 30,000 | 500,000   |
| Output tokens/request  | 1,024  | 4,096     |
| Guest posts/day        | 100    | 2,000     |

Vendor messaging, venue tours, recorded guest book entries and editable timeline
templates are Pro only.

### Pro is a one-time unlock

A wedding is a project with an end date, not an ongoing service, so Pro is bought
once for one wedding and never expires — no renewal, no cancellation, nothing to
forget to turn off. The only thing that still resets monthly is the model
allowance, and that is a cost ceiling rather than a billing period.

There is no payment provider wired up. What exists instead is the thing a payment
provider would eventually drive: a redeemable code.

```
npm run plan:mint-code -- --count 3 --label "launch batch"
```

The code is printed once — only its hash is stored, so a lost code is reissued,
never recovered — and the couple redeem it in Settings. When a provider is added,
its webhook mints and redeems a code and nothing else in the app changes. That is
the point of making the unlock **an event rather than a flag**: `UnlockCode` records
which wedding spent which code and when, and `Wedding.planUnlockedAt` is a date
the couple can be shown.

Redemption is one-way and one-to-one, enforced by the database rather than by
checking first: the claiming update is conditional on `redeemedAt` still being
null, and `weddingId` is unique on the table. Two people redeeming the same code
at the same moment cannot both win, and a wedding cannot stack two. There is no
un-redeem — refunds are a conversation, not a button that silently strips a
couple's paid features.

Codes read `WED-XXXX-XXXX-XXXX-XXXX` over an alphabet with `I`, `O`, `0` and `1`
removed. That costs about a bit and a half of entropy out of ~99 and removes the
whole class of "it says it's wrong but I typed it right". Case, spacing, dashes
and the prefix are all normalised server-side, so however someone types what they
were sent, it works.

**Limits answer 402, not 403.** The caller is who they say they are and is
allowed to do this in principle — the workspace just is not paying for it, and a
client should show an upgrade prompt rather than an access error.

**Capacity is checked for the whole batch.** Importing 30 guests into a 40-guest
plan with 20 already there is refused outright rather than applied halfway.

**Tokens are charged after the call, from what the API reported** — not from the
requested `max_tokens`, so a generation that stops early costs less and the meter
agrees with the bill. A failed request is free. The month's remainder also lowers
the request's own ceiling, so the last generation of the month comes back short
rather than not at all — but never shorter than a usable minimum.

### Rate limiting the anonymous surfaces

Guest photos, guest book entries, vendor replies and RSVPs all arrive with no
account behind them, so they go through `src/lib/rate-limit.ts`: fixed windows
counted in Postgres, not a bucket in memory. A restart must not hand an abuser a
fresh allowance, and this can legitimately run as more than one process, where
per-process counters would multiply the real limit by the process count.

Three windows, each stopping something different: a burst (5/min per address), a
sustained hourly rate (30/hr per address), and a per-wedding daily cap from the
plan — keyed by the wedding alone, so rotating addresses does not reset it. The
increment happens before the decision, so hammering a limited endpoint keeps it
limited rather than resetting it.

**Addresses are hashed with `AUTH_SECRET` before they are stored.** A guest
posting a photo has not agreed to us keeping their IP, and we do not need it —
only whether two requests came from the same place.

## Architecture notes

**Event times are instants; calendar days are not.** Dates like a task due date are
whole UTC days (`src/lib/dates.ts`). An event time is a moment, rendered in the
wedding's own timezone by `formatEventWindow` — shared by the public site and the
personal itineraries so there is one implementation. `timezone` is free text on the
wedding, so an unrecognised zone falls back to UTC rather than throwing: a typo in
a settings field must not take the public site down.

**Each upload endpoint accepts one family of file.** `inspectImage` for mood
boards, website covers and gallery photos; `inspectFile` (images plus PDF) for
message attachments; `inspectRecording` (audio and video) for guest book entries.
Three inspectors rather than one permissive check, so a video cannot be posted
where a photo belongs — `tests/media.test.ts` pins each lane.

**A guest's file is only readable while it is live.** Gallery photos and guest book
recordings are served through the same visibility rule as the pages
(`isPubliclyVisible`), so a pending or pulled submission is not readable by URL,
and closing the gallery pulls its files with it.

**The AI layer is optional by construction.** `src/lib/ai/client.ts` is the only
place that talks to Anthropic; it reports itself unconfigured rather than throwing,
and the style matchmaker's value does not depend on it. Prompts live apart from the
client in `src/lib/ai/prompts.ts` so the wording is reviewable on its own.

**Money is integer cents everywhere.** `src/lib/money.ts` handles parsing and
formatting. Floats never touch an amount.

**Dates are whole UTC days.** `src/lib/dates.ts` — wedding planning is
calendar-day arithmetic, and doing it in local time shifts tasks by a day
across a DST boundary.

**Domain logic is pure and separately tested.** `src/lib/domain/` holds timeline
generation, budget rollups, RSVP counts, seating maths, thread unread counts,
itinerary assembly, style scoring and the vendor redaction rules as functions over
plain objects with no database access — which is what the 221 tests in `tests/`
exercise. Anything a client component needs (category labels, template themes)
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

Mood board, website and gallery images are capped at 10MB and must be JPEG, PNG,
WebP or GIF. Message attachments go to 15MB and also accept PDFs, up to five per
message. Guest book recordings go to 50MB and accept WAV, MP3, M4A, Ogg, MP4, WebM
and QuickTime.

## Known gaps

- **S3-compatible storage is not implemented** — only the local-disk driver
  ships, behind the interface described above.
- Invite links and share links are shown in the UI to copy manually — no email
  provider is wired up yet. This bites hardest on vendor links, which currently
  have to be pasted into an email by hand.
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
- Uploaded images and videos are stored at their original size. No thumbnailing
  and no transcoding, so a long phone video is rejected on size rather than
  compressed.
- The guest book records through the file picker rather than in the page. Phones
  offer their recorder from `capture`, but a laptop user has to find a file.
- The panorama viewer pans rather than projects, so there is no vertical look and
  no true perspective (see Phase 4 above).
- **No payment provider.** Pro unlocks from a code, and codes are minted from the
  command line — so somebody has to run a script and send one. Checkout is the
  missing piece, not the unlock mechanism.
- **Minting codes has no authentication beyond shell access** to the server. That
  is the right trade for a CLI, but it means anyone who can run commands there can
  mint themselves Pro.
- Rate limiting uses fixed windows, which can allow up to twice the nominal rate
  across a window boundary. Fine for stopping a script, not a precise meter.
- Rate limit windows are pruned opportunistically by the endpoints that write
  them, since there is no job runner. A site nobody visits keeps two days of rows
  until someone does.
