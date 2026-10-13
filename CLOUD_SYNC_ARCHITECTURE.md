# Our Life Planner — Online Account & Cross-Device Sync Architecture (`LP-01`)

**Document Version:** 1.0.0  
**Audit Reference:** Phase 1 Remediation (`LP-01`) — 12 October 2026  
**Implementation Status:** Local/Staging Server & Client Implemented and Verified (`src/server/cloudServer.ts`, `src/utils/cloudSyncClient.ts`, `src/components/modals/AccountModal.tsx`); Production Cloud Hosting Pending Approval Checkpoint

---

## 1. Executive Summary & Dual-Mode Offer

**Our Life Planner** delivers a dual-mode product offer:
1. **100% Independent Offline HTML / Local Browser Mode:** Works indefinitely without internet access, account registration, or external dependencies. All 19 collections and user settings persist atomically in browser `localStorage` with full JSON (`v1.0.0`) and iCalendar (`.ics`) export/restore compatibility.
2. **Optional Online Account with Cross-Device Sync:** Users who want cross-device access register or sign in via an explicit Online Account (`AccountModal.tsx` -> `cloudSyncClient.ts` -> `cloudServer.ts`). Local profile fields (`settings.ownerName`, `settings.email`, `settings.planTier`) are strictly labeled as local device metadata and never claim cloud sync unless an authenticated cloud session token is active.

---

## 2. Authentication & Session Security Design

| Component | Design Specification | Local/Staging Implementation |
| :--- | :--- | :--- |
| **Credential Hashing** | Passwords and recovery keys are hashed server-side using `crypto.scrypt` (`N=16384, r=8, p=1`, 64-byte derived key) with per-user CSPRNG 16-byte salts and `crypto.timingSafeEqual` verification. | Implemented in `src/server/cloudServer.ts` (`hashSecret`, `verifySecret`). |
| **Session Tokens** | Opaque 256-bit CSPRNG bearer tokens (`olp_tok_...`); only the SHA-256 digest (`tokenHash`) is stored on the server. Tokens expire after 30 days (`SESSION_TTL_MS`) and can be revoked immediately via `/api/v1/auth/logout`. | Implemented in `src/server/cloudServer.ts` (`createSessionForUser`, `authenticateRequest`). |
| **Zero Browser Secrets** | No service-role keys, database credentials, signing secrets, or admin tokens are ever bundled or exposed in `import.meta.env` / `VITE_*` browser code. The browser holds only the user's revocable session token (`STORAGE_KEY_CLOUD_SESSION`) and sync metadata (`STORAGE_KEY_CLOUD_SYNC_STATE`). | Enforced across `src/utils/cloudSyncClient.ts` and verified by automated security assertions. |

---

## 3. Server Ownership & Multi-Tenant Authorization (`Account A` vs `Account B`)

Every cloud snapshot is strictly bound to an immutable `userId` (`usr_...`) derived on the server from the authenticated session token:
- **Ownership Enforcement:** All endpoints (`/api/v1/sync`, `/api/v1/account/export`, `/api/v1/account`) resolve the caller's `userId` from the `Authorization: Bearer <token>` header.
- **Explicit Cross-Account Rejection (`403 Forbidden`):** If a request payload or query parameter specifies a `targetUserId` that does not match the authenticated session's `userId`, the server immediately rejects the request with `HTTP 403` (`Cross-account access denied: Account A cannot access or mutate Account B data.`). Unauthenticated requests receive `HTTP 401`.
- **Database Production Equivalent (Supabase / PostgreSQL RLS):**
  ```sql
  ALTER TABLE planner_cloud_snapshots ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can only read/write their own snapshot"
    ON planner_cloud_snapshots
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  ```

---

## 4. Versioned Storage, Optimistic Concurrency & 3-Way Sync Protocol

### 4.1 Wire Format & `v1.0.0` Backup Compatibility
Cloud snapshots store the exact `PlannerBackupPayload` schema (`version: '1.0.0'`, validated by `validateBackupPayload` in `src/utils/backupValidator.ts`), plus server-managed concurrency metadata:
- `serverRevision` (monotonically increasing integer: `0, 1, 2, ...`)
- `etag` (`"rev-<serverRevision>-<sha256_prefix>"`)
- `updatedAt` (ISO-8601 server timestamp)
- `deviceId` (originating client identifier)

### 4.2 Optimistic Concurrency & 3-Way Collection Reconciliation (`POST /api/v1/sync`)
1. **Fast-Forward Push (`baseRevision === serverRevision`):**
   - If the client's `baseRevision` matches the server's current `serverRevision` and `migrationMode === 'push_local'`, the server validates the payload, increments `serverRevision`, computes a new `etag`, and persists the snapshot atomically.
2. **Pull Remote (`migrationMode === 'pull_remote'`):**
   - Returns the authoritative cloud snapshot without overwriting server state; the client atomically writes the snapshot to `localStorage` after saving a pre-restore safety snapshot.
3. **Concurrent Edit / Revision Mismatch (`baseRevision !== serverRevision` or `migrationMode === 'merge'`):**
   - The server performs **collection-aware 3-way reconciliation** across all 19 collections (`reconcileSnapshots` in `src/server/cloudServer.ts`):
     - Non-overlapping additions and updates across collections are merged automatically.
     - Same-record divergent edits (where both local and remote differ from each other) are emitted in the `conflicts: ConflictItem[]` array with `source: 'cloud'` and queued into `PlannerContext.conflictQueue` for explicit user resolution via `ConflictModal.tsx`.
   - If an upload is interrupted mid-flight (network drop or HTTP 5xx), the client preserves its local state and `baseRevision`, marks `cloudSyncState.status = 'error'`, and safely retries without data loss.

---

## 5. Local-to-Cloud Migration Flows

When a user with existing offline planner data signs up or signs in on a device, `AccountModal.tsx` and `cloudSyncClient.ts` support three explicit migration modes:
1. **`merge` (Default — Safe 3-Way Merge):** Combines local offline entries with any existing cloud entries and surfaces record-level conflicts in `ConflictModal` if the same item was edited differently.
2. **`push_local` (Replace Cloud with This Device):** Overwrites the cloud snapshot with the current device's local planner data.
3. **`pull_remote` (Replace This Device with Cloud):** Saves a local pre-restore recovery snapshot (`STORAGE_KEY_PRE_RESTORE_SNAPSHOT`) and replaces local device data with the cloud snapshot.

---

## 6. Entitlement Verification

- Entitlement status (`planTier`, `status: 'active' | 'grace_period' | 'expired' | 'free_local'`, `maxDevices`, `cloudSyncEnabled`) is stored and signed server-side on the user record.
- If an account's cloud entitlement is disabled or expired (`!user.entitlement.cloudSyncEnabled` or `user.entitlement.status === 'expired'`), `/api/v1/sync` returns `HTTP 402` while **preserving full read/export access** (`/api/v1/account/export`) and **100% local offline functionality** so a user is never locked out of their personal data.

---

## 7. Account Recovery, Export & Deletion

1. **One-Time Recovery Key (`olp-rec-...`):**
   - Generated at registration time and displayed to the user in `AccountModal.tsx`.
   - Hashed with `crypto.scrypt` on the server (`recoveryKeySalt`, `recoveryKeyHash`).
   - Enables self-service password reset (`POST /api/v1/auth/recover`) without requiring third-party transactional email infrastructure during Phase 1.
2. **Full Cloud JSON Export (`GET /api/v1/account/export`):**
   - Exports a `v1.0.0`-compatible `PlannerBackupPayload` directly from the cloud snapshot at any time.
3. **Right to Erasure (`DELETE /api/v1/account`):**
   - Permanently deletes the user's cloud account, active sessions, and server snapshot while leaving local offline data intact (unless the user also chooses Full Device Erase in Settings).

---

## 8. Operating-Cost Model & External Provider Approval Checkpoint

### 8.1 Per-User Storage & Bandwidth Profile
- Average compressed `PlannerBackupPayload` size (all 19 collections, ~1,500 records): **~45 KB gzipped (~160 KB raw JSON)**.
- Average sync frequency per active user: **6–10 syncs/day** (~1.5 MB/day transfer, ~45 MB/month transfer).

### 8.2 Hosted Provider Options & Monthly Operating Cost Assumptions

| Tier / Scale | Recommended Stack | Monthly Fixed Cost | Marginal Cost per 1,000 Active Users | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Local / Staging (Current)** | Node built-in HTTP server (`src/server/cloudServer.ts`) | **$0 / mo** | **$0** | Zero external dependencies; runs locally and in CI (`scripts/test-phase1-audit-remediation.ts`). |
| **Launch / Indie (0 – 1,000 users)** | Cloudflare Workers + D1 / Fly.io Lite / Supabase Free-to-Pro | **$0 – $25 / mo** | **~$0.15 / 1k users** | 1,000 users = ~160 MB total DB storage + ~45 GB/mo egress. Fits comfortably inside base plan quotas. |
| **Growth (1,000 – 10,000 users)** | Supabase Pro ($25) or Cloudflare Workers Paid ($5) + R2/D1 | **$10 – $35 / mo** | **~$1.20 / 1k users** | 10,000 users = ~1.6 GB storage. Transactional email (Resend/Postmark) optional at $0–$20/mo. |

### 8.3 Consequential Action & Approval Checkpoint
In accordance with the Phase 1 audit instructions:
- **No paid external services have been provisioned, no production data/access has been modified, and no public deployment has been triggered.**
- **Approval Checkpoint Required Before Production Cloud Launch:**
  1. **Select Hosting Provider:** Approve either (a) deploying `src/server/cloudServer.ts` to a Node/container host (Fly.io / Railway / Render / Cloudflare) with a persistent volume/Postgres store, or (b) provisioning a managed Supabase project ($0 Free tier for staging / $25/mo Pro for production SLA).
  2. **Select Custom Domain & TLS:** Configure `VITE_CLOUD_API_URL` (e.g., `https://sync.ourlifeplanner.com`) in production build environment variables.
  3. **Approve Billing:** Confirm $0/mo staging tier or up to $25/mo production database tier before provisioning live credentials.
