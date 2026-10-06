# Cloudflare Pages (Git) — Eseller frontends

Angular CLI rejects Cloudflare’s default Node patch versions. Use the `:cf` build scripts.

## Customer (`eseller-customer`)

| Setting | Value |
|--------|--------|
| Production branch | `main` |
| Framework preset | None |
| Build command | `npm ci && npm run build:customer:cf && printf '/*    /index.html   200\n' > dist/eseller-customer/browser/_redirects` |
| Build output directory | `dist/eseller-customer/browser` |
| Env `NODE_VERSION` | `24` |

## Admin / Seller / Affiliate

Same pattern, swap names:

- `npm run build:admin:cf` → `dist/eseller-admin/browser`
- `npm run build:seller:cf` → `dist/eseller-seller/browser`
- `npm run build:affiliate:cf` → `dist/eseller-affiliate/browser`
