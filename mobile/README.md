# Wedding Planner — native app

An Expo (SDK 57) app for iOS and Android that talks to the same backend as the
web app in the parent directory. There is no second server and no second
database: the 65 API routes under `src/app/api/` are the whole backend for both.

## What is shared, and how

`src/lib/domain/` in the web app is pure TypeScript — no Prisma, no Next.js, no
Node built-ins. That was a rule from the first commit, and this app is the
payoff: Metro is pointed at `../src` (see `metro.config.js`), so timeline
generation, budget rollups, money formatting and the realtime event contract are
**imported, not reimplemented**. One definition of "how many days until the
wedding", compiled into three places.

Verified on every build: the production bundle contains the shared milestone
labels and the `workspace:changed` event name, and contains no `PrismaClient`,
`AUTH_SECRET`, `next/headers` or `bcrypt`.

Shared imports use the same `@/…` alias as the web app, so the shared files need
no edits to be bundled for a phone. App-local imports use `~/…`.

## Auth

The web app keeps its session in an httpOnly cookie. A phone has no cookie jar
shared with `fetch`, so the same token is delivered as
`Authorization: Bearer <token>` instead — the token was always an opaque random
string checked against a SHA-256 hash, which is what a bearer token is.

- Sign-in posts `client: "native"`, which returns the token in the body and sets
  no cookie.
- The token is stored in the device keychain (`expo-secure-store`), never in
  AsyncStorage, which is an unencrypted file that ends up in backups.
- Socket.IO gets the same token in its handshake `auth` object.

Permissions are unchanged and unbypassed: a native request walks the identical
`requireWorkspace` chain, so a planner with view-only budget access gets exactly
the same 403 here as in a browser.

## Offline

Every GET is read-through cached in AsyncStorage. On a bad connection the screen
shows the last data it had, with a banner naming how old it is, rather than a
spinner over nothing. Writes are never queued — a task ticked offline that fails
to send an hour later is worse than one that refuses now.

## Running it

The phone and the computer running the API must be on the same network.

```bash
# 1. start the backend, in the parent directory
cd .. && npm run dev

# 2. point the app at that machine's LAN address, not localhost —
#    "localhost" on a phone means the phone
ipconfig getifaddr en0     # macOS
hostname -I                # Linux, first address
```

Put that address in `app.json` under `expo.extra.apiUrl`, then:

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go. Sign in with any account from the web app's seed
(`sam@example.com` / `wedding-demo-2026`).

### Previewing in a browser

`npx expo start --web` renders the same components through react-native-web,
which is a fast way to iterate without a device. Two things behave differently
there, and neither affects a real phone:

- **CORS.** A browser blocks `localhost:8081 → localhost:3000`; React Native's
  `fetch` does not enforce CORS at all. The backend is deliberately left alone —
  launch the browser with `--disable-web-security` instead of widening the API.
- **The keychain.** `expo-secure-store` has no web implementation, so the token
  falls back to `localStorage` on web only. Fine for a preview, and never used
  on a device.

## What is here so far

Sign-in and sign-up, the wedding picker, and three tabs: dashboard with the live
countdown, checklist with optimistic ticking, and budget with collapsible
categories and upcoming payments. The other eight workspace screens are still
web-only.

## Notes

- `babel.config.js` is `babel-preset-expo` alone. It handles worklets and
  reanimated itself in SDK 57, and `expo-router/babel` has been deprecated since
  SDK 50 — adding either by hand breaks the build.
- `babel-preset-expo` is a direct devDependency because Babel resolves presets
  from the project root, and npm leaves Expo's own copy nested.
