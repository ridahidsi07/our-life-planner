# Staging Deployment, Rollback & Safe Diagnostics Guide

This document defines standard operating procedures for deploying staging and production releases of **Our Life Planner**, executing zero-downtime rollbacks, and upholding user privacy standards during diagnostic triage.

---

## 1. Architecture Overview

Our Life Planner features two deployment targets:
1. **Offline Single-File Bundle (`Our-Life-Planner-Offline.html`)**: Distributed directly as a static file (e.g. inside `Our-Life-Planner-v1.0.0-Delivery.zip` on Etsy). Requires zero server hosting, database connections, or ongoing infrastructure.
2. **Web / PWA Application (`dist/`)**: Static assets served over HTTPS via any standard CDN / static hosting platform (e.g. Cloudflare Pages, Netlify, Vercel, AWS S3 + CloudFront).

---

## 2. Staging Deployment Procedure

Before any public deployment or Etsy listing update:

1. **Clean Quality Gate Verification:**
   ```bash
   npm ci
   npm run verify
   ```
2. **Deploy to Isolated Staging Environment:**
   Deploy the `dist/` folder to a password-protected or isolated staging URL (e.g. `https://staging.ourlifeplanner.app`).
3. **Smoke Test Staging Deployment:**
   * Verify HTTP response headers (`Cache-Control`, `Content-Security-Policy`).
   * Test first-time onboarding (empty state hero cards, setup wizard).
   * Verify backup export and restore in an incognito session.
   * Verify Service Worker asset caching (`/sw.js`).
   * Verify PWA manifest loads correctly (`/manifest.webmanifest`).

---

## 3. Rollback Procedures

### A. Web / PWA Rollback (Hosting Layer)
If a critical defect is identified after deploying the web application:
1. **1-Click Instant Deployment Revert:**
   In your hosting dashboard (Cloudflare Pages, Netlify, or Vercel), locate the previous stable deployment (e.g. `v1.0.0-rc1`) and click **Rollback to this deployment**.
2. **Service Worker Cache-Busting:**
   The Service Worker cache version is keyed to the build asset hash (`v1-[hash]`). Rolling back the deployment automatically causes client browsers to detect the previous script hashes, purge the invalid cache, and reload the stable bundle on next navigation.

### B. Offline Single-File Rollback (Etsy / Marketplace Layer)
If an issue is found in a distributed delivery package:
1. Revert to the prior verified `Our-Life-Planner-v[prior]-Delivery.zip`.
2. In the Etsy listing manager, replace the download file with the verified prior archive.
3. For buyers who downloaded the affected file, instruct them via support email to export a JSON backup, open the stable replacement file, and click **Restore from Backup**.

### C. Client Data Rollback (User Data Layer)
* Before restoring any backup, Our Life Planner automatically creates a local safety snapshot key:
  ```
  olp_backup_safety_snapshot
  ```
* If a user restores an incompatible or corrupted file, the planner allows reverting to the pre-restore state immediately.
* If a corrupt storage key is detected on startup, the system automatically quarantines it into `olp_quarantine_[timestamp]` without overwriting or deleting it.

---

## 4. Safe Diagnostics Policy (Zero-Data-Leak Guarantee)

When triaging customer support requests or debugging errors:

* **Strict Prohibition on Personal Data Collection:**
  Diagnostic helpers must never log, transmit, or request the contents of user tasks, notes, bill amounts, bank balances, weight entries, or household names.
* **Permitted Environment Diagnostics:**
  The in-app Support dialog only captures non-sensitive client platform indicators:
  - App Version (`1.0.0`)
  - Edition (`web` vs `downloaded`)
  - Theme mode (`light` vs `dark`)
  - Configured timezone and week start day
  - User-Agent string (browser name & version)
  - Operating system platform
  - Storage availability status (`localStorage available`)
* **Sanitized Log Sharing:**
  If a user voluntarily shares an exported JSON backup for recovery triage, it must be inspected only in a private, local, non-networked test environment and deleted immediately upon resolution.
