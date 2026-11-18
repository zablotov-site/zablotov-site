# Chevras Zablotov website

Live at https://zablotov.pages.dev - static site on Cloudflare Pages plus Pages Functions:

- `functions/api/content.js` - public JSON of admin-managed content (KV `FILES`, key `site:content`); `site.js` renders it into the home, meldungen, shiurim, info and zmanim pages (static HTML is the fallback)
- `/admin` + `functions/api/admin/*` - password-gated admin (meldungen, shiurim, info, home text, zmanim note, uploads, password change). Credentials are a salted PBKDF2 hash in KV (`admin:cred`) and sessions are HMAC-signed httpOnly cookies (secret in KV `admin:secret`); nothing secret is in the repo. Write endpoints require the cookie plus an `x-zb-admin` header.
- `functions/f/u/[name].js` - streams new admin uploads from R2 (`MEDIA`) and serves legacy uploads from KV without changing their URLs. GET, HEAD, single byte ranges, ETags and download attachments are supported.
- `functions/f/s/[name].js` - proxies the 80MB sefer `mwl6e4ovcdez5hu6bg.pdf` from GitHub Releases (over the Pages 25MB asset limit); all other `/f/s/*` files fall through to static assets

The 80MB sefer is a GitHub Release v1 asset, not in git (see .gitignore). Deploy: `wrangler pages deploy . --project-name zablotov` (bindings in `wrangler.toml`).

Bookmarks: the lernen viewer saves "צייכן וואו איך האלט" per sefer in localStorage (`zbbm:<file>`); the sefarim page adds a "גיי ווייטער וואו איך האב אויפגעהערט" button for bookmarked seforim. The viewer also auto-resumes the last read page (`lern:<file>`) and accepts `?p=<page>`. pdf.js is vendored in /vendor (no CDN dependency, works on filtered networks).

- `functions/api/push.js` + `functions/api/_push.js` - Web Push (VAPID + RFC 8291 aes128gcm): key endpoint, subscription storage in D1, sends a push on every new chat message (from `api/chat.js`). VAPID keypair and subscriptions live in the D1 `state` table.
- `sw.js` + `push.js` - service worker (offline shell cache, push display) and the More-page subscribe button.
- `/chaverim` - member list from `api/chat?chaverim=1` (people records in D1, `since` = first seen).
- `404.html` - Pages not-found page (also stops missing paths returning the homepage with 200).


## Large media

Admin uploads use authenticated R2 multipart upload requests in 10MiB pieces. Each file can be up to 5GiB (shown as 5GB in the editor), with progress and up to two retries per failed piece. The browser never reads the whole file into memory; the server streams each part into R2. Upload claims are HMAC-signed, expire after 24 hours, and every create/part/complete/abort request still requires the admin cookie plus custom header. Supported media types are explicitly allowed. New R2 objects use Standard storage. There is no site-imposed download count or bandwidth cap. Cloudflare plan limits and usage billing still apply.

Before deploying this version: activate R2 only with the owner's billing approval, create `zablotov-media`, and bind it as `MEDIA` (configured in wrangler.toml). The bucket is private; public reads flow through `/f/u/`. Existing KV content and media are kept in place. Failed uploads are aborted by the client when possible; R2 automatically aborts unfinished multipart uploads after seven days. Completed uploads remain in storage even if their shiur entry is later removed, as in the previous uploader. The existing content editor keeps its 300-shiur index limit, separate from media storage.

Run `node --test tests/media.test.mjs` for multipart, auth, forged claims, range, conditional read, HEAD, legacy URL and size/type validation tests. Build Functions with `wrangler pages functions build functions` before deploy.
