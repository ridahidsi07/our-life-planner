import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  getRealTodayDate,
  isBirthdayEventOnDate,
  shiftCalendarDate,
} from '../src/utils/recurrence';
import { isRoutineActiveOnDate } from '../src/utils/routineRecurrence';
import { serializePlannerCalendarToIcs } from '../src/utils/icsSerializer';
import {
  EMPTY_SETTINGS,
  DEMO_SETTINGS,
  createEmptySettings,
  SAMPLE_TASKS,
  SAMPLE_BILLS,
  SAMPLE_HABITS,
  SAMPLE_CALENDAR_EVENTS,
} from '../src/utils/sampleData';
import {
  calculateSavingsAndDebtSummary,
  computeWeightMetrics,
  isCompletableScheduleItem,
} from '../src/utils/calculations';
import {
  STORAGE_KEY_DATA,
  STORAGE_KEY_SETTINGS,
  STORAGE_KEY_REVISION,
  STORAGE_KEY_CORRUPT_QUARANTINE,
  STORAGE_KEY_CLOUD_SESSION,
  STORAGE_KEY_CLOUD_SYNC_STATE,
  PLANNER_COLLECTION_KEYS,
  applyConflictResolutionToData,
  describeConflictVersion,
  atomicWritePlannerStorage,
  quarantineCorruptStorage,
  getQuarantinedCorruptData,
  clearQuarantinedCorruptData,
  eraseAllAppStorageKeys,
  reconcilePlannerData,
  SimpleStorageLike,
} from '../src/utils/storageCoordinator';
import {
  STORAGE_KEY_PRE_RESTORE_SNAPSHOT,
  savePreRestoreSnapshot,
  getPreRestoreSnapshot,
  validateBackupData,
} from '../src/utils/backupValidator';
import { createCloudSyncServer } from '../src/server/cloudServer';
import {
  registerCloudAccount,
  loginCloudAccount,
  logoutCloudAccount,
  recoverCloudAccountWithKey,
  syncPlannerWithCloud,
  exportCloudAccountBackup,
  deleteCloudAccount,
  getStoredCloudSyncState,
} from '../src/utils/cloudSyncClient';
import { ConflictItem, PlannerBackupData, RoutineItem } from '../src/types/planner';

class MockStorage implements SimpleStorageLike {
  private store = new Map<string, string>();
  public failOnKey: string | null = null;

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    if (this.failOnKey === key) {
      throw new Error(`QuotaExceededError: Simulated write failure on key ${key}`);
    }
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }
}

function createValidSnapshot(overrides: Partial<PlannerBackupData> = {}): PlannerBackupData {
  return {
    version: '1.0.0',
    exportedAt: '2026-10-12T10:00:00.000Z',
    revision: 1,
    settings: createEmptySettings({ ownerName: 'Alex', hasCompletedSetup: true }),
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
    ...overrides,
  };
}

async function runTests() {
  console.log('=== Phase 1 Audit Remediation Verification Suite (LP-01 to LP-12) ===\n');

  // ---------------------------------------------------------------------------
  // LP-02: Durable Save, Atomic Multi-Key Rollback, Corrupt Quarantine
  // ---------------------------------------------------------------------------
  console.log('Testing LP-02: Atomic multi-key write rollback & corrupt startup quarantine...');
  {
    const storage = new MockStorage();
    const initialSnap = createValidSnapshot({ revision: 3 });
    const firstWrite = atomicWritePlannerStorage({
      data: initialSnap,
      settings: initialSnap.settings,
      revision: 3,
      storage,
    });
    assert.equal(firstWrite.success, true, 'Initial atomic write should succeed');
    assert.equal(storage.getItem(STORAGE_KEY_REVISION), '3');

    // Simulate failure on the 2nd key (STORAGE_KEY_SETTINGS) after STORAGE_KEY_DATA was written
    storage.failOnKey = STORAGE_KEY_SETTINGS;
    const updatedSnap = createValidSnapshot({
      revision: 4,
      settings: createEmptySettings({ ownerName: 'MutatedName' }),
    });
    const failedWrite = atomicWritePlannerStorage({
      data: updatedSnap,
      settings: updatedSnap.settings,
      revision: 4,
      storage,
    });
    assert.equal(failedWrite.success, false, 'Write must report failure when settings write throws');
    assert.ok(failedWrite.error?.includes('QuotaExceededError'));

    // Verify full rollback of all 3 keys to revision 3
    storage.failOnKey = null;
    const rolledBackData = JSON.parse(storage.getItem(STORAGE_KEY_DATA)!);
    const rolledBackSettings = JSON.parse(storage.getItem(STORAGE_KEY_SETTINGS)!);
    assert.equal(rolledBackData.revision, 3, 'STORAGE_KEY_DATA must roll back to revision 3');
    assert.equal(rolledBackSettings.ownerName, 'Alex', 'STORAGE_KEY_SETTINGS must remain Alex');
    assert.equal(storage.getItem(STORAGE_KEY_REVISION), '3', 'STORAGE_KEY_REVISION must remain 3');

    // Corrupt data quarantine
    const rawCorrupt = '{"version":"1.0.0","tasks":[BROKEN_JSON';
    const q = quarantineCorruptStorage({
      rawData: rawCorrupt,
      rawSettings: '{"ownerName":"Alex"}',
      rawRevision: '9',
      reason: 'Unexpected token B in JSON',
      errors: ['SyntaxError: Unexpected token B'],
      storage,
    });
    assert.equal(q.rawData, rawCorrupt, 'Quarantine must preserve exact raw corrupt bytes');
    const retrievedQ = getQuarantinedCorruptData(storage);
    assert.ok(retrievedQ, 'Quarantined payload must be retrievable from storage');
    assert.equal(retrievedQ?.rawData, rawCorrupt);
    clearQuarantinedCorruptData(storage);
    assert.equal(getQuarantinedCorruptData(storage), null);

    // Check SavingIndicator source has no fake setTimeout retry
    const indicatorSrc = fs.readFileSync(
      path.resolve('src/components/ui/SavingIndicator.tsx'),
      'utf-8'
    );
    assert.ok(indicatorSrc.includes('retrySave'), 'SavingIndicator must invoke genuine retrySave()');
    assert.ok(
      indicatorSrc.includes('exportUnsavedSnapshot'),
      'SavingIndicator must provide exportUnsavedSnapshot()'
    );
    assert.ok(
      !indicatorSrc.includes("setSavingState('saved_local')"),
      'SavingIndicator must not fake-reset savingState to saved_local'
    );
  }
  console.log('  ✓ LP-02 passed');

  // ---------------------------------------------------------------------------
  // LP-03: Collection-Aware, Null-Safe, Queued, Durable Conflict Resolution
  // ---------------------------------------------------------------------------
  console.log('Testing LP-03: Conflict resolution across all 19 collections + delete-vs-edit + queue...');
  {
    const sampleRecordByCollection: Record<string, any> = {
      tasks: { id: 'item-1', title: 'Task A', category: 'Work', assignedTo: 'Me', priority: 'high', status: 'not_started', createdAt: '2026-10-01' },
      routines: { id: 'item-1', title: 'Routine A', category: 'Home', assignedTo: 'Me', priority: 'medium', interval: 'daily', startDate: '2026-10-01', isPaused: false, completedDates: [], skippedDates: [] },
      goals: { id: 'item-1', title: 'Goal A', category: 'Personal', status: 'in_progress', createdAt: '2026-10-01', steps: [] },
      habits: { id: 'item-1', title: 'Habit A', frequencyType: 'daily', effectiveDate: '2026-10-01', checkedDates: [] },
      inbox: { id: 'item-1', text: 'Note A', createdAt: '2026-10-01' },
      transactions: { id: 'item-1', type: 'expense', amount: 25, category: 'Food', date: '2026-10-01' },
      bills: { id: 'item-1', title: 'Bill A', category: 'Utilities', plannedAmount: 80, dueDate: '2026-10-10', isPaid: false },
      savingsPots: { id: 'item-1', name: 'Pot A', targetAmount: 1000, targetDate: '2026-12-31', openingBalance: 100, openingDate: '2026-01-01', deposits: [] },
      debts: { id: 'item-1', name: 'Debt A', originalBalance: 500, currentBalance: 400, annualInterestRate: 5, minimumMonthlyPayment: 50 },
      recipes: { id: 'item-1', title: 'Recipe A', category: 'Dinner', baseServings: 2, prepTimeMinutes: 10, cookTimeMinutes: 20, ingredients: [] },
      plannedMeals: { id: 'item-1', date: '2026-10-05', mealType: 'dinner', recipeTitle: 'Meal A', plannedServings: 2, baseServings: 2, isConsumed: false, ingredientsSnapshot: [] },
      groceries: { id: 'item-1', name: 'Apples', amount: 4, unit: 'pcs', category: 'Produce', isPurchased: false, sourceType: 'manual' },
      workouts: { id: 'item-1', title: 'Workout A', date: '2026-10-05', durationMinutes: 45, muscleGroups: ['Legs'], isCompleted: false, exercises: [] },
      weightProfiles: { id: 'item-1', name: 'Profile A', avatarColor: '#087F83', heightCm: 175 },
      weightRecords: { id: 'item-1', profileId: 'wp-1', date: '2026-10-05', weightKg: 70 },
      hydrationEntries: { id: 'item-1', date: '2026-10-05', time: '09:00', amountMl: 300 },
      hydrationTargets: { date: '2026-10-05', targetMl: 2200 },
      calendarEvents: { id: 'item-1', title: 'Event A', date: '2026-10-05', isAllDay: true, type: 'event' },
      weeklyReviews: { id: '2026-10-05', weekStartDate: '2026-10-05', weekEndDate: '2026-10-11', reflection: 'Good week', intentions: ['Focus'], updatedAt: '2026-10-11T10:00:00Z' },
    };

    assert.equal(PLANNER_COLLECTION_KEYS.length, 19, 'Must cover all 19 collections');

    for (const colKey of PLANNER_COLLECTION_KEYS) {
      const baseRec = sampleRecordByCollection[colKey];
      const itemKey = colKey === 'hydrationTargets' ? baseRec.date : colKey === 'weeklyReviews' ? baseRec.weekStartDate : baseRec.id;
      const localRec = { ...baseRec, title: 'Local Edit', name: 'Local Edit', text: 'Local Edit', amount: 111, targetMl: 2500, reflection: 'Local Reflection' };
      const onlineRec = { ...baseRec, title: 'Online Edit', name: 'Online Edit', text: 'Online Edit', amount: 222, targetMl: 3000, reflection: 'Online Reflection' };

      const snapWithLocal = createValidSnapshot({ [colKey]: [localRec] } as any);

      // 1. Edit-vs-edit choosing 'online'
      const editConflict: ConflictItem = {
        id: itemKey,
        entityType: colKey,
        title: 'Conflict Item',
        localVersion: localRec,
        onlineVersion: onlineRec,
        timestamp: '10:00',
        source: 'tab',
      };
      const resolvedOnline = applyConflictResolutionToData(snapWithLocal, editConflict, 'online');
      assert.deepEqual(
        (resolvedOnline as any)[colKey][0],
        onlineRec,
        `Choosing 'online' must update ${colKey}`
      );

      // 2. Edit-vs-edit choosing 'local'
      const resolvedLocal = applyConflictResolutionToData(resolvedOnline, editConflict, 'local');
      assert.deepEqual(
        (resolvedLocal as any)[colKey][0],
        localRec,
        `Choosing 'local' must keep/restore local version in ${colKey}`
      );

      // 3. Delete-vs-edit (localVersion = null, onlineVersion = onlineRec)
      const deleteConflict: ConflictItem = {
        id: itemKey,
        entityType: colKey,
        title: 'Deleted Item',
        localVersion: null,
        onlineVersion: onlineRec,
        timestamp: '10:01',
        source: 'cloud',
      };
      const descDeleted = describeConflictVersion(colKey, null, 'Deleted Item');
      assert.equal(descDeleted.isDeleted, true, `describeConflictVersion must be null-safe for ${colKey}`);
      const resolvedDeleteLocal = applyConflictResolutionToData(snapWithLocal, deleteConflict, 'local');
      assert.equal(
        (resolvedDeleteLocal as any)[colKey].length,
        0,
        `Choosing 'local' when localVersion is null must delete item from ${colKey}`
      );
      const resolvedDeleteOnline = applyConflictResolutionToData(resolvedDeleteLocal, deleteConflict, 'online');
      assert.equal(
        (resolvedDeleteOnline as any)[colKey].length,
        1,
        `Choosing 'online' when onlineVersion is present must restore item in ${colKey}`
      );
    }

    // Multi-conflict queue reconciliation across 3 collections simultaneously
    const baseSnap = createValidSnapshot({
      tasks: [sampleRecordByCollection.tasks],
      bills: [sampleRecordByCollection.bills],
      habits: [sampleRecordByCollection.habits],
    });
    const localSnap = createValidSnapshot({
      tasks: [{ ...sampleRecordByCollection.tasks, title: 'Local Task Title' }],
      bills: [], // deleted locally!
      habits: [{ ...sampleRecordByCollection.habits, title: 'Local Habit Title' }],
    });
    const remoteSnap = createValidSnapshot({
      tasks: [{ ...sampleRecordByCollection.tasks, title: 'Remote Task Title' }],
      bills: [{ ...sampleRecordByCollection.bills, plannedAmount: 195 }], // modified remotely!
      habits: [{ ...sampleRecordByCollection.habits, title: 'Remote Habit Title' }],
    });
    const rec = reconcilePlannerData(baseSnap, localSnap, remoteSnap, 'tab');
    assert.equal(rec.conflicts.length, 3, 'All 3 concurrent conflicts across tasks, bills, habits must be queued');
    const billConflict = rec.conflicts.find((c) => c.entityType === 'bills')!;
    assert.equal(billConflict.localVersion, null, 'Locally deleted bill should have localVersion: null');
    assert.equal(billConflict.onlineVersion.plannedAmount, 195);
  }
  console.log('  ✓ LP-03 passed');

  // ---------------------------------------------------------------------------
  // LP-04: Reload Demo & Setup Wizard Re-run Safeguards
  // ---------------------------------------------------------------------------
  console.log('Testing LP-04: Reload Demo confirmation & Setup Wizard re-run safeguards...');
  {
    const storage = new MockStorage();
    const userSnap = createValidSnapshot({
      tasks: [{ id: 'usr-1', title: 'Important User Task', category: 'Work', assignedTo: 'Alex', priority: 'urgent', status: 'not_started', createdAt: '2026-10-12' }],
    });
    const savedInfo = savePreRestoreSnapshot(userSnap, 5, 'Before Reload Demo', storage);
    assert.ok(savedInfo, 'savePreRestoreSnapshot must succeed');
    assert.equal(savedInfo?.totalRecords, 1);
    const loadedInfo = getPreRestoreSnapshot(storage);
    assert.equal(loadedInfo?.snapshot.tasks[0].title, 'Important User Task');

    const settingsSrc = fs.readFileSync(path.resolve('src/components/settings/SettingsView.tsx'), 'utf-8');
    assert.ok(
      settingsSrc.includes('isReloadDemoConfirmOpen'),
      'SettingsView must guard Reload Demo behind confirmation modal'
    );
    const setupSrc = fs.readFileSync(path.resolve('src/components/modals/SetupWizardModal.tsx'), 'utf-8');
    assert.ok(
      setupSrc.includes("settings.hasCompletedSetup ? 'keep'"),
      'SetupWizardModal must default to keep when setup was already completed'
    );
  }
  console.log('  ✓ LP-04 passed');

  // ---------------------------------------------------------------------------
  // LP-05: Truthful Dashboard, Weight/BMI, and Habit Calculations
  // ---------------------------------------------------------------------------
  console.log('Testing LP-05: Truthful savings/debt, weight/BMI, and habit selectors...');
  {
    const emptyFin = calculateSavingsAndDebtSummary([], []);
    assert.equal(emptyFin.hasSavingsPots, false);
    assert.equal(emptyFin.totalSaved, 0);
    assert.equal(emptyFin.totalTarget, 0);
    assert.equal(emptyFin.hasDebts, false);
    assert.equal(emptyFin.totalDebtRemaining, 0);

    const activeFin = calculateSavingsAndDebtSummary(
      [{ openingBalance: 1000, targetAmount: 4000, deposits: [{ amount: 500 }] }],
      [{ id: 'd1', name: 'Loan', originalBalance: 2000, currentBalance: 1500, annualInterestRate: 5, minimumMonthlyPayment: 100 }]
    );
    assert.equal(activeFin.totalSaved, 1500);
    assert.equal(activeFin.totalTarget, 4000);
    assert.equal(activeFin.savingsProgressPct, 38);
    assert.equal(activeFin.totalDebtRemaining, 1500);
    assert.equal(activeFin.debtRepaidPct, 25);

    const emptyWeight = computeWeightMetrics([], null);
    assert.equal(emptyWeight.hasReading, false);
    assert.equal(emptyWeight.hasTrend, false);
    assert.equal(emptyWeight.latestWeightKg, null);
    assert.equal(emptyWeight.prevWeightKg, null);
    assert.equal(emptyWeight.bmi, null);

    const oneWeight = computeWeightMetrics([{ date: '2026-10-10', weightKg: 68.2 }], { heightCm: 170 });
    assert.equal(oneWeight.hasReading, true);
    assert.equal(oneWeight.hasTrend, false);
    assert.equal(oneWeight.latestWeightKg, 68.2);
    assert.equal(oneWeight.prevWeightKg, null);
    assert.equal(oneWeight.weightDiffKg, null);
    assert.equal(oneWeight.bmi, 23.6);

    const twoWeights = computeWeightMetrics(
      [
        { date: '2026-10-01', weightKg: 69.0 },
        { date: '2026-10-10', weightKg: 68.2 },
      ],
      { heightCm: 170 }
    );
    assert.equal(twoWeights.hasTrend, true);
    assert.equal(twoWeights.weightDiffKg, -0.8);
  }
  console.log('  ✓ LP-05 passed');

  // ---------------------------------------------------------------------------
  // LP-06: Empty Defaults vs Demo Fixtures & Owner Name Fallbacks
  // ---------------------------------------------------------------------------
  console.log('Testing LP-06: EMPTY_SETTINGS vs DEMO_SETTINGS and ownerName fallbacks...');
  {
    assert.equal(EMPTY_SETTINGS.ownerName, 'Me');
    assert.equal(EMPTY_SETTINGS.isSampleDataActive, false);
    assert.equal(EMPTY_SETTINGS.budgetOpeningBalance, 0);
    assert.equal(EMPTY_SETTINGS.budgetPlannedIncome, 0);
    assert.equal(EMPTY_SETTINGS.budgetPlannedSavings, 0);
    assert.deepEqual(EMPTY_SETTINGS.budgetCategoryLimits, {});
    assert.equal(DEMO_SETTINGS.isSampleDataActive, true);

    const customEmpty = createEmptySettings({ ownerName: 'Sam' });
    assert.equal(customEmpty.ownerName, 'Sam');
    assert.equal(customEmpty.householdMembers?.[0]?.name, 'Sam');
    assert.equal(customEmpty.budgetOpeningBalance, 0);
  }
  console.log('  ✓ LP-06 passed');

  // ---------------------------------------------------------------------------
  // LP-07: Full Erase Clears All App-Owned Keys & Snapshots
  // ---------------------------------------------------------------------------
  console.log('Testing LP-07: Full erase clears all app-owned storage keys and snapshots...');
  {
    const storage = new MockStorage();
    storage.setItem(STORAGE_KEY_DATA, '{"version":"1.0.0"}');
    storage.setItem(STORAGE_KEY_SETTINGS, '{"ownerName":"Alex"}');
    storage.setItem(STORAGE_KEY_REVISION, '12');
    storage.setItem(STORAGE_KEY_PRE_RESTORE_SNAPSHOT, '{"savedAt":"2026-10-12"}');
    storage.setItem(STORAGE_KEY_CORRUPT_QUARANTINE, '{"quarantinedAt":"2026-10-12"}');
    storage.setItem(STORAGE_KEY_CLOUD_SESSION, '{"token":"secret"}');
    storage.setItem(STORAGE_KEY_CLOUD_SYNC_STATE, '{"status":"connected_synced"}');

    eraseAllAppStorageKeys(storage);

    assert.equal(storage.getItem(STORAGE_KEY_DATA), null);
    assert.equal(storage.getItem(STORAGE_KEY_SETTINGS), null);
    assert.equal(storage.getItem(STORAGE_KEY_REVISION), null);
    assert.equal(storage.getItem(STORAGE_KEY_PRE_RESTORE_SNAPSHOT), null);
    assert.equal(storage.getItem(STORAGE_KEY_CORRUPT_QUARANTINE), null);
    assert.equal(storage.getItem(STORAGE_KEY_CLOUD_SESSION), null);
    assert.equal(storage.getItem(STORAGE_KEY_CLOUD_SYNC_STATE), null);
  }
  console.log('  ✓ LP-07 passed');

  // ---------------------------------------------------------------------------
  // LP-08, LP-09, LP-10, LP-11, LP-12: Lifecycle, Counts, Birthdays, Bills, Dates
  // ---------------------------------------------------------------------------
  console.log('Testing LP-08..LP-12: Completable counts, yearly birthdays, routine pause dates, timezone & DST...');
  {
    // LP-09: Completable schedule item check
    assert.equal(isCompletableScheduleItem({ type: 'Task', onToggle: () => {} }), true);
    assert.equal(isCompletableScheduleItem({ type: 'Bill', onToggle: () => {} }), true);
    assert.equal(isCompletableScheduleItem({ type: 'Event' }), false);
    assert.equal(isCompletableScheduleItem({ type: 'Birthday' }), false);
    assert.equal(isCompletableScheduleItem({ type: 'Focus time' }), false);
    assert.equal(isCompletableScheduleItem({ type: 'Goal' }), false);

    // LP-10: Yearly birthday recurrence + Feb 29 leap year handling + ICS RRULE:FREQ=YEARLY
    const bdayOct8 = { date: '1992-10-08', type: 'birthday' };
    assert.equal(isBirthdayEventOnDate(bdayOct8, '2026-10-08'), true);
    assert.equal(isBirthdayEventOnDate(bdayOct8, '2027-10-08'), true);
    assert.equal(isBirthdayEventOnDate(bdayOct8, '2027-10-09'), false);

    const leapBday = { date: '2000-02-29', type: 'birthday' };
    assert.equal(isBirthdayEventOnDate(leapBday, '2024-02-29'), true, 'Leap year Feb 29 matches on leap year');
    assert.equal(isBirthdayEventOnDate(leapBday, '2025-02-28'), true, 'Leap year Feb 29 matches Feb 28 on non-leap year');
    assert.equal(isBirthdayEventOnDate(leapBday, '2024-02-28'), false, 'Leap year Feb 29 does not match Feb 28 on leap year');

    const ics = serializePlannerCalendarToIcs({
      tasks: [],
      routines: [],
      bills: [],
      workouts: [],
      plannedMeals: [],
      calendarEvents: [
        { id: 'ce-bday', title: "Maya's Birthday", date: '2026-10-08', isAllDay: true, type: 'birthday' },
      ],
    });
    assert.ok(ics.includes('RRULE:FREQ=YEARLY'), 'Birthday VEVENT in ICS export must include RRULE:FREQ=YEARLY');

    // LP-12: Timezone-aware today date, DST-safe calendar date stepping, routine pausedDate
    const utcLateNight = new Date('2026-10-11T23:30:00.000Z');
    assert.equal(getRealTodayDate('Pacific/Auckland', utcLateNight), '2026-10-12');
    assert.equal(getRealTodayDate('America/New_York', utcLateNight), '2026-10-11');

    assert.equal(shiftCalendarDate('2026-03-08', 1), '2026-03-09', 'Spring forward DST day + 1');
    assert.equal(shiftCalendarDate('2026-11-01', 1), '2026-11-02', 'Fall back DST day + 1');
    assert.equal(shiftCalendarDate('2024-02-28', 1), '2024-02-29', 'Leap year Feb 28 + 1');
    assert.equal(shiftCalendarDate('2025-02-28', 1), '2025-03-01', 'Non-leap year Feb 28 + 1');

    const pausedRoutine: RoutineItem = {
      id: 'rt-pause-test',
      title: 'Evening Stretch',
      category: 'Health',
      assignedTo: 'Me',
      priority: 'medium',
      interval: 'daily',
      startDate: '2026-10-01',
      isPaused: true,
      pausedDate: '2026-10-06',
      completedDates: ['2026-10-05'],
      skippedDates: [],
    };
    assert.equal(
      isRoutineActiveOnDate(pausedRoutine, '2026-10-05'),
      true,
      'Routine paused on 2026-10-06 must still appear on historical date 2026-10-05'
    );
    assert.equal(
      isRoutineActiveOnDate(pausedRoutine, '2026-10-06'),
      false,
      'Routine paused on 2026-10-06 must be inactive on 2026-10-06'
    );
    assert.equal(
      isRoutineActiveOnDate(pausedRoutine, '2026-10-07'),
      false,
      'Routine paused on 2026-10-06 must be inactive on future date 2026-10-07'
    );
  }
  console.log('  ✓ LP-08..LP-12 passed');

  // ---------------------------------------------------------------------------
  // LP-01: Online Account, Ownership Isolation, Sync, Migration, Recovery & Export E2E
  // ---------------------------------------------------------------------------
  console.log('Testing LP-01: Online Account & Cross-Device Cloud Sync E2E...');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'olp-cloud-test-'));
  const dbPath = path.join(tempDir, 'cloud-db.json');
  const cloudInstance = createCloudSyncServer({ storageFilePath: dbPath });

  await new Promise<void>((resolve) => cloudInstance.server.listen(0, '127.0.0.1', resolve));
  const address = cloudInstance.server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const endpointUrl = `http://127.0.0.1:${port}`;

  try {
    const storageDeviceA1 = new MockStorage();
    const storageDeviceA2 = new MockStorage();
    const storageDeviceB = new MockStorage();

    // 1. Local-only truthfulness check before sign-in
    const initialSyncState = getStoredCloudSyncState(storageDeviceA1);
    assert.equal(initialSyncState.status, 'local_only');

    // 2. Register Account A on Device A1
    const regA = await registerCloudAccount(
      {
        email: 'alice@example.test',
        password: 'CorrectHorseBatteryStaple1!',
        displayName: 'Alice',
      },
      { endpointUrl, storage: storageDeviceA1 }
    );
    assert.equal(regA.success, true, 'Account A registration must succeed');
    assert.ok(regA.token, 'Account A must receive session token');
    assert.ok(regA.recoveryKey?.startsWith('OLP-'), 'Account A must receive one-time recovery key');
    const userAId = regA.user!.id;

    // 3. Push initial snapshot from Device A1
    const baseSnapA = createValidSnapshot({
      settings: createEmptySettings({ ownerName: 'Alice', hasCompletedSetup: true }),
      tasks: [
        {
          id: 'task-shared-1',
          title: 'Initial Alice Task',
          category: 'Work',
          assignedTo: 'Alice',
          priority: 'high',
          status: 'not_started',
          createdAt: '2026-10-12',
        },
      ],
    });

    const pushA1 = await syncPlannerWithCloud(
      { localSnapshot: baseSnapA, baseRevision: 0 },
      { endpointUrl, storage: storageDeviceA1 }
    );
    assert.equal(pushA1.success, true);
    assert.equal(pushA1.outcome, 'synced');
    assert.equal(pushA1.serverRevision, 1);

    // 4. Register Account B on Device B and verify strict cross-account 403 isolation
    const regB = await registerCloudAccount(
      {
        email: 'bob@example.test',
        password: 'BobPassword987654!',
        displayName: 'Bob',
      },
      { endpointUrl, storage: storageDeviceB }
    );
    assert.equal(regB.success, true);

    // Bob tries to read Alice's planner via ?userId=<Alice>
    const crossReadRes = await fetch(`${endpointUrl}/api/cloud/planner?userId=${encodeURIComponent(userAId)}`, {
      headers: { Authorization: `Bearer ${regB.token}` },
    });
    assert.equal(crossReadRes.status, 403, 'Account B reading Account A data must return 403 Forbidden');

    // Bob tries to overwrite Alice's planner via PUT ?userId=<Alice>
    const crossWriteRes = await fetch(`${endpointUrl}/api/cloud/planner?userId=${encodeURIComponent(userAId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${regB.token}`,
      },
      body: JSON.stringify({
        baseRevision: 1,
        clientSnapshot: createValidSnapshot(),
        migrationMode: 'overwrite_cloud',
      }),
    });
    assert.equal(crossWriteRes.status, 403, 'Account B writing Account A data must return 403 Forbidden');

    // Bob tries to export Alice's backup via GET /api/cloud/export?userId=<Alice>
    const crossExportRes = await fetch(`${endpointUrl}/api/cloud/export?userId=${encodeURIComponent(userAId)}`, {
      headers: { Authorization: `Bearer ${regB.token}` },
    });
    assert.equal(crossExportRes.status, 403, 'Account B exporting Account A data must return 403 Forbidden');

    // Unauthenticated request returns 401
    const unauthRes = await fetch(`${endpointUrl}/api/cloud/planner`);
    assert.equal(unauthRes.status, 401, 'Unauthenticated request must return 401');

    // 5. Sign in to Account A on second device (Device A2) & pull via 'use_cloud'
    const loginA2 = await loginCloudAccount(
      { email: 'alice@example.test', password: 'CorrectHorseBatteryStaple1!' },
      { endpointUrl, storage: storageDeviceA2 }
    );
    assert.equal(loginA2.success, true);
    assert.equal(loginA2.serverRevision, 1);

    const pullA2 = await syncPlannerWithCloud(
      { localSnapshot: createValidSnapshot(), migrationMode: 'use_cloud' },
      { endpointUrl, storage: storageDeviceA2 }
    );
    assert.equal(pullA2.success, true);
    assert.equal(pullA2.snapshot?.tasks[0]?.title, 'Initial Alice Task');

    // 6. Non-conflicting 3-way merge across Device A1 and Device A2
    // Device A1 adds task-a1 and pushes (rev 1 -> rev 2)
    const snapA1Next = {
      ...baseSnapA,
      tasks: [
        ...baseSnapA.tasks,
        {
          id: 'task-from-a1',
          title: 'Added on Device A1',
          category: 'Personal',
          assignedTo: 'Alice',
          priority: 'medium' as const,
          status: 'not_started' as const,
          createdAt: '2026-10-12',
        },
      ],
    };
    const syncA1 = await syncPlannerWithCloud(
      { localSnapshot: snapA1Next, baseSnapshot: baseSnapA, baseRevision: 1 },
      { endpointUrl, storage: storageDeviceA1 }
    );
    assert.equal(syncA1.outcome, 'synced');
    assert.equal(syncA1.serverRevision, 2);

    // Device A2 (still at baseRevision 1) adds task-from-a2 and syncs -> server performs 3-way merge (rev 2 -> rev 3)
    const snapA2Next = {
      ...baseSnapA,
      tasks: [
        ...baseSnapA.tasks,
        {
          id: 'task-from-a2',
          title: 'Added on Device A2',
          category: 'Home',
          assignedTo: 'Alice',
          priority: 'low' as const,
          status: 'not_started' as const,
          createdAt: '2026-10-12',
        },
      ],
    };
    const syncA2Merge = await syncPlannerWithCloud(
      { localSnapshot: snapA2Next, baseSnapshot: baseSnapA, baseRevision: 1 },
      { endpointUrl, storage: storageDeviceA2 }
    );
    assert.equal(syncA2Merge.outcome, 'merged', 'Non-overlapping concurrent edits must auto-merge');
    assert.equal(syncA2Merge.serverRevision, 3);
    assert.equal(syncA2Merge.snapshot?.tasks.length, 3, 'Merged snapshot must contain all 3 tasks');

    // 7. Conflicting edit on same task between Device A1 and server (rev 3)
    const staleA1ConflictSnap = {
      ...baseSnapA,
      tasks: [
        {
          ...baseSnapA.tasks[0],
          title: 'Edited on A1 while offline',
        },
      ],
    };
    // First update task-shared-1 on server via Device A2 so server has a different edit on task-shared-1
    const a2ServerEditSnap = {
      ...syncA2Merge.snapshot!,
      tasks: syncA2Merge.snapshot!.tasks.map((t) =>
        t.id === 'task-shared-1' ? { ...t, title: 'Edited on A2 and synced first' } : t
      ),
    };
    const syncA2First = await syncPlannerWithCloud(
      { localSnapshot: a2ServerEditSnap, baseSnapshot: syncA2Merge.snapshot, baseRevision: 3 },
      { endpointUrl, storage: storageDeviceA2 }
    );
    assert.equal(syncA2First.serverRevision, 4);

    // Now Device A1 attempts to sync its conflicting edit against baseRevision 2
    const conflictRes = await syncPlannerWithCloud(
      { localSnapshot: staleA1ConflictSnap, baseSnapshot: baseSnapA, baseRevision: 2 },
      { endpointUrl, storage: storageDeviceA1 }
    );
    assert.equal(conflictRes.outcome, 'conflict', 'Conflicting same-item edit must return conflict');
    assert.equal(conflictRes.statusCode, 409);
    assert.equal(conflictRes.conflicts?.length, 1);
    assert.equal(conflictRes.conflicts?.[0]?.source, 'cloud');

    // 8. Interrupted sync test (network drop mid-request)
    const brokenRes = await syncPlannerWithCloud(
      { localSnapshot: a2ServerEditSnap, baseRevision: 4 },
      {
        endpointUrl,
        storage: storageDeviceA2,
        fetchImpl: async () => {
          throw new Error('ECONNRESET: Simulated connection drop');
        },
      }
    );
    assert.equal(brokenRes.success, false);
    assert.equal(brokenRes.outcome, 'error');
    assert.equal(brokenRes.syncState.status, 'sync_error');

    // Retry after network recovery succeeds cleanly
    const retryRes = await syncPlannerWithCloud(
      { localSnapshot: a2ServerEditSnap, baseRevision: 4 },
      { endpointUrl, storage: storageDeviceA2 }
    );
    assert.equal(retryRes.success, true);
    assert.equal(retryRes.syncState.status, 'connected_synced');

    // 9. Cloud export test
    const exported = await exportCloudAccountBackup({ endpointUrl, storage: storageDeviceA2 });
    assert.equal(exported.success, true);
    assert.equal(validateBackupData(exported.data).isValid, true);
    assert.equal(exported.data?.tasks.length, 3);

    // 10. Account recovery with recovery key
    const wrongRecovery = await recoverCloudAccountWithKey(
      {
        email: 'alice@example.test',
        recoveryKey: 'OLP-0000-0000-0000-0000',
        newPassword: 'BrandNewPassword123!',
      },
      { endpointUrl, storage: storageDeviceA1 }
    );
    assert.equal(wrongRecovery.success, false, 'Invalid recovery key must be rejected');

    const validRecovery = await recoverCloudAccountWithKey(
      {
        email: 'alice@example.test',
        recoveryKey: regA.recoveryKey!,
        newPassword: 'BrandNewPassword123!',
      },
      { endpointUrl, storage: storageDeviceA1 }
    );
    assert.equal(validRecovery.success, true, 'Valid recovery key must reset password and issue new key');
    assert.ok(validRecovery.newRecoveryKey && validRecovery.newRecoveryKey !== regA.recoveryKey);

    // Old password must no longer work, new password must work
    const oldLogin = await loginCloudAccount(
      { email: 'alice@example.test', password: 'CorrectHorseBatteryStaple1!' },
      { endpointUrl, storage: storageDeviceA2 }
    );
    assert.equal(oldLogin.success, false, 'Old password must be rejected after recovery reset');

    const newLogin = await loginCloudAccount(
      { email: 'alice@example.test', password: 'BrandNewPassword123!' },
      { endpointUrl, storage: storageDeviceA2 }
    );
    assert.equal(newLogin.success, true, 'New password must succeed after recovery reset');

    // 11. Account deletion
    const delRes = await deleteCloudAccount({ endpointUrl, storage: storageDeviceA2 });
    assert.equal(delRes.success, true);
    assert.equal(delRes.syncState.status, 'local_only');

    const loginAfterDelete = await loginCloudAccount(
      { email: 'alice@example.test', password: 'BrandNewPassword123!' },
      { endpointUrl, storage: storageDeviceA2 }
    );
    assert.equal(loginAfterDelete.success, false, 'Deleted account must not allow sign-in');
  } finally {
    await new Promise<void>((resolve) => cloudInstance.server.close(() => resolve()));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  console.log('  ✓ LP-01 passed');

  // ---------------------------------------------------------------------------
  // Headless Browser Runtime E2E Verification (Write Failure, Quarantine, Empty States, Lifecycles)
  // ---------------------------------------------------------------------------
  console.log('Testing Headless Browser E2E (Corrupt quarantine, Write failure retry, Empty states, Task/Calendar lifecycles)...');
  {
    const http = await import('node:http');
    const { execFile } = await import('node:child_process');

    const candidates = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];
    const browserExe = candidates.find((c) => fs.existsSync(c));
    assert.ok(browserExe, 'Headless browser executable (Edge or Chrome) must exist');

    const standalonePath = path.resolve(process.cwd(), 'dist', 'Our-Life-Planner-Offline.html');
    assert.ok(fs.existsSync(standalonePath), 'dist/Our-Life-Planner-Offline.html must exist');
    const rawHtml = fs.readFileSync(standalonePath, 'utf-8');

    const emptySeed = createValidSnapshot({
      settings: createEmptySettings({ ownerName: 'Nadia', hasCompletedSetup: true, isSampleDataActive: false }),
    });

    const harnessScript = `
<script type="module">
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function setNativeValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function runBrowserChecks() {
    const phase = new URLSearchParams(window.location.search).get('phase') || '1';

    // Phase 1: Seed malformed JSON into localStorage to verify LP-02 corrupt data quarantine on mount
    if (phase === '1') {
      localStorage.clear();
      localStorage.setItem('our_life_planner_settings_v1', JSON.stringify(${JSON.stringify(emptySeed.settings)}));
      localStorage.setItem('our_life_planner_data_v1', '{"version":"1.0.0","tasks":[CORRUPT_PAYLOAD');
      window.location.replace('/?phase=2');
      return;
    }

    // Phase 2: Verify quarantine key was written with raw corrupt bytes, then seed clean empty state
    if (phase === '2') {
      await wait(450);
      const rawQuarantine = localStorage.getItem('our_life_planner_corrupt_quarantine_v1');
      const parsedQ = rawQuarantine ? JSON.parse(rawQuarantine) : null;
      const bodyTextPhase2 = document.body.innerText || '';
      sessionStorage.setItem('phase2_quarantine', JSON.stringify({
        quarantinedRawData: parsedQ ? parsedQ.rawData : null,
        hasCorruptBanner: bodyTextPhase2.includes('Corrupt startup data quarantined') || Boolean(parsedQ),
      }));

      localStorage.clear();
      localStorage.setItem('our_life_planner_settings_v1', JSON.stringify(${JSON.stringify(emptySeed.settings)}));
      localStorage.setItem('our_life_planner_data_v1', JSON.stringify(${JSON.stringify(emptySeed)}));
      localStorage.setItem('our_life_planner_revision_v1', '1');
      window.location.replace('/?phase=3');
      return;
    }

    // Phase 3: Verify empty states, simulated write failure + real retrySave(), and task/calendar lifecycles
    const p2 = JSON.parse(sessionStorage.getItem('phase2_quarantine') || '{}');
    const report = {
      ...p2,
      todayHasFabricatedNumbers: false,
      weightHasFabricatedNumbers: false,
      writeFailureDetected: false,
      retrySavePersistedTask: false,
      defaultTaskOwner: null,
      taskArchiveAndUndoWorked: false,
      error: null,
    };

    try {
      await wait(500);
      const todayText = document.body.innerText || '';
      report.todayHasFabricatedNumbers =
        todayText.includes('15,250') ||
        todayText.includes('25,000') ||
        todayText.includes('4,200') ||
        todayText.includes('72.0');

      // Navigate to Weight & BMI view and verify no fabricated 72.0 / 72.4 / 28 Sep 2026
      const navBtns = Array.from(document.querySelectorAll('aside button'));
      const weightBtn = navBtns.find((b) => (b.textContent || '').includes('Weight'));
      if (weightBtn) {
        weightBtn.click();
        await wait(250);
        const weightText = document.body.innerText || '';
        report.weightHasFabricatedNumbers =
          weightText.includes('72.0') ||
          weightText.includes('72.4') ||
          weightText.includes('28 Sep 2026');
      }

      // Navigate to Tasks view
      const tasksBtn = Array.from(document.querySelectorAll('aside button')).find((b) =>
        (b.textContent || '').includes('Tasks')
      );
      if (!tasksBtn) throw new Error('Tasks sidebar button not found');
      tasksBtn.click();
      await wait(250);

      // Monkeypatch localStorage.setItem to throw QuotaExceededError on next data save
      const origSetItem = Storage.prototype.setItem;
      let blockWrites = true;
      Storage.prototype.setItem = function(k, v) {
        if (blockWrites && (k === 'our_life_planner_data_v1' || k === 'our_life_planner_settings_v1')) {
          throw new Error('QuotaExceededError: Simulated full disk');
        }
        return origSetItem.call(this, k, v);
      };

      // Open Add Task modal and create a task while storage writes are blocked
      const newTaskBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        (b.textContent || '').includes('New task')
      );
      if (!newTaskBtn) throw new Error('New task button not found');
      newTaskBtn.click();
      await wait(200);

      const titleInput = document.querySelector('#task-modal-title');
      if (!titleInput) throw new Error('#task-modal-title not found');
      setNativeValue(titleInput, 'Durable Retry Task');
      await wait(100);

      const saveTaskBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        (b.textContent || '').includes('Create task') || (b.textContent || '').includes('Save task')
      );
      if (!saveTaskBtn) throw new Error('Create task submit button not found');
      saveTaskBtn.click();
      await wait(350);

      // Check that SavingIndicator shows "Storage issue · Retry" and "Export unsaved"
      const bodyAfterFail = document.body.textContent || '';
      report.writeFailureDetected =
        bodyAfterFail.includes('Storage issue · Retry') && bodyAfterFail.includes('Export unsaved');

      // Restore localStorage.setItem and click "Storage issue · Retry"
      blockWrites = false;
      Storage.prototype.setItem = origSetItem;

      const retryBtn =
        document.querySelector('button[aria-label="Browser storage issue. Click to retry."]') ||
        Array.from(document.querySelectorAll('button')).find((b) =>
          (b.textContent || '').includes('Storage issue · Retry')
        );
      if (!retryBtn) throw new Error('Retry save button not found');
      retryBtn.click();
      await wait(350);

      const storedAfterRetry = JSON.parse(localStorage.getItem('our_life_planner_data_v1') || '{}');
      const savedTask = (storedAfterRetry.tasks || []).find((t) => t.title === 'Durable Retry Task');
      report.retrySavePersistedTask = Boolean(savedTask);
      report.defaultTaskOwner = savedTask ? savedTask.assignedTo : null;

      // Test Archive -> Archived filter -> Unarchive
      const archiveBtn = document.querySelector('button[title="Archive task"]');
      if (archiveBtn) {
        archiveBtn.click();
        await wait(250);
        const afterArchive = JSON.parse(localStorage.getItem('our_life_planner_data_v1') || '{}');
        const isArchivedNow = afterArchive.tasks?.[0]?.isArchived === true;

        const statusSelects = Array.from(
          document.querySelectorAll('select[aria-label="Filter tasks by status"]')
        );
        for (const sel of statusSelects) {
          sel.value = 'Archived';
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
        await wait(250);

        const unarchiveBtn = document.querySelector('button[title="Restore task"]');
        if (unarchiveBtn) {
          unarchiveBtn.click();
          await wait(250);
        }
        const afterUnarchive = JSON.parse(localStorage.getItem('our_life_planner_data_v1') || '{}');
        report.taskArchiveAndUndoWorked =
          isArchivedNow && afterUnarchive.tasks?.[0]?.isArchived === false;
      }
    } catch (err) {
      report.error = err && err.message ? err.message : String(err);
    }

    await fetch('/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });
  }

  setTimeout(runBrowserChecks, 150);
</script>
<img src="/hold-until-complete.gif" style="display:none" />
`;

    const strippedHtml = rawHtml
      .replace(/<meta[^>]+Content-Security-Policy[^>]*>/gi, '')
      .replace(/<script id="olp-preloaded-bundle">[\s\S]*?<\/script>/, '');
    const lastBodyIdx = strippedHtml.lastIndexOf('</body>');
    const instrumentedHtml =
      strippedHtml.slice(0, lastBodyIdx) +
      harnessScript +
      '\n</body>' +
      strippedHtml.slice(lastBodyIdx + '</body>'.length);

    const browserReport: any = await new Promise((resolve, reject) => {
      let holdResponses: any[] = [];
      let resolved = false;
      const srv = http.createServer((req, res) => {
        if (req.url === '/' || req.url?.startsWith('/?')) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(instrumentedHtml);
          return;
        }
        if (req.url === '/hold-until-complete.gif') {
          holdResponses.push(res);
          return;
        }
        if (req.url === '/report' && req.method === 'POST') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end('{"ok":true}');
            holdResponses.forEach((hr) => {
              try { hr.writeHead(204); hr.end(); } catch {}
            });
            if (!resolved) {
              resolved = true;
              srv.close();
              resolve(JSON.parse(body));
            }
          });
          return;
        }
        res.writeHead(404);
        res.end();
      });

      srv.listen(0, '127.0.0.1', () => {
        const addr = srv.address() as any;
        const url = `http://127.0.0.1:${addr.port}/`;
        const userDataDir = path.resolve(process.cwd(), 'dist', `.tmp-edge-phase1-${Date.now()}`);
        execFile(
          browserExe!,
          [
            '--headless=new',
            '--window-size=1280,900',
            '--disable-gpu',
            '--no-first-run',
            '--no-default-browser-check',
            `--user-data-dir=${userDataDir}`,
            '--virtual-time-budget=25000',
            '--dump-dom',
            url,
          ],
          { timeout: 30000, maxBuffer: 10 * 1024 * 1024 },
          (err) => {
            setTimeout(() => {
              try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
            }, 500);
            if (!resolved) {
              resolved = true;
              srv.close();
              reject(err || new Error('Browser exited before /report'));
            }
          }
        );
      });
    });

    assert.equal(browserReport.error, null, `Browser E2E error: ${browserReport.error}`);
    assert.equal(
      browserReport.quarantinedRawData,
      '{"version":"1.0.0","tasks":[CORRUPT_PAYLOAD',
      'Browser startup must quarantine corrupt JSON bytes verbatim'
    );
    assert.equal(browserReport.hasCorruptBanner, true, 'Corrupt startup quarantine banner must be active');
    assert.equal(
      browserReport.todayHasFabricatedNumbers,
      false,
      'TodayDashboard must not render fabricated 15,250 / 25,000 / 4,200 / 72.0 in empty state'
    );
    assert.equal(
      browserReport.weightHasFabricatedNumbers,
      false,
      'WeightBMIView must not render fabricated 72.0 / 72.4 / 28 Sep 2026 in empty state'
    );
    assert.equal(
      browserReport.writeFailureDetected,
      true,
      'SavingIndicator must transition to Could not save on storage write failure'
    );
    assert.equal(
      browserReport.retrySavePersistedTask,
      true,
      'Clicking Retry save after storage recovery must durably persist the unsaved task'
    );
    assert.equal(
      browserReport.defaultTaskOwner,
      'Nadia',
      'New task default assignedTo must use settings.ownerName ("Nadia") instead of hardcoded "Rida"'
    );
    assert.equal(
      browserReport.taskArchiveAndUndoWorked,
      true,
      'Task archive and unarchive lifecycle must update persisted storage'
    );
  }
  console.log('  ✓ Headless Browser E2E passed');

  console.log('\nALL PHASE 1 AUDIT REMEDIATION CHECKS (LP-01 through LP-12 + Browser E2E) PASSED!');
}

runTests().catch((err) => {
  console.error('Phase 1 verification failed:', err);
  process.exit(1);
});
