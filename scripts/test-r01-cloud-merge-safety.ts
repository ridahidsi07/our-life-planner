import assert from 'node:assert/strict';
import { createCloudSyncServer } from '../src/server/cloudServer';
import { EMPTY_SETTINGS } from '../src/utils/sampleData';
import { reconcilePlannerData } from '../src/utils/storageCoordinator';
import {
  syncPlannerWithCloud,
  registerCloudAccount,
  getStoredCloudAckBase,
  saveStoredCloudAckBase,
  clearStoredCloudAckBase,
  SimpleStorageLike,
} from '../src/utils/cloudSyncClient';
import { PlannerBackupData } from '../src/types/planner';

class MemoryStorage implements SimpleStorageLike {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
}

console.log('=== RUNNING R01 REGRESSION: CLOUD MERGE DATA-SAFETY SUITE ===\n');

// 1. Direct 3-way reconciliation check with true base vs wrong base
const baseSnapshot: PlannerBackupData = {
  version: '1.0.0',
  revision: 1,
  exportedAt: '2026-10-15T12:00:00Z',
  settings: EMPTY_SETTINGS,
  tasks: [
    {
      id: 'task-audit-1',
      title: 'Original',
      description: 'Original description',
      category: 'Personal',
      assignedTo: 'Alex',
      priority: 'medium',
      status: 'not_started',
      createdAt: '2026-10-15T12:00:00Z',
    },
  ],
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

const deviceALocal = structuredClone(baseSnapshot);
deviceALocal.tasks[0].title = 'Device A edit';

const deviceBRemote = structuredClone(baseSnapshot);
deviceBRemote.tasks[0].description = 'Device B edit';

// Audit scenario: When true base is used, Device A's edit MUST NOT be lost!
const trueBaseResult = reconcilePlannerData(baseSnapshot, deviceALocal, deviceBRemote, 'cloud');
assert.equal(
  trueBaseResult.mergedData.tasks[0].title,
  'Device A edit',
  'Device A edit must be retained in mergedData when using true base'
);
assert.equal(trueBaseResult.conflicts.length, 1, 'Conflict must be raised for concurrent edit on same record');
assert.equal(
  (trueBaseResult.conflicts[0].localVersion as any).title,
  'Device A edit',
  'Conflict item preserves local candidate'
);
assert.equal(
  (trueBaseResult.conflicts[0].onlineVersion as any).description,
  'Device B edit',
  'Conflict item preserves online candidate'
);
console.log('✓ PASS: Direct 3-way merger with true base preserves local candidate without silent loss');

// 2. Real HTTP server E2E test with two simulated clients
const srv = createCloudSyncServer({ allowTestRoutes: true });
const { url } = await srv.listen();

try {
  const storageA = new MemoryStorage();
  const storageB = new MemoryStorage();

  // Register user
  const reg = await registerCloudAccount(
    { email: 'device-sync-test@example.invalid', password: 'TestPassword123!', displayName: 'Tester' },
    { endpointUrl: url, storage: storageA }
  );
  assert.equal(reg.success, true);
  const userId = reg.user!.id;
  const token = reg.token!;

  // Device B logs into same account
  storageB.setItem('our_life_planner_cloud_session_v1', JSON.stringify({ token }));
  storageB.setItem(
    'our_life_planner_cloud_sync_v1',
    JSON.stringify({
      status: 'connected_synced',
      endpointUrl: url,
      accountUserId: userId,
      serverRevision: 0,
    })
  );

  // Initial upload of base snapshot S (Server now at rev 1)
  const initialUpload = await syncPlannerWithCloud(
    { localSnapshot: baseSnapshot, baseRevision: 0 },
    { endpointUrl: url, storage: storageA }
  );
  assert.equal(initialUpload.success, true);
  assert.equal(initialUpload.serverRevision, 1);

  // Both devices store acknowledged base S at rev 1
  assert.ok(getStoredCloudAckBase(userId, storageA), 'Device A must have saved acknowledged base');
  saveStoredCloudAckBase(
    userId,
    {
      snapshot: baseSnapshot,
      serverRevision: 1,
      etag: initialUpload.etag!,
      acknowledgedAt: new Date().toISOString(),
    },
    storageB
  );

  // Device A makes a local edit (title -> 'Device A edit') and autosaves locally
  // Notice: storageA ack base remains at rev 1 with title 'Original'!
  const ackBeforeA = getStoredCloudAckBase(userId, storageA)!;
  assert.equal(ackBeforeA.snapshot.tasks[0].title, 'Original', 'Local autosave must NOT mutate cloud ack base');

  // Device B changes description to 'Device B edit' and syncs to cloud (Server advances to rev 2)
  const syncB = await syncPlannerWithCloud(
    { localSnapshot: deviceBRemote, baseRevision: 1, baseSnapshot: baseSnapshot },
    { endpointUrl: url, storage: storageB }
  );
  assert.equal(syncB.success, true);
  assert.equal(syncB.serverRevision, 2);

  // Now Device A syncs with cloud!
  // Device A sends localSnapshot (Device A edit) with baseSnapshot automatically resolved from stored ack base (Original)
  const syncA = await syncPlannerWithCloud(
    { localSnapshot: deviceALocal },
    { endpointUrl: url, storage: storageA }
  );

  // The server detects conflict: Device A's edit is NEVER silently discarded!
  assert.equal(syncA.outcome, 'conflict', 'Server must detect conflict rather than silently overwriting Device A');
  assert.equal(syncA.conflicts.length, 1, 'Exactly one conflict item raised');
  assert.equal(
    (syncA.conflicts[0].localVersion as any).title,
    'Device A edit',
    'Local candidate with Device A edit preserved in conflict item'
  );
  console.log('✓ PASS: Two-device cloud sync preserves Device A edit and raises recoverable conflict');

  // 3. Account switching test: signing out clears Device A ack base, never bleeds to User C
  clearStoredCloudAckBase(userId, storageA);
  assert.equal(getStoredCloudAckBase(userId, storageA), null, 'Ack base cleared on signout');

  const regC = await registerCloudAccount(
    { email: 'user-c@example.invalid', password: 'TestPassword123!', displayName: 'User C' },
    { endpointUrl: url, storage: storageA }
  );
  assert.equal(regC.success, true);
  const userCId = regC.user!.id;
  assert.notEqual(userCId, userId);
  assert.equal(getStoredCloudAckBase(userCId, storageA), null, 'New user has clean unacknowledged base');
  console.log('✓ PASS: Account switching strictly isolates cloud base between accounts');
} finally {
  await srv.close();
}

console.log('\n=== ALL R01 REGRESSION ASSERTIONS PASSED ===');
