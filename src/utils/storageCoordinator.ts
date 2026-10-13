import {
  PlannerBackupData,
  UserSettings,
  ConflictItem,
  TaskItem,
  RoutineItem,
  GoalItem,
  HabitItem,
  BrainDumpItem,
  FinancialTransaction,
  BillItem,
  SavingsPot,
  DebtItem,
  RecipeItem,
  PlannedMeal,
  GroceryItem,
  WorkoutSession,
  WeightProfile,
  WeightRecord,
  HydrationLogEntry,
  DailyHydrationTarget,
  CalendarEvent,
  WeeklyReviewEntry,
  CorruptDataQuarantine,
} from '../types/planner';

export const STORAGE_KEY_DATA = 'our_life_planner_data_v1';
export const STORAGE_KEY_SETTINGS = 'our_life_planner_settings_v1';
export const STORAGE_KEY_REVISION = 'our_life_planner_revision_v1';
export const STORAGE_KEY_MUTEX = 'our_life_planner_mutex_v1';
export const STORAGE_KEY_CORRUPT_QUARANTINE = 'our_life_planner_corrupt_quarantine_v1';
export const STORAGE_KEY_CLOUD_SESSION = 'our_life_planner_cloud_session_v1';
export const STORAGE_KEY_CLOUD_SYNC_STATE = 'our_life_planner_cloud_sync_v1';
export const SYNC_CHANNEL_NAME = 'our_life_planner_tab_sync_v1';

/**
 * Fast deep equality checker for reconciliation comparisons.
 */
export function fastDeepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!fastDeepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (Array.isArray(b)) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!fastDeepEqual(a[key], b[key])) return false;
  }

  return true;
}

/**
 * Reads the latest monotonic revision from localStorage.
 */
export function getStoredRevision(): number {
  try {
    if (typeof localStorage === 'undefined') return 1;
    const raw = localStorage.getItem(STORAGE_KEY_REVISION);
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    const dataRaw = localStorage.getItem(STORAGE_KEY_DATA);
    if (dataRaw) {
      const parsedData = JSON.parse(dataRaw);
      if (parsedData && typeof parsedData.revision === 'number') {
        return parsedData.revision;
      }
    }
  } catch {
    // ignore
  }
  return 1;
}

/**
 * Acquires a cross-tab mutual exclusion lock.
 * Uses the Web Locks API (navigator.locks.request) when available,
 * with a resilient localStorage-based spinlock fallback with TTL.
 */
export async function withStorageLock<T>(action: () => Promise<T> | T): Promise<T> {
  if (
    typeof navigator !== 'undefined' &&
    navigator.locks &&
    typeof navigator.locks.request === 'function'
  ) {
    try {
      return await navigator.locks.request(
        'our_life_planner_storage_lock',
        { mode: 'exclusive' },
        async () => {
          return await action();
        }
      );
    } catch {
      return await withFallbackLock(action);
    }
  }

  return await withFallbackLock(action);
}

/**
 * Resilient localStorage spinlock with TTL for environments without navigator.locks.
 */
async function withFallbackLock<T>(action: () => Promise<T> | T): Promise<T> {
  const lockId = `${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const maxWaitMs = 3000;
  const pollIntervalMs = 25;
  const lockTtlMs = 4000;
  const startTime = Date.now();

  const acquire = (): boolean => {
    try {
      if (typeof localStorage === 'undefined') return true;
      const raw = localStorage.getItem(STORAGE_KEY_MUTEX);
      const now = Date.now();
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.expiresAt && parsed.expiresAt > now) {
            return false;
          }
        } catch {
          // malformed, proceed to acquire
        }
      }
      localStorage.setItem(
        STORAGE_KEY_MUTEX,
        JSON.stringify({ lockId, expiresAt: now + lockTtlMs })
      );
      return true;
    } catch {
      return true;
    }
  };

  while (!acquire()) {
    if (Date.now() - startTime > maxWaitMs) {
      console.warn('Storage lock wait timeout, proceeding');
      break;
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  try {
    return await action();
  } finally {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY_MUTEX);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.lockId === lockId) {
            localStorage.removeItem(STORAGE_KEY_MUTEX);
          }
        }
      }
    } catch {
      // ignore
    }
  }
}

export function extractRecordTitle(record: any, fallbackKey: string): string {
  if (!record || typeof record !== 'object') return fallbackKey;
  return (
    record.title ||
    record.name ||
    record.recipeTitle ||
    record.text ||
    record.note ||
    record.category ||
    record.weekStartDate ||
    record.date ||
    fallbackKey
  );
}

/**
 * Merges a collection of items using 3-way reconciliation (base, local, stored).
 */
export function mergeCollection<T extends Record<string, any>>(
  baseItems: T[] = [],
  localItems: T[] = [],
  storedItems: T[] = [],
  getKey: (item: T) => string,
  collectionName: string,
  source: 'tab' | 'cloud' | 'import' = 'tab'
): { merged: T[]; conflicts: ConflictItem[]; hasRemoteDiff: boolean } {
  const baseMap = new Map<string, T>();
  baseItems.forEach((item) => baseMap.set(getKey(item), item));

  const localMap = new Map<string, T>();
  localItems.forEach((item) => localMap.set(getKey(item), item));

  const storedMap = new Map<string, T>();
  storedItems.forEach((item) => storedMap.set(getKey(item), item));

  const allKeys = new Set<string>([
    ...baseMap.keys(),
    ...localMap.keys(),
    ...storedMap.keys(),
  ]);

  const mergedMap = new Map<string, T>();
  const conflicts: ConflictItem[] = [];
  let hasRemoteDiff = false;

  for (const key of allKeys) {
    const b = baseMap.get(key);
    const l = localMap.get(key);
    const s = storedMap.get(key);

    // Case 1: Item was not present in base
    if (!b) {
      if (l && !s) {
        // Added locally in this tab
        mergedMap.set(key, l);
      } else if (!l && s) {
        // Added remotely by another tab
        mergedMap.set(key, s);
        hasRemoteDiff = true;
      } else if (l && s) {
        // Added in both tabs
        if (fastDeepEqual(l, s)) {
          mergedMap.set(key, l);
        } else {
          // Conflict: both added item with same key but different fields
          mergedMap.set(key, l);
          conflicts.push({
            id: key,
            entityType: collectionName,
            title: extractRecordTitle(l, key),
            localVersion: l,
            onlineVersion: s,
            timestamp: new Date().toLocaleTimeString(),
            source,
          });
        }
      }
      continue;
    }

    // Case 2: Item existed in base
    const localDeleted = !l;
    const storedDeleted = !s;

    if (localDeleted && storedDeleted) {
      // Both deleted it
      continue;
    }

    if (localDeleted && s) {
      const storedModified = !fastDeepEqual(s, b);
      if (storedModified) {
        // Remote modified it while local deleted it -> preserve to avoid data loss
        mergedMap.set(key, s);
        hasRemoteDiff = true;
        conflicts.push({
          id: key,
          entityType: collectionName,
          title: extractRecordTitle(s, key),
          localVersion: null,
          onlineVersion: s,
          timestamp: new Date().toLocaleTimeString(),
          source,
        });
      }
      // If remote did not touch it, local deletion stands
      continue;
    }

    if (l && storedDeleted) {
      const localModified = !fastDeepEqual(l, b);
      if (localModified) {
        // Local modified it while remote deleted it -> keep local change
        mergedMap.set(key, l);
        conflicts.push({
          id: key,
          entityType: collectionName,
          title: extractRecordTitle(l, key),
          localVersion: l,
          onlineVersion: null,
          timestamp: new Date().toLocaleTimeString(),
          source,
        });
      }
      // If local did not touch it, remote deletion stands
      hasRemoteDiff = true;
      continue;
    }

    if (l && s) {
      const localChanged = !fastDeepEqual(l, b);
      const storedChanged = !fastDeepEqual(s, b);

      if (!localChanged && !storedChanged) {
        mergedMap.set(key, l);
      } else if (!localChanged && storedChanged) {
        // Only remote modified it
        mergedMap.set(key, s);
        hasRemoteDiff = true;
      } else if (localChanged && !storedChanged) {
        // Only local modified it
        mergedMap.set(key, l);
      } else {
        // Both modified it!
        if (fastDeepEqual(l, s)) {
          mergedMap.set(key, l);
        } else {
          // Conflicting edit on exact same item
          mergedMap.set(key, l);
          conflicts.push({
            id: key,
            entityType: collectionName,
            title: extractRecordTitle(l, key),
            localVersion: l,
            onlineVersion: s,
            timestamp: new Date().toLocaleTimeString(),
            source,
          });
        }
      }
    }
  }

  // Preserve ordering: start with keys in local/stored order
  const orderedResult: T[] = [];
  const processedKeys = new Set<string>();

  localItems.forEach((item) => {
    const k = getKey(item);
    if (mergedMap.has(k) && !processedKeys.has(k)) {
      orderedResult.push(mergedMap.get(k)!);
      processedKeys.add(k);
    }
  });

  storedItems.forEach((item) => {
    const k = getKey(item);
    if (mergedMap.has(k) && !processedKeys.has(k)) {
      orderedResult.push(mergedMap.get(k)!);
      processedKeys.add(k);
    }
  });

  return { merged: orderedResult, conflicts, hasRemoteDiff };
}

/**
 * 3-way merge for user settings.
 */
export function mergeSettings(
  base: UserSettings,
  local: UserSettings,
  stored: UserSettings
): { merged: UserSettings; hasRemoteDiff: boolean } {
  const merged: UserSettings = { ...stored, ...local };
  let hasRemoteDiff = false;

  const allKeys = Array.from(
    new Set([
      ...Object.keys(base || {}),
      ...Object.keys(local || {}),
      ...Object.keys(stored || {}),
    ])
  ) as (keyof UserSettings)[];

  for (const k of allKeys) {
    const bVal = base ? base[k] : undefined;
    const lVal = local ? local[k] : undefined;
    const sVal = stored ? stored[k] : undefined;

    const localChanged = !fastDeepEqual(lVal, bVal);
    const storedChanged = !fastDeepEqual(sVal, bVal);

    if (!localChanged && storedChanged) {
      (merged as any)[k] = sVal;
      hasRemoteDiff = true;
    } else if (localChanged && !storedChanged) {
      (merged as any)[k] = lVal;
    } else if (localChanged && storedChanged) {
      (merged as any)[k] = lVal;
    } else {
      (merged as any)[k] = bVal;
    }
  }

  return { merged, hasRemoteDiff };
}

export interface ReconciliationResult {
  mergedData: PlannerBackupData;
  conflicts: ConflictItem[];
  hasRemoteChanges: boolean;
}

/**
 * Full 3-way reconciliation of all collections and settings.
 */
export function reconcilePlannerData(
  base: PlannerBackupData,
  local: PlannerBackupData,
  stored: PlannerBackupData,
  source: 'tab' | 'cloud' | 'import' = 'tab'
): ReconciliationResult {
  const allConflicts: ConflictItem[] = [];
  let anyRemoteChanges = false;

  const mergeArr = <T extends Record<string, any>>(
    collectionName: keyof PlannerBackupData,
    getKey: (item: T) => string = (i: any) => i.id
  ): T[] => {
    const bArr = ((base && (base as any)[collectionName]) || []) as T[];
    const lArr = ((local && (local as any)[collectionName]) || []) as T[];
    const sArr = ((stored && (stored as any)[collectionName]) || []) as T[];

    const res = mergeCollection<T>(bArr, lArr, sArr, getKey, String(collectionName), source);
    if (res.conflicts.length > 0) {
      allConflicts.push(...res.conflicts);
    }
    if (res.hasRemoteDiff) {
      anyRemoteChanges = true;
    }
    return res.merged;
  };

  const tasks = mergeArr<TaskItem>('tasks');
  const routines = mergeArr<RoutineItem>('routines');
  const goals = mergeArr<GoalItem>('goals');
  const habits = mergeArr<HabitItem>('habits');
  const inbox = mergeArr<BrainDumpItem>('inbox');
  const transactions = mergeArr<FinancialTransaction>('transactions');
  const bills = mergeArr<BillItem>('bills');
  const savingsPots = mergeArr<SavingsPot>('savingsPots');
  const debts = mergeArr<DebtItem>('debts');
  const recipes = mergeArr<RecipeItem>('recipes');
  const plannedMeals = mergeArr<PlannedMeal>('plannedMeals');
  const groceries = mergeArr<GroceryItem>('groceries');
  const workouts = mergeArr<WorkoutSession>('workouts');
  const weightProfiles = mergeArr<WeightProfile>('weightProfiles');
  const weightRecords = mergeArr<WeightRecord>('weightRecords');
  const hydrationEntries = mergeArr<HydrationLogEntry>('hydrationEntries');
  const hydrationTargets = mergeArr<DailyHydrationTarget>('hydrationTargets', (i: any) => i.date || i.id);
  const calendarEvents = mergeArr<CalendarEvent>('calendarEvents');
  const weeklyReviews = mergeArr<WeeklyReviewEntry>('weeklyReviews', (i: any) => i.weekStartDate || i.id);

  const settingsRes = mergeSettings(base.settings, local.settings, stored.settings);
  if (settingsRes.hasRemoteDiff) {
    anyRemoteChanges = true;
  }

  const mergedData: PlannerBackupData = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    revision: Math.max(stored.revision || 0, base.revision || 0, local.revision || 0),
    settings: settingsRes.merged,
    tasks,
    routines,
    goals,
    habits,
    inbox,
    transactions,
    bills,
    savingsPots,
    debts,
    recipes,
    plannedMeals,
    groceries,
    workouts,
    weightProfiles,
    weightRecords,
    hydrationEntries,
    hydrationTargets,
    calendarEvents,
    weeklyReviews,
  };

  return {
    mergedData,
    conflicts: allConflicts,
    hasRemoteChanges: anyRemoteChanges,
  };
}

export interface StorageSyncMessage {
  type: 'STORAGE_SYNC';
  tabId: string;
  revision: number;
  timestamp: string;
  data: PlannerBackupData;
}

/**
 * Cross-tab synchronization manager using BroadcastChannel with storage event fallback.
 */
export class TabSyncManager {
  private channel: BroadcastChannel | null = null;
  private onSyncCallback: ((msg: StorageSyncMessage) => void) | null = null;
  private tabId: string;
  private isDestroyed = false;

  constructor() {
    this.tabId = `tab_${Math.random().toString(36).slice(2)}_${Date.now()}`;

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          if (this.isDestroyed) return;
          if (event.data && event.data.type === 'STORAGE_SYNC') {
            if (event.data.tabId !== this.tabId) {
              this.onSyncCallback?.(event.data);
            }
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel initialization failed:', e);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageEvent);
    }
  }

  private handleStorageEvent = (event: StorageEvent) => {
    if (this.isDestroyed) return;
    if (event.key === STORAGE_KEY_DATA && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue) as PlannerBackupData;
        const rev = parsed.revision || getStoredRevision();
        this.onSyncCallback?.({
          type: 'STORAGE_SYNC',
          tabId: 'storage_event_source',
          revision: rev,
          timestamp: new Date().toISOString(),
          data: parsed,
        });
      } catch {
        // ignore parse error
      }
    }
  };

  getTabId(): string {
    return this.tabId;
  }

  onSync(cb: (msg: StorageSyncMessage) => void) {
    this.onSyncCallback = cb;
  }

  broadcast(revision: number, data: PlannerBackupData) {
    if (this.isDestroyed) return;
    const msg: StorageSyncMessage = {
      type: 'STORAGE_SYNC',
      tabId: this.tabId,
      revision,
      timestamp: new Date().toISOString(),
      data,
    };
    try {
      this.channel?.postMessage(msg);
    } catch (e) {
      console.warn('Failed to broadcast storage sync message:', e);
    }
  }

  destroy() {
    this.isDestroyed = true;
    try {
      this.channel?.close();
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageEvent);
    }
  }
}

export const PLANNER_COLLECTION_KEYS = [
  'tasks',
  'routines',
  'goals',
  'habits',
  'inbox',
  'transactions',
  'bills',
  'savingsPots',
  'debts',
  'recipes',
  'plannedMeals',
  'groceries',
  'workouts',
  'weightProfiles',
  'weightRecords',
  'hydrationEntries',
  'hydrationTargets',
  'calendarEvents',
  'weeklyReviews',
] as const;

export type PlannerCollectionKey = (typeof PLANNER_COLLECTION_KEYS)[number];

const SINGULAR_TO_PLURAL_COLLECTION: Record<string, PlannerCollectionKey> = {
  task: 'tasks',
  tasks: 'tasks',
  routine: 'routines',
  routines: 'routines',
  goal: 'goals',
  goals: 'goals',
  habit: 'habits',
  habits: 'habits',
  inbox: 'inbox',
  brainDump: 'inbox',
  transaction: 'transactions',
  transactions: 'transactions',
  bill: 'bills',
  bills: 'bills',
  savingsPot: 'savingsPots',
  savingsPots: 'savingsPots',
  debt: 'debts',
  debts: 'debts',
  recipe: 'recipes',
  recipes: 'recipes',
  plannedMeal: 'plannedMeals',
  plannedMeals: 'plannedMeals',
  meal: 'plannedMeals',
  meals: 'plannedMeals',
  grocery: 'groceries',
  groceries: 'groceries',
  workout: 'workouts',
  workouts: 'workouts',
  weightProfile: 'weightProfiles',
  weightProfiles: 'weightProfiles',
  weightRecord: 'weightRecords',
  weightRecords: 'weightRecords',
  hydrationEntry: 'hydrationEntries',
  hydrationEntries: 'hydrationEntries',
  hydrationTarget: 'hydrationTargets',
  hydrationTargets: 'hydrationTargets',
  calendarEvent: 'calendarEvents',
  calendarEvents: 'calendarEvents',
  event: 'calendarEvents',
  weeklyReview: 'weeklyReviews',
  weeklyReviews: 'weeklyReviews',
};

export const COLLECTION_HUMAN_LABELS: Record<PlannerCollectionKey, string> = {
  tasks: 'Task',
  routines: 'Routine',
  goals: 'Goal',
  habits: 'Habit',
  inbox: 'Inbox Note',
  transactions: 'Transaction',
  bills: 'Bill',
  savingsPots: 'Savings Pot',
  debts: 'Debt',
  recipes: 'Recipe',
  plannedMeals: 'Planned Meal',
  groceries: 'Grocery Item',
  workouts: 'Workout',
  weightProfiles: 'Weight Profile',
  weightRecords: 'Weight Entry',
  hydrationEntries: 'Hydration Log',
  hydrationTargets: 'Hydration Target',
  calendarEvents: 'Calendar Event',
  weeklyReviews: 'Weekly Review',
};

export function normalizeConflictCollectionKey(entityType: string): PlannerCollectionKey | null {
  if (!entityType) return null;
  return SINGULAR_TO_PLURAL_COLLECTION[entityType] || null;
}

export function getCollectionItemKey(collectionKey: PlannerCollectionKey, item: any): string {
  if (!item || typeof item !== 'object') return '';
  if (collectionKey === 'hydrationTargets') {
    return String(item.date || item.id || '');
  }
  if (collectionKey === 'weeklyReviews') {
    return String(item.weekStartDate || item.id || '');
  }
  return String(item.id || item.date || '');
}

/**
 * Applies a user's conflict resolution choice ('local' or 'online') to a PlannerBackupData snapshot.
 * Supports all 19 collections and delete-vs-edit conflicts (where the chosen version is null).
 */
export function applyConflictResolutionToData(
  data: PlannerBackupData,
  conflict: ConflictItem,
  choice: 'local' | 'online'
): PlannerBackupData {
  const collectionKey = normalizeConflictCollectionKey(conflict.entityType);
  if (!collectionKey) {
    return data;
  }

  const chosenRecord = choice === 'local' ? conflict.localVersion : conflict.onlineVersion;
  const currentList = Array.isArray((data as any)[collectionKey])
    ? [...((data as any)[collectionKey] as any[])]
    : [];

  const matchesConflict = (item: any) => {
    const k = getCollectionItemKey(collectionKey, item);
    return k === conflict.id || item?.id === conflict.id;
  };

  let nextList: any[];
  if (chosenRecord === null || chosenRecord === undefined) {
    // Chosen version deleted this record
    nextList = currentList.filter((item) => !matchesConflict(item));
  } else {
    const existingIdx = currentList.findIndex(matchesConflict);
    if (existingIdx >= 0) {
      nextList = [...currentList];
      nextList[existingIdx] = chosenRecord;
    } else {
      nextList = [...currentList, chosenRecord];
    }
  }

  return {
    ...data,
    [collectionKey]: nextList,
  };
}

export interface ConflictVersionDescription {
  isDeleted: boolean;
  collectionLabel: string;
  headline: string;
  heading: string;
  details: Array<{ label: string; value: string }>;
}

/**
 * Null-safe, collection-aware formatter for ConflictModal.
 */
export function describeConflictVersion(
  entityType: string,
  version: any,
  fallbackTitle = 'Item'
): ConflictVersionDescription {
  const collectionKey = normalizeConflictCollectionKey(entityType);
  const collectionLabel = collectionKey
    ? COLLECTION_HUMAN_LABELS[collectionKey]
    : entityType || 'Item';

  if (version === null || version === undefined) {
    const headline = `${fallbackTitle} (Deleted)`;
    return {
      isDeleted: true,
      collectionLabel,
      headline,
      heading: headline,
      details: [{ label: 'State', value: 'Deleted in this version' }],
    };
  }

  if (typeof version !== 'object') {
    const headline = String(version);
    return {
      isDeleted: false,
      collectionLabel,
      headline,
      heading: headline,
      details: [],
    };
  }

  const headline = extractRecordTitle(version, fallbackTitle);
  const details: Array<{ label: string; value: string }> = [];

  if (version.status !== undefined) {
    details.push({ label: 'Status', value: String(version.status).replace(/_/g, ' ') });
  }
  if (version.priority !== undefined) {
    details.push({ label: 'Priority', value: String(version.priority) });
  }
  if (version.dueDate !== undefined) {
    details.push({ label: 'Due Date', value: String(version.dueDate) });
  }
  if (version.date !== undefined && version.dueDate === undefined) {
    details.push({ label: 'Date', value: String(version.date) });
  }
  if (version.plannedAmount !== undefined) {
    details.push({ label: 'Planned Amount', value: String(version.plannedAmount) });
  }
  if (version.amount !== undefined) {
    details.push({
      label: 'Amount',
      value: version.unit ? `${version.amount} ${version.unit}` : String(version.amount),
    });
  }
  if (version.isPaid !== undefined) {
    details.push({ label: 'Paid', value: version.isPaid ? 'Paid' : 'Unpaid' });
  }
  if (version.isPurchased !== undefined) {
    details.push({ label: 'Purchased', value: version.isPurchased ? 'Yes' : 'No' });
  }
  if (version.weightKg !== undefined) {
    details.push({ label: 'Weight', value: `${version.weightKg} kg` });
  }
  if (version.amountMl !== undefined) {
    details.push({ label: 'Hydration', value: `${version.amountMl} ml` });
  }
  if (version.targetMl !== undefined) {
    details.push({ label: 'Daily Target', value: `${version.targetMl} ml` });
  }
  if (version.currentBalance !== undefined) {
    details.push({ label: 'Balance', value: String(version.currentBalance) });
  }
  if (version.targetAmount !== undefined) {
    details.push({ label: 'Target', value: String(version.targetAmount) });
  }
  if (Array.isArray(version.checkedDates)) {
    details.push({ label: 'Check-ins', value: `${version.checkedDates.length} dates` });
  }
  if (Array.isArray(version.completedDates)) {
    details.push({ label: 'Completions', value: `${version.completedDates.length} dates` });
  }
  if (version.category !== undefined) {
    details.push({ label: 'Category', value: String(version.category) });
  }
  if (version.assignedTo !== undefined) {
    details.push({ label: 'Assigned To', value: String(version.assignedTo) });
  }

  return {
    isDeleted: false,
    collectionLabel,
    headline,
    heading: headline,
    details: details.slice(0, 5),
  };
}

export interface SimpleStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getDefaultBrowserStorage(): SimpleStorageLike | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // ignore
  }
  return null;
}

/**
 * LP-02: Atomic multi-key storage write with readback verification and full rollback on partial failure.
 */
export function atomicWritePlannerStorage(
  dataOrOptions:
    | PlannerBackupData
    | {
        data: PlannerBackupData;
        settings?: UserSettings;
        revision: number;
        storage?: SimpleStorageLike | null;
      },
  revisionArg?: number,
  storageArg?: SimpleStorageLike | null
): { success: boolean; error?: string } {
  const isOptionsObj =
    dataOrOptions &&
    typeof dataOrOptions === 'object' &&
    'data' in dataOrOptions &&
    !('tasks' in dataOrOptions);

  const data: PlannerBackupData = isOptionsObj
    ? (dataOrOptions as any).data
    : (dataOrOptions as PlannerBackupData);
  const settings: UserSettings = isOptionsObj
    ? (dataOrOptions as any).settings || data.settings
    : data.settings;
  const revision: number = isOptionsObj
    ? (dataOrOptions as any).revision
    : (revisionArg ?? data.revision ?? 1);
  const storage: SimpleStorageLike | null = isOptionsObj
    ? (dataOrOptions as any).storage !== undefined
      ? (dataOrOptions as any).storage
      : getDefaultBrowserStorage()
    : storageArg !== undefined
    ? storageArg
    : getDefaultBrowserStorage();

  if (!storage) {
    return { success: false, error: 'Local storage is unavailable in this browser environment.' };
  }

  let prevData: string | null = null;
  let prevSettings: string | null = null;
  let prevRevision: string | null = null;

  try {
    prevData = storage.getItem(STORAGE_KEY_DATA);
    prevSettings = storage.getItem(STORAGE_KEY_SETTINGS);
    prevRevision = storage.getItem(STORAGE_KEY_REVISION);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unable to read from local storage.',
    };
  }

  try {
    const serializedData = JSON.stringify(data);
    const serializedSettings = JSON.stringify(settings);
    const serializedRevision = String(revision);

    storage.setItem(STORAGE_KEY_DATA, serializedData);
    storage.setItem(STORAGE_KEY_SETTINGS, serializedSettings);
    storage.setItem(STORAGE_KEY_REVISION, serializedRevision);

    // Readback check to guarantee durable persistence
    const verifyData = storage.getItem(STORAGE_KEY_DATA);
    const verifySettings = storage.getItem(STORAGE_KEY_SETTINGS);
    const verifyRev = storage.getItem(STORAGE_KEY_REVISION);

    if (
      verifyData !== serializedData ||
      verifySettings !== serializedSettings ||
      verifyRev !== serializedRevision
    ) {
      throw new Error('Storage readback verification failed after write.');
    }

    return { success: true };
  } catch (err) {
    // Roll back all three keys to their exact pre-write state
    try {
      if (prevData !== null) storage.setItem(STORAGE_KEY_DATA, prevData);
      else storage.removeItem(STORAGE_KEY_DATA);

      if (prevSettings !== null) storage.setItem(STORAGE_KEY_SETTINGS, prevSettings);
      else storage.removeItem(STORAGE_KEY_SETTINGS);

      if (prevRevision !== null) storage.setItem(STORAGE_KEY_REVISION, prevRevision);
      else storage.removeItem(STORAGE_KEY_REVISION);
    } catch {
      // ignore secondary rollback errors
    }

    return {
      success: false,
      error: err instanceof Error ? err.message : 'Storage write failed (quota or permission error).',
    };
  }
}

/**
 * LP-02: Quarantines unreadable or corrupt startup payloads so raw user bytes are never silently destroyed.
 */
export function quarantineCorruptStorage(options: {
  rawData: string | null;
  rawSettings: string | null;
  rawRevision: string | null;
  reason: string;
  errors?: string[];
  validationErrors?: string[];
  storage?: SimpleStorageLike | null;
}): CorruptDataQuarantine {
  const {
    rawData,
    rawSettings,
    rawRevision,
    reason,
    errors,
    validationErrors,
    storage = getDefaultBrowserStorage(),
  } = options;

  const combinedErrors = errors ?? validationErrors ?? [];

  const quarantineRecord: CorruptDataQuarantine = {
    quarantinedAt: new Date().toISOString(),
    rawData,
    rawSettings,
    rawRevision,
    reason,
    errors: combinedErrors,
    validationErrors: combinedErrors,
  };

  if (storage) {
    try {
      storage.setItem(STORAGE_KEY_CORRUPT_QUARANTINE, JSON.stringify(quarantineRecord));
    } catch {
      // Even if storage is full, quarantineRecord is returned in-memory for immediate user export
    }
  }

  return quarantineRecord;
}

export function getQuarantinedCorruptData(
  storage: SimpleStorageLike | null = getDefaultBrowserStorage()
): CorruptDataQuarantine | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY_CORRUPT_QUARANTINE);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof parsed.quarantinedAt === 'string') {
      return parsed as CorruptDataQuarantine;
    }
  } catch {
    // ignore
  }
  return null;
}

export function clearQuarantinedCorruptData(
  storage: SimpleStorageLike | null = getDefaultBrowserStorage()
): void {
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY_CORRUPT_QUARANTINE);
  } catch {
    // ignore
  }
}

/**
 * LP-07: Removes all app-owned keys and recovery snapshots from local storage.
 */
export function eraseAllAppStorageKeys(
  storage: SimpleStorageLike | null = getDefaultBrowserStorage()
): void {
  if (!storage) return;
  const knownKeys = [
    STORAGE_KEY_DATA,
    STORAGE_KEY_SETTINGS,
    STORAGE_KEY_REVISION,
    STORAGE_KEY_MUTEX,
    'our_life_planner_pre_restore_snapshot_v1',
    STORAGE_KEY_CORRUPT_QUARANTINE,
    STORAGE_KEY_CLOUD_SESSION,
    STORAGE_KEY_CLOUD_SYNC_STATE,
  ];
  for (const key of knownKeys) {
    try {
      storage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

