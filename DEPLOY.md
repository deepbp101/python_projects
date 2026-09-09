# Deploying the backend

One server hosts everything: the web app, the API the phone app talks to, and
the Socket.IO connection both use. Three things need to exist first — a
database, a bucket, and somewhere to run the container.

> **Vercel and Netlify will not work.** Next and Socket.IO share one HTTP
> server (`server.ts`) because serverless functions cannot hold a WebSocket
> open. That is a deliberate choice made in the first commit, not an oversight.

---

## 1. Database — Neon

Free tier: 0.5 GB, no expiry, no forced pause. It scales to zero when idle, so
the first request after a quiet spell takes roughly half a second; every other
free Postgres either deletes the database (Render, after 30 days) or suspends it
until you click something (Supabase, after 7 days idle). For a wedding that
nobody touches for a fortnight and then needs at a venue, "sleeps" beats "gone".

1. Sign up at **neon.tech**, create a project.
2. Copy the **pooled** connection string. It has `-pooler` in the host and is
   the right one for a serverless-ish database — the direct string opens a new
   Postgres connection per request and exhausts the limit under any real load.
3. That whole string is `DATABASE_URL`. Keep `?sslmode=require` on it.

Migrations run automatically on container start (`docker-entrypoint.sh`), so
there is nothing to run by hand.

**0.5 GB is enormous here.** A wedding is a few hundred rows. What actually
grows is uploads, and those go to the bucket, not the database.

---

## 2. Files — Cloudflare R2

Free tier: 10 GB stored, and **no charge for egress**. That last part is why R2
and not S3: this app's whole job on the read side is serving photos back, and S3
bills for every view. A hundred guests posting photos is a few GB and thousands
of views.

1. Cloudflare dashboard → **R2** → create a bucket, e.g. `wedding-uploads`.
2. **Leave it private.** Do not enable public access. The app fetches objects
   server-side and serves them through an access-checked route — that is what
   makes hiding a guest's photo actually hide it. A public bucket hands out
   permanent URLs that no moderation decision can withdraw.
3. → **Manage R2 API Tokens** → create a token with **Object Read & Write**,
   scoped to that one bucket.
4. The token page gives you an access key ID, a secret, and an endpoint that
   looks like `https://<account-id>.r2.cloudflarestorage.com`.

```
STORAGE_DRIVER="s3"
S3_BUCKET="wedding-uploads"
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
S3_REGION="auto"
```

`S3_REGION` is ignored by R2 but the AWS SDK insists on one; `auto` is what
Cloudflare's own examples use.

---

## 3. Hosting — Fly.io

`fly.toml` and `Dockerfile` are in the repo and ready.

```bash
brew install flyctl        # or: curl -L https://fly.io/install.sh | sh
fly auth login
fly launch --no-deploy     # reads fly.toml; pick a name and region

fly secrets set \
  DATABASE_URL="postgresql://…-pooler…?sslmode=require" \
  AUTH_SECRET="$(openssl rand -hex 32)" \
  APP_URL="https://your-app.fly.dev" \
  S3_BUCKET="wedding-uploads" \
  S3_ACCESS_KEY_ID="…" \
  S3_SECRET_ACCESS_KEY="…" \
  S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com" \
  S3_REGION="auto"

fly deploy
```

Fly's free allowance covers one `shared-cpu-1x` machine, which is what
`fly.toml` asks for.

### Two settings in `fly.toml` that are deliberate

**`auto_stop_machines = false`.** Fly's default stops a machine when HTTP goes
quiet. Socket.IO holds a live connection per collaborator, and stopping the
machine drops all of them — the couple would watch presence vanish while the
page sat open in front of them.

**One machine only.** Socket.IO rooms live in the process's memory, so two
machines means two collaborators can be in the "same" room and never see each
other's edits. Scaling past one needs the Redis adapter wired in first. One
machine is comfortably enough for a wedding.

### Railway instead

Railway reads the `Dockerfile` with no extra config, and its $5/month credit
covers a small always-on service. Set the same variables in the dashboard. It
is the easier path if `flyctl` gives you trouble.

---

## 4. After the first deploy

```bash
curl https://your-app.fly.dev/api/health     # {"status":"ok"}
```

That endpoint runs `SELECT 1`, so a 503 means the app is up but cannot reach
Postgres — almost always a wrong or unquoted `DATABASE_URL`.

Then, in order:

1. **Sign up** on the deployed site and create a real wedding. Do not run
   `db:seed` against production; it exists to make a demo, and it writes a
   fictional couple with working invite links.
2. **Set `APP_URL` to the real https address** if you have not. Invite links,
   itinerary links and the QR codes printed for the tables are all built from
   it. Getting this wrong prints codes that go nowhere, and you find out at the
   reception.
3. **Point the phone app at it** — `EXPO_PUBLIC_API_URL` in `mobile/eas.json`,
   then rebuild. The URLs there are placeholders.

## What is not set up

- **Backups.** Neon keeps a 24-hour restore window on the free tier. If this
  ever holds a real wedding, that is worth more than the hosting.
- **A custom domain.** `fly certs add yourdomain.com`, then update `APP_URL`.
- **Horizontal scaling.** See the one-machine note above.
