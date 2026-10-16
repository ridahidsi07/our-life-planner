import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createCloudSyncServer } from '../src/server/cloudServer';

console.log('=== RUNNING R02 & R15 REGRESSION: PRODUCTION ENTITLEMENT & HARDENING SUITE ===\n');

// 1. Production Mode: /api/__test/entitlement MUST NOT be accessible (HTTP 404)
const prodServer = createCloudSyncServer({ allowTestRoutes: false });
const { url: prodUrl } = await prodServer.listen();

try {
  // Register an ordinary account without claim code
  const regRes = await fetch(`${prodUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'buyer-check@example.invalid',
      password: 'StrongPassword123!',
      displayName: 'Buyer',
    }),
  });
  assert.equal(regRes.status, 201);
  const regPayload: any = await regRes.json();
  const token = regPayload.token;

  // Verify registration tier defaults to free_local (canSync: false)
  assert.equal(regPayload.user.entitlement.plan, 'free_local', 'Unverified account must be on free tier');
  assert.equal(regPayload.user.entitlement.canSync, false, 'Unverified account cannot sync to cloud');
  console.log('✓ PASS: Default registration creates free_local account with canSync: false');

  // Ordinary account attempts to call /api/__test/entitlement
  const testRouteRes = await fetch(`${prodUrl}/api/__test/entitlement`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      entitlement: { status: 'active', plan: 'lifetime_bundle', canSync: true },
    }),
  });
  assert.equal(testRouteRes.status, 404, 'Production server MUST return 404 for test entitlement route');
  console.log('✓ PASS: Production server returns 404 for test route /api/__test/entitlement');

  // Verify sync attempt is rejected for account without active entitlement (HTTP 403)
  const syncAttempt = await fetch(`${prodUrl}/api/cloud/planner`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(syncAttempt.status, 403, 'Sync must be rejected for free tier account');
  console.log('✓ PASS: Cloud sync is rejected with 403 for unentitled account');

  // 2. Claim Code Redemption via POST /api/auth/claim
  // Invalid format test
  const invalidClaim = await fetch(`${prodUrl}/api/auth/claim`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ claimCode: 'NOT-A-VALID-CODE' }),
  });
  assert.equal(invalidClaim.status, 400, 'Invalid claim code format must return 400');

  // Valid claim code redemption
  const validCode = 'OLP-ETSY-99A1-BB22';
  const claimRes = await fetch(`${prodUrl}/api/auth/claim`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ claimCode: validCode }),
  });
  assert.equal(claimRes.status, 200, 'Valid claim code redemption must succeed with 200');
  const claimPayload: any = await claimRes.json();
  assert.equal(claimPayload.entitlement.plan, 'lifetime_bundle');
  assert.equal(claimPayload.entitlement.canSync, true);
  console.log('✓ PASS: Valid claim code redemption grants lifetime_bundle with canSync: true');

  // Replay attempt with same claim code must return 409 Conflict
  const replayRes = await fetch(`${prodUrl}/api/auth/claim`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ claimCode: validCode }),
  });
  assert.equal(replayRes.status, 409, 'Replay of claimed code must be rejected with 409 Conflict');
  console.log('✓ PASS: Claim code replay protection rejects re-use with 409 Conflict');
} finally {
  await prodServer.close();
}

// 3. Fail-Closed Persistence Test (R15 / R03)
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'olp-fail-closed-'));
const corruptDbPath = path.join(tempDir, 'corrupt-cloud-db.json');
fs.writeFileSync(corruptDbPath, '{"users": {"incomplete": json data corrupt!#@$');

assert.throws(
  () => {
    createCloudSyncServer({ storageFilePath: corruptDbPath });
  },
  /CRITICAL: Storage file at .* is corrupted or unreadable/,
  'Server MUST throw fatal error on corrupted database file instead of silently wiping'
);
console.log('✓ PASS: Corrupt database storage triggers fail-closed startup halt');

console.log('\n=== ALL R02 & R15 REGRESSION ASSERTIONS PASSED ===');
