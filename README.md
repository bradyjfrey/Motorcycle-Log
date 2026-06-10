# Odo — Ride & Service Log

A single-purpose mileage and maintenance tracker for a 2025 Honda Rebel 500 ABS.
One static page, no framework, no build step for the page itself.

## What's here

| File | Purpose |
| --- | --- |
| `index.html` | The whole app (UI + logic), extended from the original mockup |
| `manifest.webmanifest`, `sw.js`, `icons/` | PWA: installable, offline-capable shell |
| `netlify/functions/state.mjs` | Cloud sync endpoint (`/api/state`) backed by Netlify Blobs |
| `package.json` | Declares the function's one dependency (`@netlify/blobs`) |
| `netlify.toml`, `_headers` | Static deploy config + caching |

## How it works

**Local-first.** Each device keeps the full state in `localStorage`
(`odo-state-v1`). The app works fully offline; every edit saves locally first.

**Optional cloud sync.** Open Settings (⚙) → enter a private passphrase →
Connect. Enter the *same* passphrase on another device and they share one log.
Sync is last-writer-wins per record (by `updatedAt`); deletions propagate as
tombstones, so two devices converge without losing concurrent rides. Seed
records use deterministic ids so a fresh device's defaults merge cleanly
instead of doubling history.

**Backup.** Settings → Export downloads `odo-backup-<date>.json`; Import
replaces local state from a file. This is the safeguard against a browser
evicting `localStorage`.

## Deploy (Netlify)

1. Connect the repo to a Netlify site (or `netlify deploy`).
2. No build command needed; publish directory is the repo root.
3. Netlify Blobs is enabled automatically — no extra config for sync.

## Status / next steps

This is a working baseline. **Planned next: replace the passphrase sync with
Google authentication** (custom domain → `.com`), so the shared log is keyed to
a Google account instead of a shared phrase. The sync layer is intentionally
isolated (one function + the `syncNow()`/`mergeStates()` block in `index.html`),
so swapping the auth/identity model touches little else.

## Out of scope

GPS, Bluetooth, ride titles, weather, fuel tracking, multi-bike support.
