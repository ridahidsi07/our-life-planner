import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CloudEntitlement, PlannerBackupData } from '../types/planner';
import { validateBackupData } from '../utils/backupValidator';
import { reconcilePlannerData } from '../utils/storageCoordinator';

export interface StoredCloudUser {
  id: string;
  email: string;
  displayName: string;
  passwordSalt: string;
  passwordHash: string;
  recoveryKeySalt: string;
  recoveryKeyHash: string;
  createdAt: string;
  updatedAt: string;
  entitlement: CloudEntitlement;
}

export interface StoredCloudSession {
  tokenHash: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface StoredUserCloudSnapshot {
  userId: string;
  serverRevision: number;
  etag: string;
  updatedAt: string;
  snapshot: PlannerBackupData;
}

export interface CloudDatabaseState {
  users: Record<string, StoredCloudUser>; // keyed by userId
  sessions: Record<string, StoredCloudSession>; // keyed by tokenHash
  snapshots: Record<string, StoredUserCloudSnapshot>; // keyed by userId
  claimedCodes?: Record<string, { userId: string; claimedAt: string; plan: string }>;
}

export interface CloudSyncServerOptions {
  storageFilePath?: string;
  sessionTtlMs?: number;
  allowTestRoutes?: boolean;
  defaultPlan?: 'lifetime_bundle' | 'free_local';
  maxPayloadBytes?: number;
}

function hashSecretScrypt(secret: string, saltHex: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(secret, Buffer.from(saltHex, 'hex'), 64, (err, derived) => {
      if (err) reject(err);
      else resolve(derived.toString('hex'));
    });
  });
}

async function verifySecretScrypt(secret: string, saltHex: string, expectedHashHex: string): Promise<boolean> {
  try {
    const derivedHex = await hashSecretScrypt(secret, saltHex);
    const actual = Buffer.from(derivedHex, 'hex');
    const expected = Buffer.from(expectedHashHex, 'hex');
    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function hashTokenSha256(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateRecoveryKey(): string {
  const bytes = crypto.randomBytes(12).toString('hex').toUpperCase();
  return `OLP-${bytes.slice(0, 6)}-${bytes.slice(6, 12)}-${bytes.slice(12, 18)}-${bytes.slice(18, 24)}`;
}

function computeSnapshotEtag(userId: string, revision: number, snapshot: PlannerBackupData): string {
  const digest = crypto
    .createHash('sha256')
    .update(`${userId}:${revision}:${JSON.stringify(snapshot)}`)
    .digest('hex')
    .slice(0, 24);
  return `W/"rev-${revision}-${digest}"`;
}

export function createCloudSyncServer(options: CloudSyncServerOptions = {}) {
  const sessionTtlMs = options.sessionTtlMs ?? 30 * 24 * 60 * 60 * 1000; // 30 days
  const storageFilePath = options.storageFilePath;

  const db: CloudDatabaseState = {
    users: {},
    sessions: {},
    snapshots: {},
    claimedCodes: {},
  };

  if (storageFilePath && fs.existsSync(storageFilePath)) {
    try {
      const raw = fs.readFileSync(storageFilePath, 'utf-8');
      if (raw.trim()) {
        const parsed = JSON.parse(raw) as CloudDatabaseState;
        if (parsed && typeof parsed === 'object') {
          db.users = parsed.users || {};
          db.sessions = parsed.sessions || {};
          db.snapshots = parsed.snapshots || {};
          db.claimedCodes = parsed.claimedCodes || {};
        } else {
          throw new Error('Database file does not contain a valid object structure');
        }
      }
    } catch (parseErr) {
      throw new Error(
        `CRITICAL: Storage file at ${storageFilePath} is corrupted or unreadable (${parseErr instanceof Error ? parseErr.message : String(parseErr)}). Server refusing to start to prevent data loss. Restore from backup or quarantine.`
      );
    }
  }

  const persistDb = () => {
    if (!storageFilePath) return;
    const dir = path.dirname(storageFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmpFile = `${storageFilePath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tmpFile, storageFilePath);
  };

  const authenticateRequest = (req: http.IncomingMessage): StoredCloudUser | null => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) return null;
    const rawToken = authHeader.slice('Bearer '.length).trim();
    if (!rawToken) return null;

    const tokenHash = hashTokenSha256(rawToken);
    const session = db.sessions[tokenHash];
    if (!session) return null;

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      delete db.sessions[tokenHash];
      persistDb();
      return null;
    }

    const user = db.users[session.userId];
    return user || null;
  };

  const issueSession = (userId: string): string => {
    const rawToken = `olp_sess_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = hashTokenSha256(rawToken);
    const now = Date.now();
    db.sessions[tokenHash] = {
      tokenHash,
      userId,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + sessionTtlMs).toISOString(),
    };
    persistDb();
    return rawToken;
  };

  const requestCounts = new Map<string, { count: number; resetAt: number }>();
  const isRateLimited = (key: string, limit = 120, windowMs = 60000): boolean => {
    const now = Date.now();
    const entry = requestCounts.get(key);
    if (!entry || now > entry.resetAt) {
      requestCounts.set(key, { count: 1, resetAt: now + windowMs });
      return false;
    }
    entry.count++;
    return entry.count > limit;
  };

  const sendJson = (res: http.ServerResponse, statusCode: number, body: unknown) => {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, If-Match',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify(body));
  };

  const maxPayloadBytes = options.maxPayloadBytes ?? 10 * 1024 * 1024;
  const readJsonBody = (req: http.IncomingMessage): Promise<any> =>
    new Promise((resolve, reject) => {
      let data = '';
      let destroyed = false;
      req.on('data', (chunk) => {
        data += chunk;
        if (data.length > maxPayloadBytes) {
          destroyed = true;
          req.destroy(new Error('Payload too large'));
          reject(new Error('Payload too large'));
        }
      });
      req.on('end', () => {
        if (destroyed) return;
        if (!data.trim()) {
          resolve({});
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('Invalid JSON request body'));
        }
      });
      req.on('error', (err) => {
        if (!destroyed) reject(err);
      });
    });

  const formatPublicUser = (user: StoredCloudUser) => ({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt,
    entitlement: user.entitlement,
  });

  const handleRequest = async (req: http.IncomingMessage, res: http.ServerResponse) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, If-Match',
      });
      res.end();
      return;
    }

    const urlObj = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = urlObj.pathname;

    const clientIp = req.socket.remoteAddress || '127.0.0.1';
    if (isRateLimited(clientIp, 240, 60000)) {
      sendJson(res, 429, { error: 'Too many requests. Please slow down and try again.' });
      return;
    }

    try {
      // 1. POST /api/auth/register
      if (pathname === '/api/auth/register' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        const displayName = String(body.displayName || '').trim() || 'Planner Owner';
        const claimCode = body.claimCode ? String(body.claimCode).trim().toUpperCase() : '';

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          sendJson(res, 400, { error: 'A valid email address is required.' });
          return;
        }
        if (password.length < 8) {
          sendJson(res, 400, { error: 'Password must be at least 8 characters long.' });
          return;
        }

        const existingUser = Object.values(db.users).find((u) => u.email === email);
        if (existingUser) {
          sendJson(res, 409, { error: 'An account with this email already exists.' });
          return;
        }

        const userId = `usr_${crypto.randomBytes(12).toString('hex')}`;
        const passwordSalt = crypto.randomBytes(16).toString('hex');
        const passwordHash = await hashSecretScrypt(password, passwordSalt);

        const recoveryKey = generateRecoveryKey();
        const recoveryKeySalt = crypto.randomBytes(16).toString('hex');
        const recoveryKeyHash = await hashSecretScrypt(recoveryKey, recoveryKeySalt);

        const nowIso = new Date().toISOString();

        // Entitlement determination
        let entitlement: CloudEntitlement;
        if (claimCode) {
          if (!/^OLP-(ETSY-)?[A-Z0-9]{4,8}-[A-Z0-9]{4,8}$/.test(claimCode)) {
            sendJson(res, 400, { error: 'Invalid purchase claim code format.' });
            return;
          }
          if (!db.claimedCodes) db.claimedCodes = {};
          if (db.claimedCodes[claimCode]) {
            sendJson(res, 409, { error: 'This purchase claim code has already been redeemed.' });
            return;
          }
          db.claimedCodes[claimCode] = {
            userId,
            claimedAt: nowIso,
            plan: 'lifetime_bundle',
          };
          entitlement = {
            status: 'active',
            plan: 'lifetime_bundle',
            canSync: true,
          };
        } else if (
          options.defaultPlan === 'free_local' ||
          (options.allowTestRoutes === false && options.defaultPlan !== 'lifetime_bundle')
        ) {
          // Production unverified account starts in free tier (local-only)
          entitlement = {
            status: 'active',
            plan: 'free_local',
            canSync: false,
          };
        } else {
          // Test/dev server convenience tier
          entitlement = {
            status: 'active',
            plan: 'lifetime_bundle',
            canSync: true,
          };
        }

        const newUser: StoredCloudUser = {
          id: userId,
          email,
          displayName,
          passwordSalt,
          passwordHash,
          recoveryKeySalt,
          recoveryKeyHash,
          createdAt: nowIso,
          updatedAt: nowIso,
          entitlement,
        };

        db.users[userId] = newUser;
        const token = issueSession(userId);

        sendJson(res, 201, {
          token,
          user: formatPublicUser(newUser),
          recoveryKey,
          serverRevision: 0,
        });
        return;
      }

      // 2. POST /api/auth/login
      if (pathname === '/api/auth/login' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');

        const user = Object.values(db.users).find((u) => u.email === email);
        if (!user || !(await verifySecretScrypt(password, user.passwordSalt, user.passwordHash))) {
          sendJson(res, 401, { error: 'Invalid email or password.' });
          return;
        }

        const token = issueSession(user.id);
        const existingSnap = db.snapshots[user.id];

        sendJson(res, 200, {
          token,
          user: formatPublicUser(user),
          serverRevision: existingSnap ? existingSnap.serverRevision : 0,
          hasCloudSnapshot: Boolean(existingSnap),
        });
        return;
      }

      // 3. POST /api/auth/recover
      if (pathname === '/api/auth/recover' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const email = String(body.email || '').trim().toLowerCase();
        const recoveryKey = String(body.recoveryKey || '').trim().toUpperCase();
        const newPassword = String(body.newPassword || '');

        if (newPassword.length < 8) {
          sendJson(res, 400, { error: 'New password must be at least 8 characters long.' });
          return;
        }

        const user = Object.values(db.users).find((u) => u.email === email);
        if (
          !user ||
          !(await verifySecretScrypt(recoveryKey, user.recoveryKeySalt, user.recoveryKeyHash))
        ) {
          sendJson(res, 401, { error: 'Invalid email or recovery key.' });
          return;
        }

        // Rotate password and recovery key, and revoke all existing sessions for this user
        const newPasswordSalt = crypto.randomBytes(16).toString('hex');
        user.passwordSalt = newPasswordSalt;
        user.passwordHash = await hashSecretScrypt(newPassword, newPasswordSalt);

        const newRecoveryKey = generateRecoveryKey();
        const newRecoverySalt = crypto.randomBytes(16).toString('hex');
        user.recoveryKeySalt = newRecoverySalt;
        user.recoveryKeyHash = await hashSecretScrypt(newRecoveryKey, newRecoverySalt);
        user.updatedAt = new Date().toISOString();

        for (const [tHash, sess] of Object.entries(db.sessions)) {
          if (sess.userId === user.id) {
            delete db.sessions[tHash];
          }
        }

        const token = issueSession(user.id);
        const existingSnap = db.snapshots[user.id];

        sendJson(res, 200, {
          token,
          user: formatPublicUser(user),
          newRecoveryKey,
          serverRevision: existingSnap ? existingSnap.serverRevision : 0,
        });
        return;
      }



      // 4. POST /api/auth/logout
      if (pathname === '/api/auth/logout' && req.method === 'POST') {
        const authHeader = req.headers.authorization || '';
        if (authHeader.startsWith('Bearer ')) {
          const rawToken = authHeader.slice('Bearer '.length).trim();
          const tokenHash = hashTokenSha256(rawToken);
          delete db.sessions[tokenHash];
          persistDb();
        }
        sendJson(res, 200, { ok: true });
        return;
      }

      // 5. Authenticated endpoints below — enforce strict per-user authorization
      const authedUser = authenticateRequest(req);
      if (!authedUser) {
        sendJson(res, 401, { error: 'Authentication required or session expired.' });
        return;
      }

      // Guard against any attempt to query or target another userId via query/header
      const requestedUserId = urlObj.searchParams.get('userId') || req.headers['x-user-id'];
      if (requestedUserId && requestedUserId !== authedUser.id) {
        sendJson(res, 403, {
          error: 'Forbidden: Cross-account access is strictly prohibited.',
        });
        return;
      }

      // GET /api/auth/me
      if (pathname === '/api/auth/me' && req.method === 'GET') {
        const snap = db.snapshots[authedUser.id];
        sendJson(res, 200, {
          user: formatPublicUser(authedUser),
          serverRevision: snap ? snap.serverRevision : 0,
          hasCloudSnapshot: Boolean(snap),
          updatedAt: snap?.updatedAt,
        });
        return;
      }

      // GET /api/cloud/planner
      if (pathname === '/api/cloud/planner' && req.method === 'GET') {
        if (!authedUser.entitlement.canSync) {
          sendJson(res, 403, {
            error: 'Cloud sync entitlement is not active for this account.',
          });
          return;
        }
        const snap = db.snapshots[authedUser.id];
        if (!snap) {
          sendJson(res, 200, {
            initialized: false,
            serverRevision: 0,
          });
          return;
        }
        sendJson(res, 200, {
          initialized: true,
          userId: authedUser.id,
          serverRevision: snap.serverRevision,
          etag: snap.etag,
          updatedAt: snap.updatedAt,
          snapshot: snap.snapshot,
        });
        return;
      }

      // PUT /api/cloud/planner
      if (pathname === '/api/cloud/planner' && req.method === 'PUT') {
        if (!authedUser.entitlement.canSync) {
          sendJson(res, 403, {
            error: 'Cloud sync entitlement is not active for this account.',
          });
          return;
        }

        const body = await readJsonBody(req);
        if (body.userId && body.userId !== authedUser.id) {
          sendJson(res, 403, {
            error: 'Forbidden: Cannot write planner data to another user account.',
          });
          return;
        }

        const validation = validateBackupData(body.clientSnapshot);
        if (!validation.isValid || !validation.data) {
          sendJson(res, 400, {
            error: `Invalid planner snapshot: ${validation.errors[0] || 'Schema validation failed.'}`,
            errors: validation.errors,
          });
          return;
        }

        const clientSnapshot = validation.data;
        const baseRevision =
          typeof body.baseRevision === 'number' ? body.baseRevision : 0;
        const migrationMode = body.migrationMode as
          | 'merge'
          | 'use_cloud'
          | 'overwrite_cloud'
          | undefined;

        const existing = db.snapshots[authedUser.id];
        const currentServerRevision = existing ? existing.serverRevision : 0;

        // Fast path: initial upload, matching baseRevision, or explicit overwrite_cloud
        if (
          !existing ||
          baseRevision === currentServerRevision ||
          migrationMode === 'overwrite_cloud'
        ) {
          const nextRevision = currentServerRevision + 1;
          const updatedAt = new Date().toISOString();
          const savedSnapshot: PlannerBackupData = {
            ...clientSnapshot,
            revision: nextRevision,
            exportedAt: updatedAt,
          };
          const etag = computeSnapshotEtag(authedUser.id, nextRevision, savedSnapshot);

          db.snapshots[authedUser.id] = {
            userId: authedUser.id,
            serverRevision: nextRevision,
            etag,
            updatedAt,
            snapshot: savedSnapshot,
          };
          persistDb();

          sendJson(res, 200, {
            status: 'synced',
            serverRevision: nextRevision,
            etag,
            updatedAt,
            snapshot: savedSnapshot,
            hasRemoteChanges: false,
          });
          return;
        }

        // Stale baseRevision (baseRevision < currentServerRevision) -> 3-way reconciliation
        const baseSnapValidation = body.baseSnapshot
          ? validateBackupData(body.baseSnapshot)
          : null;
        const emptyBase: PlannerBackupData = {
          ...existing.snapshot,
          tasks: [],
          routines: [],
          goals: [],
          habits: [],
          inbox: [],
          transactions: [],
          bills: [],
          savingsPots: [],
          debts: [],
          recipes: [],
          plannedMeals: [],
          groceries: [],
          workouts: [],
          weightProfiles: [],
          weightRecords: [],
          hydrationEntries: [],
          hydrationTargets: [],
          calendarEvents: [],
          weeklyReviews: [],
        };
        const effectiveBase =
          baseSnapValidation?.isValid && baseSnapValidation.data
            ? baseSnapValidation.data
            : emptyBase;

        const recon = reconcilePlannerData(
          effectiveBase,
          clientSnapshot,
          existing.snapshot,
          'cloud'
        );

        if (recon.conflicts.length > 0) {
          sendJson(res, 409, {
            status: 'conflict',
            serverRevision: existing.serverRevision,
            etag: existing.etag,
            serverSnapshot: existing.snapshot,
            mergedData: recon.mergedData,
            conflicts: recon.conflicts,
          });
          return;
        }

        // Clean 3-way merge without conflicts
        const nextRevision = existing.serverRevision + 1;
        const updatedAt = new Date().toISOString();
        const mergedSnapshot: PlannerBackupData = {
          ...recon.mergedData,
          revision: nextRevision,
          exportedAt: updatedAt,
        };
        const etag = computeSnapshotEtag(authedUser.id, nextRevision, mergedSnapshot);

        db.snapshots[authedUser.id] = {
          userId: authedUser.id,
          serverRevision: nextRevision,
          etag,
          updatedAt,
          snapshot: mergedSnapshot,
        };
        persistDb();

        sendJson(res, 200, {
          status: 'merged',
          serverRevision: nextRevision,
          etag,
          updatedAt,
          snapshot: mergedSnapshot,
          hasRemoteChanges: recon.hasRemoteChanges,
        });
        return;
      }

      // GET /api/cloud/export
      if (pathname === '/api/cloud/export' && req.method === 'GET') {
        const snap = db.snapshots[authedUser.id];
        if (!snap) {
          sendJson(res, 404, { error: 'No cloud planner data stored for this account yet.' });
          return;
        }
        sendJson(res, 200, snap.snapshot);
        return;
      }

      // DELETE /api/auth/account
      if (pathname === '/api/auth/account' && req.method === 'DELETE') {
        delete db.snapshots[authedUser.id];
        for (const [tHash, sess] of Object.entries(db.sessions)) {
          if (sess.userId === authedUser.id) {
            delete db.sessions[tHash];
          }
        }
        delete db.users[authedUser.id];
        persistDb();
        sendJson(res, 200, { deleted: true });
        return;
      }

      // POST /api/auth/claim — buyer claim code activation
      if (pathname === '/api/auth/claim' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const claimCode = String(body.claimCode || '').trim().toUpperCase();

        if (!claimCode || !/^OLP-(ETSY-)?[A-Z0-9]{4,8}-[A-Z0-9]{4,8}$/.test(claimCode)) {
          sendJson(res, 400, {
            error: 'Invalid purchase claim code format. Example: OLP-ETSY-A1B2-C3D4 or OLP-7B8C-9D0E.',
          });
          return;
        }

        if (!db.claimedCodes) db.claimedCodes = {};
        if (db.claimedCodes[claimCode]) {
          sendJson(res, 409, {
            error: 'This purchase claim code has already been redeemed.',
          });
          return;
        }

        db.claimedCodes[claimCode] = {
          userId: authedUser.id,
          claimedAt: new Date().toISOString(),
          plan: 'lifetime_bundle',
        };

        authedUser.entitlement = {
          status: 'active',
          plan: 'lifetime_bundle',
          canSync: true,
        };
        authedUser.updatedAt = new Date().toISOString();
        persistDb();

        sendJson(res, 200, {
          success: true,
          entitlement: authedUser.entitlement,
          message: 'Lifetime sync access successfully activated.',
        });
        return;
      }

      // Admin/test helper to update entitlement in local/staging tests ONLY
      if (pathname === '/api/__test/entitlement' && req.method === 'POST') {
        if (!options.allowTestRoutes) {
          sendJson(res, 404, { error: 'Not found' });
          return;
        }
        const body = await readJsonBody(req);
        if (body.entitlement) {
          authedUser.entitlement = {
            ...authedUser.entitlement,
            ...body.entitlement,
          };
          persistDb();
        }
        sendJson(res, 200, { entitlement: authedUser.entitlement });
        return;
      }

      sendJson(res, 404, { error: 'Not found' });
    } catch (err) {
      sendJson(res, 500, {
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  };

  const server = http.createServer((req, res) => {
    void handleRequest(req, res);
  });

  return {
    server,
    db,
    listen: (port = 0, host = '127.0.0.1'): Promise<{ port: number; url: string }> =>
      new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          const addr = server.address();
          if (!addr || typeof addr === 'string') {
            reject(new Error('Failed to bind server address'));
            return;
          }
          resolve({ port: addr.port, url: `http://${host}:${addr.port}` });
        });
      }),
    close: (): Promise<void> =>
      new Promise((resolve) => {
        server.close(() => resolve());
      }),
  };
}
