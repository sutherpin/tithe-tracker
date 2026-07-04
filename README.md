# Cash Account Tracker

A simple deposit/withdrawal tracker. Frontend is a static page on GitHub Pages;
data lives in a Cloudflare D1 database behind a Cloudflare Worker API, so it's
the same data on every device.

## Repo layout

```
index.html          <- the app (host this on GitHub Pages)
worker/
  src/index.js       <- Cloudflare Worker API
  wrangler.toml       <- Worker + D1 config
  schema.sql          <- database schema
```

## One-time setup

### 1. Deploy the Worker + D1 database

You'll need Node.js and the Cloudflare CLI (`wrangler`). From the `worker/` folder:

```bash
npm install -g wrangler
wrangler login

# Create the D1 database
wrangler d1 create tithetracker-db
```

This prints a `database_id`. Copy it into `wrangler.toml` (replace
`REPLACE_WITH_YOUR_DATABASE_ID`).

Also edit `wrangler.toml` and set `ALLOWED_ORIGIN` to your actual GitHub Pages
URL, e.g. `https://sutherpin.github.io` (no trailing slash, no path — GitHub
Pages project sites still use the root origin for CORS).

Apply the schema:

```bash
wrangler d1 execute tithetracker-db --remote --file=./schema.sql
```

Set your access password as a Worker secret (pick your own value, this is
what you'll type into the app once per device):

```bash
wrangler secret put APP_SECRET
```

Deploy:

```bash
wrangler deploy
```

This prints your Worker's URL, something like:
`https://tithetracker-api.<your-subdomain>.workers.dev`

### 2. Point the frontend at your Worker

In `index.html`, find this line near the top of the `<script>` block:

```js
const API_BASE = 'https://tithetracker-api.YOUR_SUBDOMAIN.workers.dev';
```

Replace it with the actual Worker URL from the previous step.

### 3. Host the frontend on GitHub Pages

Push `index.html` to a GitHub repo, then in the repo's Settings → Pages,
enable Pages for that branch. Your app will be live at
`https://<username>.github.io/<repo>/`.

### 4. First load

Open the page on any device — it'll prompt once for the access password
(the `APP_SECRET` you set above) and remember it in that browser going
forward. Every add/undo/clear/import now writes straight to the shared D1
database, so all your devices stay in sync.

## Notes

- CSV export/import buttons are kept as a manual backup/audit trail — they
  no longer are the storage mechanism, just a convenience.
- If you ever need to change the password, run `wrangler secret put APP_SECRET`
  again with a new value, then clear the old one from each device's
  browser storage (or just let the 401 prompt catch it — the app clears
  the stale password automatically and re-prompts).
- Because `ALLOWED_ORIGIN` is locked to your GitHub Pages origin, the API
  can't be called from a random other website even if someone finds the
  Worker URL — but the real protection is the password.
