# Cloudflare Pages (Git) — Eseller frontends

Angular CLI rejects Cloudflare’s default Node patch versions. Use the `:cf` build scripts  
**or** pin `NODE_VERSION=24` and use `npx ng build …` (GitHub Actions workflows do this).

`eseller-shared` is a library — it is **not** deployed alone; it ships inside each app build.

## Create a Pages project (repeat ×3)

Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → `EsellerFrontend`  
Production branch: `main` · Framework preset: **None** · Env var: `NODE_VERSION` = `24`

| Project name | Build command | Output directory | Custom domain |
|--------------|---------------|------------------|---------------|
| `eseller-customer` | `npm ci && npm run build:customer:cf && printf '/*    /index.html   200\n' > dist/eseller-customer/browser/_redirects` | `dist/eseller-customer/browser` | `www.esellerglobal.com` |
| `eseller-admin` | `npm ci && npm run build:admin:cf && printf '/*    /index.html   200\n' > dist/eseller-admin/browser/_redirects` | `dist/eseller-admin/browser` | `admin.esellerglobal.com` |
| `eseller-seller` | `npm ci && npm run build:seller:cf && printf '/*    /index.html   200\n' > dist/eseller-seller/browser/_redirects` | `dist/eseller-seller/browser` | `seller.esellerglobal.com` |
| `eseller-affiliate` | `npm ci && npm run build:affiliate:cf && printf '/*    /index.html   200\n' > dist/eseller-affiliate/browser/_redirects` | `dist/eseller-affiliate/browser` | `affiliate.esellerglobal.com` |

### Namecheap DNS (CNAME → Pages)

| Host | Type | Value |
|------|------|--------|
| `www` | CNAME | `eseller-customer.pages.dev` |
| `admin` | CNAME | `eseller-admin.pages.dev` |
| `seller` | CNAME | `eseller-seller.pages.dev` |
| `affiliate` | CNAME | `eseller-affiliate.pages.dev` |

(`api` stays an **A** record to MonsterASP — do not point it at Pages.)

## GitHub Actions (optional)

Workflows under `.github/workflows/deploy-*-pages.yml` need repo secrets:

- `CLOUDFLARE_API_TOKEN` — Pages:Edit
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare Account ID

Then push to `main` or run **workflow_dispatch**.
