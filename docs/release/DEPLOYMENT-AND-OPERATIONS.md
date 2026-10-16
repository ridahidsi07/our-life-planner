# Our Life Planner — Production Deployment & Operations Runbook

**Document Version:** 1.0.0  
**Effective Date:** 2026-10-16  
**Product:** Our Life Planner  
**Repository:** `https://github.com/ridahidsi07/our-life-planner`  
**Live Application URL:** `https://ridahidsi07.github.io/our-life-planner/`

---

## 1. Architecture Overview

Our Life Planner is delivered in two complementary operating architectures:

1. **Client-Side Progressive Web Application (PWA)**:
   - Hosted via HTTPS on GitHub Pages (`https://ridahidsi07.github.io/our-life-planner/`).
   - Served with relative asset paths (`base: './'`), universal SPA fallback, and offline Service Worker caching (`sw.js`).
   - Operates in zero-telemetry **Local-First Mode** by default; all user data is safely persisted in the device's browser `localStorage`.
   - Installable on iOS (Safari Add-to-Home-Screen) and Android (Chrome PWA Install) with dedicated icons (`icon-192.svg`, `icon-512.svg`) and `manifest.webmanifest`.

2. **Backend Sync & Entitlement Service (Optional Cloud Sync)**:
   - Node.js / TypeScript microservice (`src/server/cloudServer.ts`).
   - Authenticated via secure scrypt hashing with bounded concurrency (`crypto.scrypt`) and SHA-256 session tokens.
   - Enforces purchase entitlement claim codes (`OLP-ETSY-XXXX-XXXX`) with single-use replay protection.
   - Restricts payload stream sizes to 5 MB (`req.destroy()`), implements IP-based rate limiting, and enforces fail-closed startup if database state is corrupted.
   - Performs three-way record-level reconciliations using client base revisions, preventing concurrent overwrite data loss (resolves R01).

---

## 2. Environment Configuration

The application requires zero secret credentials embedded in client code. Configuration is managed via standard environment variables:

| Variable | Scope | Default / Value | Description |
|---|---|---|---|
| `VITE_CLOUD_API_URL` | Client | `""` (Empty / Same-origin) | Production cloud sync API base URL (omit for local-only mode). |
| `NODE_ENV` | Server | `"production"` | Runtime environment flag. |
| `PORT` | Server | `3001` | Server listener port. |
| `HOST` | Server | `"0.0.0.0"` | Server listener bind address. |
| `DATABASE_PATH` | Server | `./data/cloud-store.json` | Persistent JSON database file location. |
| `CORS_ORIGIN` | Server | `https://ridahidsi07.github.io` | Allowed CORS origin. Wildcard `*` rejected in production. |

---

## 3. Deployment Procedure

### A. Client PWA Build & Deployment (GitHub Pages)

1. **Prerequisites**: Node.js 22+, npm 10+.
2. **Build Client & Standalone Bundle**:
   ```bash
   npm ci
   npm run build
   ```
3. **Verify Bundle Output**:
   - `dist/index.html` must contain relative asset tags (`./assets/...`).
   - `dist/Our-Life-Planner-Offline.html` must contain embedded CSS/JS with `$$typeof` count preserved (30).
4. **Deploy to GitHub Pages**:
   - Automated via GitHub Actions workflow (`.github/workflows/ci.yml`) on merge to `main`.
   - Alternatively, publish `dist/` directly to branch `gh-pages`:
     ```bash
     git subtree push --prefix dist origin gh-pages
     ```

### B. Cloud Sync Backend Service Deployment

1. **Container / Process Setup**:
   - Run behind an HTTPS reverse proxy (e.g., Caddy, Nginx, or Cloudflare Tunnel) with automatic TLS certificates.
   - Mount a persistent volume at `/data` for `DATABASE_PATH=/data/cloud-store.json`.
2. **Health Check Endpoint**:
   - `GET /health` returns `200 OK` with JSON `{ status: "ok", timestamp: "..." }`.
   - If `/health` fails, the reverse proxy must withhold traffic and alert the operator.
3. **Fail-Closed Verification**:
   - The server verifies JSON schema integrity on startup. If `DATABASE_PATH` contains invalid or truncated bytes, the service exits with code 1 rather than overwriting existing user data.

---

## 4. Backup & Disaster Recovery Runbook

1. **Database Snapshot Schedule**:
   - Automated hourly snapshot of `/data/cloud-store.json` to encrypted offsite object storage (e.g., AWS S3 with bucket versioning or Cloudflare R2).
   - Retention policy: hourly snapshots for 7 days, daily snapshots for 30 days, monthly snapshots for 12 months.
2. **Restoration Procedure**:
   ```bash
   # 1. Stop server process
   pm2 stop olp-cloud-server
   # 2. Quarantine corrupted file
   mv /data/cloud-store.json /data/cloud-store.json.corrupt.$(date +%s)
   # 3. Restore verified backup snapshot
   cp /backups/cloud-store.json.2026-10-16T08-00-00Z /data/cloud-store.json
   # 4. Start server and verify health check
   pm2 start olp-cloud-server
   curl -f http://127.0.0.1:3001/health
   ```
3. **Client-Side Disaster Recovery**:
   - Customers can export a full JSON backup from **Settings > Data & Storage** anytime.
   - Pre-restore safety snapshots are automatically saved to `localStorage` quarantine before any restore or migration is applied.

---

## 5. Rollback Plan

If a newly deployed version introduces critical regressions:
1. **PWA Client Rollback**:
   - Revert commit on `main` branch or push previous verified build artifact to `gh-pages`.
   - Update Service Worker cache version in `sw.js` (e.g. `v1.0.0-patch1`), triggering automatic client update on reload.
2. **Cloud Server Rollback**:
   - Deploy previous container image or git tag.
   - The three-way reconciliation algorithm is backward-compatible across minor schema versions.

---

## 6. Sustainable Cost Model for One-Time Sale

Because Our Life Planner is sold on Etsy as a **one-time purchase** with zero recurring monthly subscription fees, cloud infrastructure costs must be strictly modeled and bounded:

| Scale Tier | Monthly Active Users | Monthly Hosting Cost | Monthly Storage Cost | Support Time Cost | Total Monthly Cost | Cost per Buyer (Annualized) |
|---|---|---|---|---|---|---|
| **Starter (1–100 buyers)** | 25–100 | $0.00 (GitHub Pages free tier) + $5.00 (basic VPS) | $0.10 (S3 backup) | 1–2 hrs ($30) | ~$35.10 / mo | ~$4.21 / buyer / yr |
| **Growing (500 buyers)** | 200–500 | $0.00 (PWA) + $12.00 (managed VPS) | $0.50 (S3 backup) | 3–5 hrs ($100) | ~$112.50 / mo | ~$2.70 / buyer / yr |
| **Scale (2,000 buyers)** | 800–2,000 | $0.00 (PWA) + $24.00 (high-avail server) | $2.00 (S3 backup) | 8–10 hrs ($250) | ~$276.00 / mo | ~$1.65 / buyer / yr |

### Key Economic Safeguards:
1. **Client-Side Heavy, Cloud Light**: 95%+ of compute, rendering, filtering, and storage occurs entirely in the client browser. The cloud server only processes delta synchronization requests.
2. **Payload Bounds**: Individual user snapshots are bounded to 5 MB max. Average user dataset is < 250 KB.
3. **Offline Value Proposition**: Standalone offline edition incurs $0.00 ongoing cloud cost forever. Customers who do not need cloud sync have zero infrastructure footprint.
4. **Honest Support Windows**: 24–48 business hour email support prevents unmanageable operational overhead.

---

## 7. Incident Response Protocol

- **Severity 1 (P1) — Sync Service Down or Data Loss**:
  - Response within 4 hours.
  - Fail over to read-only mode; client automatically falls back to `waiting_to_sync` without losing local edits.
  - Review crash logs in `/var/log/olp-server.log`. Restore snapshot if data integrity is suspect.
- **Severity 2 (P2) — Client Rendering or Visual Glitch**:
  - Response within 24 hours.
  - Release hotfix patch to GitHub Pages. Clients receive update on next reload via Service Worker.
