import {
  validateBackupData,
  parseAndValidateBackupJson,
  atomicRestoreBackup,
  rollbackPreRestoreSnapshot,
  getPreRestoreSnapshot,
  STORAGE_KEY_PRE_RESTORE_SNAPSHOT,
  REQUIRED_BACKUP_ARRAY_KEYS,
  StorageLike,
} from '../src/utils/backupValidator';
import {
  STORAGE_KEY_DATA,
  STORAGE_KEY_SETTINGS,
  STORAGE_KEY_REVISION,
} from '../src/utils/storageCoordinator';
import {
  INITIAL_SETTINGS,
  SAMPLE_BILLS,
  SAMPLE_BRAIN_DUMP,
  SAMPLE_CALENDAR_EVENTS,
  SAMPLE_DEBTS,
  SAMPLE_GOALS,
  SAMPLE_GROCERIES,
  SAMPLE_HABITS,
  SAMPLE_HYDRATION_LOG,
  SAMPLE_HYDRATION_TARGETS,
  SAMPLE_PLANNED_MEALS,
  SAMPLE_RECIPES,
  SAMPLE_ROUTINES,
  SAMPLE_SAVINGS_POTS,
  SAMPLE_TASKS,
  SAMPLE_TRANSACTIONS,
  SAMPLE_WEIGHT_PROFILES,
  SAMPLE_WEIGHT_RECORDS,
  SAMPLE_WORKOUTS,
} from '../src/utils/sampleData';
import { PlannerBackupData } from '../src/types/planner';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${name}`);
  } else {
    failed++;
    console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function createValidSampleBackup(): PlannerBackupData {
  return JSON.parse(
    JSON.stringify({
      version: '1.0.0',
      exportedAt: '2026-10-10T12:00:00.000Z',
      revision: 5,
      settings: INITIAL_SETTINGS,
      tasks: SAMPLE_TASKS,
      routines: SAMPLE_ROUTINES,
      goals: SAMPLE_GOALS,
      habits: SAMPLE_HABITS,
      inbox: SAMPLE_BRAIN_DUMP,
      transactions: SAMPLE_TRANSACTIONS,
      bills: SAMPLE_BILLS,
      savingsPots: SAMPLE_SAVINGS_POTS,
      debts: SAMPLE_DEBTS,
      recipes: SAMPLE_RECIPES,
      plannedMeals: SAMPLE_PLANNED_MEALS,
      groceries: SAMPLE_GROCERIES,
      workouts: SAMPLE_WORKOUTS,
      weightProfiles: SAMPLE_WEIGHT_PROFILES,
      weightRecords: SAMPLE_WEIGHT_RECORDS,
      hydrationEntries: SAMPLE_HYDRATION_LOG,
      hydrationTargets: SAMPLE_HYDRATION_TARGETS,
      calendarEvents: SAMPLE_CALENDAR_EVENTS,
    })
  );
}

class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();
  public failOnKey: string | null = null;

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    if (this.failOnKey === key) {
      throw new Error(`Simulated QuotaExceededError on key ${key}`);
    }
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

console.log('=== Backup Validation, Atomic Restore & Snapshot Recovery Tests ===\n');

// 1. Exact user reproduction: {"version":"1.0.0"}
console.log('1. Reproduction Case: {"version":"1.0.0"}');
{
  const res = parseAndValidateBackupJson('{"version":"1.0.0"}');
  assert(!res.isValid, 'Rejects {"version":"1.0.0"} as invalid');
  assert(res.data === undefined, 'Does not return preview data for {"version":"1.0.0"}');
  assert(
    res.errors.some((e) => e.includes('exportedAt')),
    'Reports missing exportedAt'
  );
  assert(
    res.errors.some((e) => e.includes('settings')),
    'Reports missing settings object'
  );
  for (const key of REQUIRED_BACKUP_ARRAY_KEYS) {
    assert(
      res.errors.some((e) => e.includes(`"${key}"`)),
      `Reports missing required array "${key}"`
    );
  }
}

// 2. Complete valid backup passes validation
console.log('\n2. Valid Full Backup');
{
  const validBackup = createValidSampleBackup();
  const res = validateBackupData(validBackup);
  assert(res.isValid, 'Accepts complete valid backup', res.errors.join('; '));
  assert(res.errors.length === 0, 'Zero validation errors on valid backup');
  assert(res.summary?.ownerName === 'Rida', 'Summary extracts ownerName');
  assert((res.summary?.totalRecords ?? 0) > 50, 'Summary counts all records accurately');
}

// 3. Required Settings & Top-level Field Checks
console.log('\n3. Settings & Top-Level Validation');
{
  const missingOwner = createValidSampleBackup();
  missingOwner.settings.ownerName = '   ';
  const res1 = validateBackupData(missingOwner);
  assert(!res1.isValid && res1.errors.some((e) => e.includes('ownerName')), 'Rejects empty settings.ownerName');

  const badWeekStart = createValidSampleBackup();
  (badWeekStart.settings as any).weekStartsOn = 'Wednesday';
  const res2 = validateBackupData(badWeekStart);
  assert(!res2.isValid && res2.errors.some((e) => e.includes('weekStartsOn')), 'Rejects invalid settings.weekStartsOn');

  const badBudgetDates = createValidSampleBackup();
  badBudgetDates.settings.budgetStartDate = '2026-10-31';
  badBudgetDates.settings.budgetEndDate = '2026-10-01';
  const res3 = validateBackupData(badBudgetDates);
  assert(!res3.isValid && res3.errors.some((e) => e.includes('budgetStartDate')), 'Rejects budgetStartDate > budgetEndDate');
}

// 4. Date & Amount Validation in Collections
console.log('\n4. Date & Amount Validation');
{
  const badDateBackup = createValidSampleBackup();
  badDateBackup.tasks[0].dueDate = '2026-02-30'; // impossible calendar date
  const resDate = validateBackupData(badDateBackup);
  assert(!resDate.isValid && resDate.errors.some((e) => e.includes('tasks[0].dueDate')), 'Rejects impossible calendar date 2026-02-30');

  const negativeTxBackup = createValidSampleBackup();
  negativeTxBackup.transactions[0].amount = -50;
  const resTx = validateBackupData(negativeTxBackup);
  assert(!resTx.isValid && resTx.errors.some((e) => e.includes('transactions[0].amount')), 'Rejects negative transaction amount');

  const nanBillBackup = createValidSampleBackup();
  nanBillBackup.bills[0].plannedAmount = Number.NaN;
  const resBill = validateBackupData(nanBillBackup);
  assert(!resBill.isValid && resBill.errors.some((e) => e.includes('bills[0].plannedAmount')), 'Rejects NaN bill plannedAmount');

  const zeroWeightBackup = createValidSampleBackup();
  zeroWeightBackup.weightRecords[0].weightKg = 0;
  const resWeight = validateBackupData(zeroWeightBackup);
  assert(!resWeight.isValid && resWeight.errors.some((e) => e.includes('weightRecords[0].weightKg')), 'Rejects non-positive weightKg');

  const dupIdBackup = createValidSampleBackup();
  dupIdBackup.tasks.push({ ...dupIdBackup.tasks[0] });
  const resDup = validateBackupData(dupIdBackup);
  assert(!resDup.isValid && resDup.errors.some((e) => e.includes('duplicate id')), 'Rejects duplicate IDs in collection');
}

// 5. Cross-Entity Relationship Validation
console.log('\n5. Cross-Entity Relationship Validation');
{
  const brokenProfile = createValidSampleBackup();
  brokenProfile.weightRecords[0].profileId = 'wp-nonexistent';
  const r1 = validateBackupData(brokenProfile);
  assert(!r1.isValid && r1.errors.some((e) => e.includes('weightProfileId')), 'Rejects weightRecord with unknown profileId');

  const brokenBillLink = createValidSampleBackup();
  brokenBillLink.transactions[0].linkedBillId = 'bill-missing';
  const r2 = validateBackupData(brokenBillLink);
  assert(!r2.isValid && r2.errors.some((e) => e.includes('linkedBillId')), 'Rejects transaction with unknown linkedBillId');

  const brokenExpenseLink = createValidSampleBackup();
  brokenExpenseLink.bills[2].linkedExpenseId = 'tx-missing';
  const r3 = validateBackupData(brokenExpenseLink);
  assert(!r3.isValid && r3.errors.some((e) => e.includes('linkedExpenseId')), 'Rejects bill with unknown linkedExpenseId');

  const brokenTransferLink = createValidSampleBackup();
  brokenTransferLink.savingsPots[0].deposits[0].linkedTransferId = 'tx-missing-transfer';
  const r4 = validateBackupData(brokenTransferLink);
  assert(!r4.isValid && r4.errors.some((e) => e.includes('linkedTransferId')), 'Rejects savings deposit with unknown linkedTransferId');

  const brokenRecipeLink = createValidSampleBackup();
  brokenRecipeLink.plannedMeals[0].recipeId = 'rec-deleted';
  const r5 = validateBackupData(brokenRecipeLink);
  assert(!r5.isValid && r5.errors.some((e) => e.includes('recipeId')), 'Rejects plannedMeal with unknown recipeId');

  const brokenMemberLink = createValidSampleBackup();
  brokenMemberLink.tasks[0].assignedMemberId = 'mem-unknown';
  const r6 = validateBackupData(brokenMemberLink);
  assert(!r6.isValid && r6.errors.some((e) => e.includes('assignedMemberId')), 'Rejects task with unknown assignedMemberId');
}

// 6. Atomic Restore, Write-Failure Rollback, and Pre-Restore Snapshot Recovery
console.log('\n6. Atomic Restore & Recoverable Snapshot');
{
  const storage = new MemoryStorage();
  const initialData = createValidSampleBackup();
  initialData.settings.ownerName = 'Original Owner';
  initialData.tasks = initialData.tasks.slice(0, 3);
  storage.setItem(STORAGE_KEY_DATA, JSON.stringify(initialData));
  storage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(initialData.settings));
  storage.setItem(STORAGE_KEY_REVISION, '5');

  // 6a. Invalid restore does not touch storage
  const badAttempt = atomicRestoreBackup({
    incomingBackup: { version: '1.0.0' },
    currentSnapshot: initialData,
    currentRevision: 5,
    storage,
  });
  assert(!badAttempt.success, 'atomicRestoreBackup rejects {"version":"1.0.0"}');
  assert(
    JSON.parse(storage.getItem(STORAGE_KEY_DATA)!).settings.ownerName === 'Original Owner',
    'Storage remains untouched after rejected restore'
  );
  assert(
    storage.getItem(STORAGE_KEY_PRE_RESTORE_SNAPSHOT) === null,
    'No pre-restore snapshot written when validation fails'
  );

  // 6b. Simulated write failure mid-transaction rolls back storage atomically
  const incomingValid = createValidSampleBackup();
  incomingValid.settings.ownerName = 'Restored Owner';
  storage.failOnKey = STORAGE_KEY_SETTINGS; // fail after STORAGE_KEY_PRE_RESTORE_SNAPSHOT and STORAGE_KEY_DATA were written!

  const failedWriteAttempt = atomicRestoreBackup({
    incomingBackup: incomingValid,
    currentSnapshot: initialData,
    currentRevision: 5,
    storage,
  });
  assert(!failedWriteAttempt.success, 'atomicRestoreBackup reports failure when storage write throws');
  assert(
    JSON.parse(storage.getItem(STORAGE_KEY_DATA)!).settings.ownerName === 'Original Owner',
    'STORAGE_KEY_DATA rolled back to Original Owner on mid-write failure'
  );
  assert(
    storage.getItem(STORAGE_KEY_PRE_RESTORE_SNAPSHOT) === null,
    'STORAGE_KEY_PRE_RESTORE_SNAPSHOT rolled back on mid-write failure'
  );
  assert(
    storage.getItem(STORAGE_KEY_REVISION) === '5',
    'STORAGE_KEY_REVISION rolled back on mid-write failure'
  );

  // 6c. Successful atomic restore retains recoverable previous snapshot
  storage.failOnKey = null;
  const goodRestore = atomicRestoreBackup({
    incomingBackup: incomingValid,
    currentSnapshot: initialData,
    currentRevision: 5,
    storage,
  });
  assert(goodRestore.success, 'atomicRestoreBackup succeeds on valid backup');
  assert(
    JSON.parse(storage.getItem(STORAGE_KEY_DATA)!).settings.ownerName === 'Restored Owner',
    'Active storage updated to Restored Owner'
  );
  const retained = getPreRestoreSnapshot(storage);
  assert(retained !== null, 'Pre-restore snapshot is retained and readable');
  assert(
    retained?.ownerName === 'Original Owner' && retained?.snapshot.tasks.length === 3,
    'Retained snapshot preserves Original Owner and exact 3 tasks'
  );

  // 6d. Rollback to previous snapshot
  const rollbackRes = rollbackPreRestoreSnapshot({
    currentSnapshot: goodRestore.restoredData!,
    currentRevision: goodRestore.nextRevision!,
    storage,
  });
  assert(rollbackRes.success, 'rollbackPreRestoreSnapshot succeeds');
  assert(
    JSON.parse(storage.getItem(STORAGE_KEY_DATA)!).settings.ownerName === 'Original Owner',
    'Rollback restores Original Owner into active storage'
  );
  assert(
    JSON.parse(storage.getItem(STORAGE_KEY_DATA)!).tasks.length === 3,
    'Rollback restores exact 3 tasks into active storage'
  );
}

console.log(`\nSummary: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
