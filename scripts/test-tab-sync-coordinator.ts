import {
  reconcilePlannerData,
} from '../src/utils/storageCoordinator';
import { PlannerBackupData, TaskItem, BillItem, HydrationLogEntry, GroceryItem } from '../src/types/planner';
import { INITIAL_SETTINGS } from '../src/utils/sampleData';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✓ PASS: ${message}`);
}

console.log('=== RUNNING MULTI-TAB SYNC & RECONCILIATION TESTS ===\n');

// 1. Base dataset setup
const baseTasks: TaskItem[] = [
  {
    id: 'task-1',
    title: 'Review weekly plan',
    category: 'Work',
    assignedTo: 'Owner',
    priority: 'high',
    status: 'not_started',
    createdAt: '2026-10-06T08:00:00Z',
    dueDate: '2026-10-06',
  },
  {
    id: 'task-2',
    title: 'Grocery run',
    category: 'Errands',
    assignedTo: 'Owner',
    priority: 'medium',
    status: 'not_started',
    createdAt: '2026-10-06T08:00:00Z',
    dueDate: '2026-10-06',
  },
];

const baseBills: BillItem[] = [
  {
    id: 'bill-1',
    title: 'Fiber Internet',
    plannedAmount: 55,
    dueDate: '2026-10-15',
    category: 'Home',
    isPaid: false,
    repeatInterval: 'monthly',
  },
];

const baseHydration: HydrationLogEntry[] = [
  { id: 'w-1', time: '08:30', amountMl: 250, date: '2026-10-06' },
];

const baseGroceries: GroceryItem[] = [
  {
    id: 'g-1',
    name: 'Milk',
    amount: 1,
    unit: 'L',
    category: 'Chilled',
    isPurchased: false,
    sourceType: 'manual',
  },
];

const baseBackup: PlannerBackupData = {
  version: '1.0.0',
  revision: 1,
  exportedAt: '2026-10-06T08:00:00Z',
  settings: { ...INITIAL_SETTINGS, theme: 'light', currency: 'USD' },
  tasks: baseTasks,
  routines: [],
  goals: [],
  habits: [],
  inbox: [],
  transactions: [],
  bills: baseBills,
  savingsPots: [],
  debts: [],
  recipes: [],
  plannedMeals: [],
  groceries: baseGroceries,
  workouts: [],
  weightProfiles: [],
  weightRecords: [],
  hydrationEntries: baseHydration,
  hydrationTargets: [{ date: '2026-10-06', targetMl: 2000 }],
  calendarEvents: [],
};

// TEST CASE 1: The exact user scenario
// Tab A creates a new task (saved in stored).
// Tab B (stale, did not refresh) logs water.
// Tab B must NOT overwrite Tab A's new task!
const tabAStored: PlannerBackupData = {
  ...baseBackup,
  revision: 2,
  tasks: [
    ...baseTasks,
    {
      id: 'task-new-A',
      title: 'New urgent task created in Tab A',
      category: 'Work',
      assignedTo: 'Owner',
      priority: 'urgent',
      status: 'not_started',
      createdAt: '2026-10-06T09:00:00Z',
      dueDate: '2026-10-06',
    },
  ],
};

const tabBLocal: PlannerBackupData = {
  ...baseBackup,
  revision: 1,
  hydrationEntries: [
    ...baseHydration,
    { id: 'w-new-B', time: '14:00', amountMl: 500, date: '2026-10-06' },
  ],
};

const recon1 = reconcilePlannerData(baseBackup, tabBLocal, tabAStored);

assert(
  recon1.mergedData.tasks.length === 3,
  'Merged data contains 3 tasks (original 2 + Tab A new task)'
);
assert(
  recon1.mergedData.tasks.some((t) => t.id === 'task-new-A'),
  'Tab A new task was preserved and NOT deleted by Tab B'
);
assert(
  recon1.mergedData.hydrationEntries.length === 2,
  'Tab B water log was preserved and merged'
);
assert(
  recon1.mergedData.hydrationEntries.some((w) => w.id === 'w-new-B'),
  'Tab B new water entry w-new-B is present in merged data'
);
assert(
  recon1.hasRemoteChanges === true,
  'Reconciliation reports remote changes so Tab B can update its React state'
);

// TEST CASE 2: Stale grocery / bill state
// In Tab A, user pays bill-1 and checks off Milk.
// Tab B logs water.
// Reconciled data must keep bill-1 paid and Milk checked, NOT reinstate old state!
const tabAStoredWithBillAndGroceries: PlannerBackupData = {
  ...baseBackup,
  revision: 2,
  bills: [{ ...baseBills[0], isPaid: true }],
  groceries: [{ ...baseGroceries[0], isPurchased: true }],
};

const recon2 = reconcilePlannerData(baseBackup, tabBLocal, tabAStoredWithBillAndGroceries);

assert(
  recon2.mergedData.bills[0].isPaid === true,
  'Tab A paid bill remains paid (stale tab B did not reinstate unpaid status)'
);
assert(
  recon2.mergedData.groceries[0].isPurchased === true,
  'Tab A checked grocery item remains purchased'
);
assert(
  recon2.mergedData.hydrationEntries.some((w) => w.id === 'w-new-B'),
  'Tab B water log is still preserved alongside Tab A bill/grocery updates'
);

// TEST CASE 3: Concurrent additions to the same collection
// Tab A adds task A, Tab B adds task B.
const tabAWithTask: PlannerBackupData = {
  ...baseBackup,
  tasks: [
    ...baseTasks,
    {
      id: 'task-A',
      title: 'Task from Tab A',
      category: 'Work',
      assignedTo: 'Owner',
      priority: 'high',
      status: 'not_started',
      createdAt: '2026-10-06T09:00:00Z',
    },
  ],
};

const tabBWithTask: PlannerBackupData = {
  ...baseBackup,
  tasks: [
    ...baseTasks,
    {
      id: 'task-B',
      title: 'Task from Tab B',
      category: 'Home',
      assignedTo: 'Owner',
      priority: 'low',
      status: 'not_started',
      createdAt: '2026-10-06T09:05:00Z',
    },
  ],
};

const recon3 = reconcilePlannerData(baseBackup, tabBWithTask, tabAWithTask);

assert(
  recon3.mergedData.tasks.length === 4,
  'Both concurrent task additions are preserved (total 4 tasks)'
);
assert(
  recon3.mergedData.tasks.some((t) => t.id === 'task-A') &&
  recon3.mergedData.tasks.some((t) => t.id === 'task-B'),
  'Both task-A and task-B exist in the reconciled collection'
);

// TEST CASE 4: Deletions respected
// Tab A deletes task-1 (which was untouched in Tab B).
const tabADeletedTask1: PlannerBackupData = {
  ...baseBackup,
  tasks: [baseTasks[1]], // only task-2 remains
};

const recon4 = reconcilePlannerData(baseBackup, tabBLocal, tabADeletedTask1);

assert(
  recon4.mergedData.tasks.length === 1 && recon4.mergedData.tasks[0].id === 'task-2',
  'Untouched task deleted in Tab A is cleanly removed without re-surfacing'
);

// TEST CASE 5: Concurrent conflicting edit on the exact same item
// Tab A marks task-1 completed, Tab B changes task-1 title to 'Urgent review'.
const tabACompleted: PlannerBackupData = {
  ...baseBackup,
  tasks: [{ ...baseTasks[0], status: 'completed' }, baseTasks[1]],
};

const tabBEdited: PlannerBackupData = {
  ...baseBackup,
  tasks: [{ ...baseTasks[0], title: 'Urgent review of weekly plan' }, baseTasks[1]],
};

const recon5 = reconcilePlannerData(baseBackup, tabBEdited, tabACompleted);

assert(
  recon5.conflicts.length === 1,
  'Conflict was detected for concurrent conflicting edits on task-1'
);
assert(
  recon5.conflicts[0].id === 'task-1',
  'Conflict item ID correctly identifies task-1'
);

// TEST CASE 6: Independent settings edits merged cleanly
// Tab A changed currency to MAD, Tab B changed theme to dark.
const tabASettings: PlannerBackupData = {
  ...baseBackup,
  settings: { ...baseBackup.settings, currency: 'MAD', currencySymbol: 'DH' },
};

const tabBSettings: PlannerBackupData = {
  ...baseBackup,
  settings: { ...baseBackup.settings, theme: 'dark' },
};

const recon6 = reconcilePlannerData(baseBackup, tabBSettings, tabASettings);

assert(
  recon6.mergedData.settings.currency === 'MAD',
  'Tab A currency change (MAD) preserved'
);
assert(
  recon6.mergedData.settings.theme === 'dark',
  'Tab B theme change (dark) preserved'
);

console.log('\n=== ALL 14 MULTI-TAB RECONCILIATION TESTS PASSED ===');
