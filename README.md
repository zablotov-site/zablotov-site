# Chevras Zablotov website

Live at https://zablotov.pages.dev - static site on Cloudflare Pages plus Pages Functions:

- `functions/api/content.js` - public JSON of admin-managed content (KV `FILES`, key `site:content`); `site.js` renders it into the home, meldungen, shiurim, info and zmanim pages (static HTML is the fallback)
- `/admin` + `functions/api/admin/*` - password-gated admin (meldungen, shiurim, info, home text, zmanim note, uploads, password change). Credentials are a salted PBKDF2 hash in KV (`admin:cred`) and sessions are HMAC-signed httpOnly cookies (secret in KV `admin:secret`); nothing secret is in the repo. Write endpoints require the cookie plus an `x-zb-admin` header.
- `functions/f/u/[name].js` - serves chat uploads from KV
- `functions/f/s/[name].js` - proxies the 80MB sefer `mwl6e4ovcdez5hu6bg.pdf` from GitHub Releases (over the Pages 25MB asset limit); all other `/f/s/*` files fall through to static assets

The 80MB sefer is a GitHub Release v1 asset, not in git (see .gitignore). Deploy: `wrangler pages deploy . --project-name zablotov` (bindings in `wrangler.toml`).

Bookmarks: the lernen viewer saves "צייכן וואו איך האלט" per sefer in localStorage (`zbbm:<file>`); the sefarim page adds a "גיי ווייטער וואו איך האב אויפגעהערט" button for bookmarked seforim. The viewer also auto-resumes the last read page (`lern:<file>`) and accepts `?p=<page>`. pdf.js is vendored in /vendor (no CDN dependency, works on filtered networks).

- `functions/api/push.js` + `functions/api/_push.js` - Web Push (VAPID + RFC 8291 aes128gcm): key endpoint, subscription storage in D1, sends a push on every new chat message (from `api/chat.js`). VAPID keypair and subscriptions live in the D1 `state` table.
- `sw.js` + `push.js` - service worker (offline shell cache, push display) and the More-page subscribe button.
- `/chaverim` - member list from `api/chat?chaverim=1` (people records in D1, `since` = first seen).
- `404.html` - Pages not-found page (also stops missing paths returning the homepage with 200).

## Shiurim feed and reactions

`/shiurim` uses `shorts.js` and `shorts.css`: full-length video/audio cards with vertical scroll snap, filters, native media controls, sharing, downloads, likes with display-name lists, and comments. Scrolling away pauses playback; playback starts only on the visitor's gesture. Landscape video is contained rather than cropped. Deep links use each stable shiur ID in the fragment.

Pages Functions `/api/social` persist reactions in the existing D1 database `zbchat`, binding `SOCIAL`. The prefixed `social_*` tables are created by `migrations/0001_social.sql`; no existing tables are dropped or changed. A signed httpOnly/Secure/SameSite device cookie links the name-once profile. Its application signing key is KV `social:secret`, separate from admin sessions so changing the admin password does not sign viewers out. Names are self-entered, public and not verified identities. They do not confer admin access. A new browser or deleting cookies can create a new identity, so bans are per device, not a guarantee against a determined person. Likes are unique per shiur/device and idempotent. Lists and comments paginate; profile names and comment bodies render as plain text. The site does not invent social counts.

Writes require a custom same-origin header and validated profile/content; names max 40 characters, comments max 1000. D1 atomic counters apply IP, profile-creation and device/comment rate limits. Admin moderation is under the existing authenticated admin's new reactions tab; delete individual comments, ban devices (hiding their comments and likes), or unban them. API responses are no-store. Worker/D1 free quotas still apply and errors do not trigger a paid upgrade. Back up D1 before future schema changes. Existing KV content, credentials, uploaded media and `/f/u/` URLs are unchanged. R2 is not needed for this feed.
