# Chevras Zablotov website

Live at https://zablotov.pages.dev - static site on Cloudflare Pages plus Pages Functions:

- `functions/api/chat.js` - chat backend (D1 `zbchat` for state, KV `FILES` for uploads)
- `functions/f/u/[name].js` - serves chat uploads from KV
- `functions/f/s/[name].js` - proxies the 80MB sefer `mwl6e4ovcdez5hu6bg.pdf` from GitHub Releases (over the Pages 25MB asset limit); all other `/f/s/*` files fall through to static assets

The 80MB sefer is a GitHub Release v1 asset, not in git (see .gitignore). Deploy: `wrangler pages deploy . --project-name zablotov` (bindings in `wrangler.toml`).

Bookmarks: the lernen viewer saves "צייכן וואו איך האלט" per sefer in localStorage (`zbbm:<file>`); the sefarim page adds a "גיי ווייטער וואו איך האב אויפגעהערט" button for bookmarked seforim. The viewer also auto-resumes the last read page (`lern:<file>`) and accepts `?p=<page>`.
