# Motorcycle Log

Formerly "Odo"; internal identifiers (storage keys, CSS classes, backup
filenames) still use the `odo` prefix so existing devices keep their data.

A single-purpose mileage and maintenance tracker for a 2025 Honda Rebel 500 ABS.
One static page, no framework, no build step for the page itself.

## What's here

| File | Purpose |
| --- | --- |
| `index.html` | The whole app (UI + logic), extended from the original mockup |
| `manifest.webmanifest`, `sw.js`, `icons/` | PWA: installable; the service worker only speeds up shell loads |
| `netlify/functions/state.mjs` | Cloud sync endpoint (`/api/state`) backed by Netlify Blobs |
| `netlify/functions/auth.mjs` | Google sign-in (`/api/auth/google`) and logout endpoints |
| `netlify/lib/session.mjs` | Signed session cookie helpers shared by both functions |
| `package.json` | Declares the functions' one dependency (`@netlify/blobs`) |
| `netlify.toml`, `_headers` | Static deploy config + caching |

## How it works

**Sign-in first.** The app starts gated: nothing but a Sign in with Google
button shows until an allowlisted account (`ALLOWED_EMAILS` env var) signs in
and the first sync succeeds. After sign-in the server sets a signed httpOnly
session cookie good for 30 days; every sync renews it (rolling expiry), so a
device in regular use stays signed in indefinitely and an idle one asks again
only after a month away.

**One live cloud log.** Every signed-in device shares the same log, keyed to
the Google account in Netlify Blobs. The app syncs after each edit, on focus,
on reconnect, and every 30 seconds while open, so a change on one device
appears on the others without interaction. Merge is last-writer-wins per
record (by `updatedAt`); deletions propagate as tombstones. `localStorage` is
only a write buffer between syncs and is cleared on sign-out. There is no
offline mode; this is an after-the-ride logger. The seed history/schedule is
applied once, on the account's very first sync.

## Deploy (Netlify)

1. Connect the repo to a Netlify site (or `netlify deploy`).
2. No build command needed; publish directory is the repo root.
3. Netlify Blobs is enabled automatically; no extra config for sync.
4. Set environment variables (Site configuration → Environment variables):
   - `SESSION_SECRET` (required): random string that signs session cookies;
     generate with `openssl rand -hex 32`. Rotating it signs everyone out.
   - `ALLOWED_EMAILS` (optional): comma-separated Google accounts allowed to
     sync. Defaults to the owner's address hardcoded in `auth.mjs`.
5. The Google OAuth client ID lives in `index.html` and `auth.mjs` (it is
   public by design). Its Cloud Console entry must list the site's origins
   under Authorized JavaScript origins.

## Status / next steps

Cloud sync is keyed to a Google account (added 2026-06, replacing the original
passphrase model). Sign-in uses Google Identity Services in the page; the
`auth` function verifies the ID token and issues its own 30-day rolling
session cookie, so logins are rare. The sync layer remains isolated (two
functions + the cloud-sync block in `index.html`).

## Out of scope

GPS, Bluetooth, ride titles, weather, fuel tracking, multi-bike support,
offline use, anonymous/demo access, JSON export/import.
