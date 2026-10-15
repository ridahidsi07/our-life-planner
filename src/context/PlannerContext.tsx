import React, { createContext, useContext, useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  AccentColor,
  BillItem,
  BrainDumpItem,
  CalendarEvent,
  CloudSyncState,
  ConflictItem,
  CorruptDataQuarantine,
  CreationFeedback,
  DailyHydrationTarget,
  DebtItem,
  EditionType,
  FinancialTransaction,
  GoalItem,
  GroceryItem,
  HabitItem,
  HydrationLogEntry,
  PlannedMeal,
  PlannerBackupData,
  RecipeItem,
  RoutineItem,
  SavingState,
  SavingsPot,
  TaskItem,
  TaskStatus,
  UserSettings,
  WeightProfile,
  WeightRecord,
  WorkoutSession,
  WorkoutExercise,
  WorkoutExerciseSet,
  HouseholdMember,
  BillOccurrence,
  BudgetPeriodType,
  WeeklyReviewEntry,
} from '../types/planner';
import { getDayBefore } from '../utils/routineRecurrence';
import { getRealTodayDate as getCanonicalTodayDate } from '../utils/recurrence';
import {
  INITIAL_SETTINGS,
  DEMO_SETTINGS,
  EMPTY_SETTINGS,
  createEmptySettings,
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
  generateRelativeSampleData,
} from '../utils/sampleData';
import {
  calculateCashFlow,
  CashFlowCalculation,
  BudgetPeriodRange,
  getBudgetPeriodRange,
  navigateBudgetPeriod,
  calculatePeriodCashFlow,
} from '../utils/calculations';
import { getCurrencySymbol, getCurrentTimeStr } from '../utils/formatters';
import { serializePlannerCalendarToIcs } from '../utils/icsSerializer';
import { aggregateGroceriesFromMeals } from '../utils/groceryAggregator';

import {
  STORAGE_KEY_DATA,
  STORAGE_KEY_SETTINGS,
  STORAGE_KEY_REVISION,
  getStoredRevision,
  withStorageLock,
  reconcilePlannerData,
  TabSyncManager,
  fastDeepEqual,
  applyConflictResolutionToData,
  atomicWritePlannerStorage,
  quarantineCorruptStorage,
  getQuarantinedCorruptData,
  clearQuarantinedCorruptData,
  eraseAllAppStorageKeys,
} from '../utils/storageCoordinator';
import {
  validateBackupData,
  atomicRestoreBackup,
  rollbackPreRestoreSnapshot,
  getPreRestoreSnapshot,
  savePreRestoreSnapshot,
  STORAGE_KEY_PRE_RESTORE_SNAPSHOT,
  PreRestoreSnapshotInfo,
  BackupValidationResult,
} from '../utils/backupValidator';
import {
  getStoredCloudSyncState,
  syncPlannerWithCloud,
  syncWithCloud,
  clearCloudSession,
  CloudSyncResult,
} from '../utils/cloudSyncClient';
import {
  buildStandaloneFallbackHtml,
  BOOTSTRAP_PLACEHOLDER_TOKEN,
} from '../utils/standaloneHtml';
import {
  migrateEnabledTools,
  migratePinnedTools,
  toggleModuleEnabledInList,
  toggleModulePinnedInList,
  isModuleOrToolEnabled,
  getFallbackEnabledToolView,
} from '../utils/moduleRegistry';

interface PlannerContextType {
  // Settings & Navigation
  settings: UserSettings;
  updateSettings: (newSettings: Partial<UserSettings>) => void;
  currentDate: string;
  setCurrentDate: (date: string) => void;
  todayDate: string;
  isViewingToday: boolean;
  goToToday: () => void;
  activeView: string;
  setActiveView: (view: string) => void;
  activeModal: string | null;
  setActiveModal: (modal: string | null) => void;
  savingState: SavingState;
  setSavingState: (state: SavingState) => void;
  lastSaveError: string | null;
  retrySave: () => Promise<boolean>;
  exportUnsavedSnapshot: () => void;
  corruptStartupQuarantine: CorruptDataQuarantine | null;
  exportCorruptQuarantine: () => void;
  dismissCorruptQuarantine: () => void;
  conflictItem: ConflictItem | null;
  conflictQueue: ConflictItem[];
  setConflictItem: (conflict: ConflictItem | null) => void;
  resolveConflict: (chosenVersion: 'local' | 'online') => void;
  cloudSyncState: CloudSyncState;
  setCloudSyncState: React.Dispatch<React.SetStateAction<CloudSyncState>>;
  syncWithCloudNow: (migrationMode?: 'merge' | 'use_cloud' | 'overwrite_cloud') => Promise<CloudSyncResult>;

  // Data Collections
  tasks: TaskItem[];
  routines: RoutineItem[];
  goals: GoalItem[];
  habits: HabitItem[];
  inbox: BrainDumpItem[];
  transactions: FinancialTransaction[];
  bills: BillItem[];
  savingsPots: SavingsPot[];
  debts: DebtItem[];
  recipes: RecipeItem[];
  plannedMeals: PlannedMeal[];
  groceries: GroceryItem[];
  workouts: WorkoutSession[];
  weightProfiles: WeightProfile[];
  selectedProfileId: string;
  setSelectedProfileId: (id: string) => void;
  weightRecords: WeightRecord[];
  hydrationEntries: HydrationLogEntry[];
  hydrationTargets: DailyHydrationTarget[];
  calendarEvents: CalendarEvent[];
  weeklyReviews: WeeklyReviewEntry[];

  // Computed Summaries
  cashFlow: CashFlowCalculation & {
    periodRange: BudgetPeriodRange;
    periodIncome: number;
    periodExpenses: number;
    periodSavingsTransfers: number;
    periodCategorySpent: Record<string, number>;
    periodOccurrences: BillOccurrence[];
    overdueOccurrences: BillOccurrence[];
    allActualIncome: number;
    allActualExpenses: number;
    allSavingsTransfers: number;
  };
  budgetPeriodRange: BudgetPeriodRange;
  navigateBudgetPeriod: (direction: 'prev' | 'next') => void;
  resetBudgetPeriodToCurrent: () => void;

  // Task Actions
  addTask: (task: Omit<TaskItem, 'id' | 'createdAt'>) => string;
  updateTask: (id: string, updates: Partial<TaskItem>) => void;
  deleteTask: (id: string) => void;
  restoreDeletedTask: (task: TaskItem) => void;
  toggleTaskCompletion: (id: string) => void;
  archiveTask: (id: string) => void;
  unarchiveTask: (id: string) => void;
  rescheduleTask: (id: string, newDate: string) => void;

  // Routine Actions
  addRoutine: (routine: Omit<RoutineItem, 'id' | 'completedDates' | 'skippedDates'>) => void;
  updateRoutine: (id: string, updates: Partial<RoutineItem>) => void;
  updateRoutineWithScope: (
    id: string,
    occurrenceDate: string,
    scope: 'this' | 'future',
    updates: Partial<RoutineItem>
  ) => void;
  deleteRoutine: (id: string) => void;
  toggleRoutineCompletion: (id: string, date: string) => void;
  skipRoutineOccurrence: (id: string, date: string) => void;
  unskipRoutineOccurrence: (id: string, date: string) => void;
  forgiveRoutineOccurrence: (id: string, date: string) => void;
  unforgiveRoutineOccurrence: (id: string, date: string) => void;
  toggleRoutinePause: (id: string) => void;

  // Goal Actions
  addGoal: (goal: Omit<GoalItem, 'id' | 'createdAt'>) => void;
  updateGoal: (id: string, updates: Partial<GoalItem>) => void;
  deleteGoal: (id: string) => void;
  toggleGoalStep: (goalId: string, stepId: string) => void;
  addGoalStep: (goalId: string, title: string) => void;

  // Habit Actions
  addHabit: (habit: Omit<HabitItem, 'id' | 'checkedDates'>) => void;
  updateHabit: (id: string, updates: Partial<HabitItem>) => void;
  deleteHabit: (id: string) => void;
  toggleHabitCheck: (id: string, date: string) => void;

  // Inbox Actions
  addInboxItem: (text: string) => string;
  deleteInboxItem: (id: string) => void;
  convertInboxToTask: (inboxId: string, taskData: Omit<TaskItem, 'id' | 'createdAt'>) => void;

  // Money Actions
  addTransaction: (tx: Omit<FinancialTransaction, 'id'>) => string;
  updateTransaction: (id: string, updates: Partial<FinancialTransaction>) => void;
  deleteTransaction: (id: string) => void;
  addBill: (bill: Omit<BillItem, 'id' | 'isPaid'>) => void;
  updateBill: (id: string, updates: Partial<BillItem>) => void;
  deleteBill: (id: string) => void;
  markBillPaid: (billId: string, actualAmount: number, paymentDate: string, occurrenceDueDate?: string) => void;
  unpayBill: (billId: string, occurrenceDueDate?: string) => void;

  // Savings Actions
  addSavingsPot: (pot: Omit<SavingsPot, 'id' | 'deposits'>) => void;
  updateSavingsPot: (id: string, updates: Partial<SavingsPot>) => void;
  deleteSavingsPot: (id: string) => void;
  addSavingsDeposit: (potId: string, amount: number, date: string, source: 'spending_balance' | 'outside') => void;

  // Debt Actions
  addDebt: (debt: Omit<DebtItem, 'id'>) => void;
  updateDebt: (id: string, updates: Partial<DebtItem>) => void;
  deleteDebt: (id: string) => void;

  // Food & Grocery Actions
  addRecipe: (recipe: Omit<RecipeItem, 'id'>) => void;
  updateRecipe: (id: string, updates: Partial<RecipeItem>) => void;
  deleteRecipe: (id: string) => void;
  addPlannedMeal: (meal: Omit<PlannedMeal, 'id'>) => void;
  updatePlannedMeal: (id: string, updates: Partial<PlannedMeal>) => void;
  deletePlannedMeal: (id: string) => void;
  toggleMealConsumed: (mealId: string) => void;
  regenerateGroceries: (weekStartDateStr: string) => void;
  addGroceryItem: (item: Omit<GroceryItem, 'id' | 'sourceType'>) => void;
  updateGroceryItem: (id: string, updates: Partial<GroceryItem>) => void;
  deleteGroceryItem: (id: string) => void;
  toggleGroceryPurchased: (id: string) => void;
  resetGroceryCheckmarks: () => void;

  // Workout Actions
  addWorkoutSession: (session: Omit<WorkoutSession, 'id'>) => string;
  updateWorkoutSession: (id: string, updates: Partial<WorkoutSession>) => void;
  deleteWorkoutSession: (id: string) => void;
  toggleSetCompleted: (sessionId: string, exerciseId: string, setNumber: number) => void;
  addExerciseToSession: (sessionId: string, exercise: Omit<WorkoutExercise, 'id'>) => void;
  updateExerciseInSession: (sessionId: string, exerciseId: string, updates: Partial<WorkoutExercise>) => void;
  deleteExerciseFromSession: (sessionId: string, exerciseId: string) => void;
  addSetToExercise: (sessionId: string, exerciseId: string, set?: Partial<WorkoutExerciseSet>) => void;
  updateSetInExercise: (sessionId: string, exerciseId: string, setNumber: number, updates: Partial<WorkoutExerciseSet>) => void;
  deleteSetFromExercise: (sessionId: string, exerciseId: string, setNumber: number) => void;

  // Weight Actions
  addWeightProfile: (profile: Omit<WeightProfile, 'id'>) => boolean;
  addWeightRecord: (record: Omit<WeightRecord, 'id'>) => string;
  deleteWeightRecord: (id: string) => void;

  // Hydration Actions
  addWaterLog: (amountMl: number, timeStr?: string) => string;
  undoLastWaterLog: () => void;
  deleteWaterLog: (id: string) => void;
  updateWaterTarget: (targetMl: number) => void;

  // Calendar Event Actions
  addCalendarEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  updateCalendarEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  deleteCalendarEvent: (id: string) => void;
  restoreCalendarEvent: (event: CalendarEvent) => void;

  // Weekly Review Actions
  saveWeeklyReview: (entry: Omit<WeeklyReviewEntry, 'id' | 'updatedAt'> & { id?: string }) => WeeklyReviewEntry;
  deleteWeeklyReview: (idOrWeekStartDate: string) => void;

  // Household & Tool Customization
  addHouseholdMember: (name: string, color: string) => void;
  removeHouseholdMember: (id: string) => void;
  toggleToolEnabled: (toolId: string) => void;
  toggleToolPinned: (toolId: string) => void;

  // Calendar Export
  exportCalendarIcs: () => void;

  // Global Operations
  removeSampleData: () => void;
  resetAllData: () => void;
  startEmptyPlanner: (customSettings?: Partial<UserSettings>) => void;
  eraseAllPlannerData: () => void;
  loadSampleData: () => void;
  exportBackup: () => PlannerBackupData;
  validateBackup: (input: unknown) => BackupValidationResult;
  restoreBackup: (backup: PlannerBackupData) => boolean;
  preRestoreSnapshot: PreRestoreSnapshotInfo | null;
  rollbackLastRestore: () => boolean;
  generateStandaloneHtml: () => string;

  // Capture & Details Feedback (Phase 05)
  lastCreationFeedback: CreationFeedback | null;
  setLastCreationFeedback: (feedback: CreationFeedback | null) => void;
  undoLastCreation: () => void;
  highlightedTaskId: string | null;
  setHighlightedTaskId: (id: string | null) => void;
}

const PlannerContext = createContext<PlannerContextType | undefined>(undefined);

export const getRealTodayDate = (timeZone?: string, now?: Date): string => {
  return getCanonicalTodayDate(timeZone, now);
};

export const applyThemeToDocument = (
  theme: 'light' | 'dark' | 'system',
  accent: AccentColor = 'teal'
) => {
  if (typeof window === 'undefined') return;
  const isDark =
    theme === 'dark'
      ? true
      : theme === 'light'
      ? false
      : Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const root = document.documentElement;
  const body = document.body;

  const validAccent = ['teal', 'ocean', 'plum', 'ember', 'apple'].includes(accent) ? accent : 'teal';
  root.setAttribute('data-accent', validAccent);

  if (isDark) {
    root.classList.add('dark');
    root.classList.remove('light');
    root.setAttribute('data-theme', 'dark');
    root.style.colorScheme = 'dark';
    if (body) {
      body.classList.add('dark');
      body.classList.remove('light');
      body.style.backgroundColor = validAccent === 'apple' ? '#000000' : '#0B1220';
      body.style.color = validAccent === 'apple' ? '#F5F5F7' : '#EDF4FF';
    }
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
    root.setAttribute('data-theme', 'light');
    root.style.colorScheme = 'light';
    if (body) {
      body.classList.remove('dark');
      body.classList.add('light');
      body.style.backgroundColor = validAccent === 'apple' ? '#F5F5F7' : '#F3F8FC';
      body.style.color = validAccent === 'apple' ? '#1D1D1F' : '#071A3A';
    }
  }
};

export const PlannerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Settings & general state
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          const baseDefaults = parsed.isSampleDataActive === false ? EMPTY_SETTINGS : INITIAL_SETTINGS;
          const merged: UserSettings = { ...baseDefaults, ...parsed };
          if (merged.currency) {
            merged.currencySymbol = getCurrencySymbol(merged.currency);
          }
          merged.enabledTools = migrateEnabledTools(merged.enabledTools);
          merged.pinnedTools = migratePinnedTools(merged.pinnedTools);
          return merged;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return {
      ...INITIAL_SETTINGS,
      hasCompletedSetup: false,
      enabledTools: migrateEnabledTools(INITIAL_SETTINGS.enabledTools),
      pinnedTools: migratePinnedTools(INITIAL_SETTINGS.pinnedTools),
    };
  });

  // Dynamic real today and selected current date
  const [todayDate, setTodayDate] = useState<string>(() => getRealTodayDate(settings.timeZone));
  const [currentDate, setCurrentDate] = useState<string>(() => getRealTodayDate(settings.timeZone));
  const [activeView, setActiveView] = useState<string>('today');
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [savingState, setSavingState] = useState<SavingState>('saved_local');
  const [lastSaveError, setLastSaveError] = useState<string | null>(null);
  const [corruptStartupQuarantine, setCorruptStartupQuarantine] = useState<CorruptDataQuarantine | null>(() =>
    getQuarantinedCorruptData()
  );
  const [conflictQueue, setConflictQueue] = useState<ConflictItem[]>([]);
  const conflictItem = conflictQueue.length > 0 ? conflictQueue[0] : null;
  const setConflictItem = useCallback((conflict: ConflictItem | null) => {
    if (!conflict) {
      setConflictQueue((prev) => prev.slice(1));
    } else {
      setConflictQueue((prev) => {
        const filtered = prev.filter(
          (c) => !(c.id === conflict.id && c.entityType === conflict.entityType)
        );
        return [conflict, ...filtered];
      });
    }
  }, []);
  const [cloudSyncState, setCloudSyncState] = useState<CloudSyncState>(() => getStoredCloudSyncState());
  const [preRestoreSnapshot, setPreRestoreSnapshot] = useState<PreRestoreSnapshotInfo | null>(() =>
    getPreRestoreSnapshot()
  );
  const [lastCreationFeedback, setLastCreationFeedback] = useState<CreationFeedback | null>(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);

  const settingsRef = useRef<UserSettings>(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Reactive theme and accent application
  useEffect(() => {
    applyThemeToDocument(settings.theme || 'light', settings.accentColor || 'teal');

    if (settings.theme === 'system' && typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => {
        applyThemeToDocument('system', settings.accentColor || 'teal');
      };
      mediaQuery.addEventListener('change', listener);
      return () => {
        mediaQuery.removeEventListener('change', listener);
      };
    }
  }, [settings.theme, settings.accentColor]);

  // Midnight rollover check (every 30 seconds)
  useEffect(() => {
    const checkMidnight = () => {
      const freshToday = getRealTodayDate(settings.timeZone);
      setTodayDate((prevToday) => {
        if (freshToday !== prevToday) {
          // If the user was viewing today, automatically advance them to the new today!
          setCurrentDate((prevCurrent) => (prevCurrent === prevToday ? freshToday : prevCurrent));
          return freshToday;
        }
        return prevToday;
      });
    };

    const interval = setInterval(checkMidnight, 30000);
    return () => clearInterval(interval);
  }, [settings.timeZone]);

  // Core Data Collections
  const [tasks, setTasks] = useState<TaskItem[]>(SAMPLE_TASKS);
  const [routines, setRoutines] = useState<RoutineItem[]>(SAMPLE_ROUTINES);
  const [goals, setGoals] = useState<GoalItem[]>(SAMPLE_GOALS);
  const [habits, setHabits] = useState<HabitItem[]>(SAMPLE_HABITS);
  const [inbox, setInbox] = useState<BrainDumpItem[]>(SAMPLE_BRAIN_DUMP);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(SAMPLE_TRANSACTIONS);
  const [bills, setBills] = useState<BillItem[]>(SAMPLE_BILLS);
  const [savingsPots, setSavingsPots] = useState<SavingsPot[]>(SAMPLE_SAVINGS_POTS);
  const [debts, setDebts] = useState<DebtItem[]>(SAMPLE_DEBTS);
  const [recipes, setRecipes] = useState<RecipeItem[]>(SAMPLE_RECIPES);
  const [plannedMeals, setPlannedMeals] = useState<PlannedMeal[]>(SAMPLE_PLANNED_MEALS);
  const [groceries, setGroceries] = useState<GroceryItem[]>(SAMPLE_GROCERIES);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>(SAMPLE_WORKOUTS);
  const [weightProfiles, setWeightProfiles] = useState<WeightProfile[]>(SAMPLE_WEIGHT_PROFILES);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('wp-1');
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>(SAMPLE_WEIGHT_RECORDS);
  const [hydrationEntries, setHydrationEntries] = useState<HydrationLogEntry[]>(SAMPLE_HYDRATION_LOG);
  const [hydrationTargets, setHydrationTargets] = useState<DailyHydrationTarget[]>(SAMPLE_HYDRATION_TARGETS);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(SAMPLE_CALENDAR_EVENTS);
  const [weeklyReviews, setWeeklyReviews] = useState<WeeklyReviewEntry[]>([]);

  // Tab synchronization, revision tracking, and transaction refs
  const syncManagerRef = useRef<TabSyncManager | null>(null);
  const currentRevisionRef = useRef<number>(1);
  const baseSnapshotRef = useRef<PlannerBackupData | null>(null);
  const isApplyingExternalSyncRef = useRef<boolean>(false);

  // Synchronized refs for all collections to prevent stale closures during async coordinated saves
  const tasksRef = useRef(tasks);
  const routinesRef = useRef(routines);
  const goalsRef = useRef(goals);
  const habitsRef = useRef(habits);
  const inboxRef = useRef(inbox);
  const transactionsRef = useRef(transactions);
  const billsRef = useRef(bills);
  const savingsPotsRef = useRef(savingsPots);
  const debtsRef = useRef(debts);
  const recipesRef = useRef(recipes);
  const plannedMealsRef = useRef(plannedMeals);
  const groceriesRef = useRef(groceries);
  const workoutsRef = useRef(workouts);
  const weightProfilesRef = useRef(weightProfiles);
  const weightRecordsRef = useRef(weightRecords);
  const hydrationEntriesRef = useRef(hydrationEntries);
  const hydrationTargetsRef = useRef(hydrationTargets);
  const calendarEventsRef = useRef(calendarEvents);
  const weeklyReviewsRef = useRef(weeklyReviews);

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { routinesRef.current = routines; }, [routines]);
  useEffect(() => { goalsRef.current = goals; }, [goals]);
  useEffect(() => { habitsRef.current = habits; }, [habits]);
  useEffect(() => { inboxRef.current = inbox; }, [inbox]);
  useEffect(() => { transactionsRef.current = transactions; }, [transactions]);
  useEffect(() => { billsRef.current = bills; }, [bills]);
  useEffect(() => { savingsPotsRef.current = savingsPots; }, [savingsPots]);
  useEffect(() => { debtsRef.current = debts; }, [debts]);
  useEffect(() => { recipesRef.current = recipes; }, [recipes]);
  useEffect(() => { plannedMealsRef.current = plannedMeals; }, [plannedMeals]);
  useEffect(() => { groceriesRef.current = groceries; }, [groceries]);
  useEffect(() => { workoutsRef.current = workouts; }, [workouts]);
  useEffect(() => { weightProfilesRef.current = weightProfiles; }, [weightProfiles]);
  useEffect(() => { weightRecordsRef.current = weightRecords; }, [weightRecords]);
  useEffect(() => { hydrationEntriesRef.current = hydrationEntries; }, [hydrationEntries]);
  useEffect(() => { hydrationTargetsRef.current = hydrationTargets; }, [hydrationTargets]);
  useEffect(() => { calendarEventsRef.current = calendarEvents; }, [calendarEvents]);
  useEffect(() => { weeklyReviewsRef.current = weeklyReviews; }, [weeklyReviews]);

  // Builds a complete snapshot of in-memory planner state
  const createDataSnapshot = useCallback(
    (customSettings?: UserSettings): PlannerBackupData => {
      const stg = customSettings || settingsRef.current;
      return {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        revision: currentRevisionRef.current,
        settings: stg,
        tasks: tasksRef.current,
        routines: routinesRef.current,
        goals: goalsRef.current,
        habits: habitsRef.current,
        inbox: inboxRef.current,
        transactions: transactionsRef.current,
        bills: billsRef.current,
        savingsPots: savingsPotsRef.current,
        debts: debtsRef.current,
        recipes: recipesRef.current,
        plannedMeals: plannedMealsRef.current,
        groceries: groceriesRef.current,
        workouts: workoutsRef.current,
        weightProfiles: weightProfilesRef.current,
        weightRecords: weightRecordsRef.current,
        hydrationEntries: hydrationEntriesRef.current,
        hydrationTargets: hydrationTargetsRef.current,
        calendarEvents: calendarEventsRef.current,
        weeklyReviews: weeklyReviewsRef.current,
      };
    },
    []
  );

  // Applies an incoming backup or reconciled dataset to React state
  const applyStateFromBackup = useCallback((data: PlannerBackupData) => {
    if (data.tasks) { setTasks(data.tasks); tasksRef.current = data.tasks; }
    if (data.routines) { setRoutines(data.routines); routinesRef.current = data.routines; }
    if (data.goals) { setGoals(data.goals); goalsRef.current = data.goals; }
    if (data.habits) { setHabits(data.habits); habitsRef.current = data.habits; }
    if (data.inbox) { setInbox(data.inbox); inboxRef.current = data.inbox; }
    if (data.transactions) { setTransactions(data.transactions); transactionsRef.current = data.transactions; }
    if (data.bills) { setBills(data.bills); billsRef.current = data.bills; }
    if (data.savingsPots) { setSavingsPots(data.savingsPots); savingsPotsRef.current = data.savingsPots; }
    if (data.debts) { setDebts(data.debts); debtsRef.current = data.debts; }
    if (data.recipes) { setRecipes(data.recipes); recipesRef.current = data.recipes; }
    if (data.plannedMeals) { setPlannedMeals(data.plannedMeals); plannedMealsRef.current = data.plannedMeals; }
    if (data.groceries) { setGroceries(data.groceries); groceriesRef.current = data.groceries; }
    if (data.workouts) { setWorkouts(data.workouts); workoutsRef.current = data.workouts; }
    if (data.weightProfiles) { setWeightProfiles(data.weightProfiles); weightProfilesRef.current = data.weightProfiles; }
    if (data.weightRecords) { setWeightRecords(data.weightRecords); weightRecordsRef.current = data.weightRecords; }
    if (data.hydrationEntries) { setHydrationEntries(data.hydrationEntries); hydrationEntriesRef.current = data.hydrationEntries; }
    if (data.hydrationTargets) { setHydrationTargets(data.hydrationTargets); hydrationTargetsRef.current = data.hydrationTargets; }
    if (data.calendarEvents) { setCalendarEvents(data.calendarEvents); calendarEventsRef.current = data.calendarEvents; }
    if (Array.isArray(data.weeklyReviews)) { setWeeklyReviews(data.weeklyReviews); weeklyReviewsRef.current = data.weeklyReviews; }
    if (data.settings) {
      setSettings((prev) => {
        const next: UserSettings = { ...prev, ...data.settings };
        if (next.currency) {
          next.currencySymbol = getCurrencySymbol(next.currency);
        }
        next.enabledTools = migrateEnabledTools(next.enabledTools);
        next.pinnedTools = migratePinnedTools(next.pinnedTools);
        settingsRef.current = next;
        return next;
      });
    }
  }, []);

  const enqueueConflicts = useCallback((incoming: ConflictItem[]) => {
    if (!incoming || incoming.length === 0) return;
    setConflictQueue((prev) => {
      const next = [...prev];
      for (const item of incoming) {
        const existingIdx = next.findIndex(
          (c) => c.id === item.id && c.entityType === item.entityType
        );
        if (existingIdx >= 0) {
          next[existingIdx] = item;
        } else {
          next.push(item);
        }
      }
      return next;
    });
    setSavingState('needs_choice');
  }, []);

  // Coordinated transactional save to localStorage
  const triggerSave = useCallback(
    async (customSettings?: UserSettings): Promise<boolean> => {
      if (isApplyingExternalSyncRef.current) {
        // Change was applied from an external tab sync or intentional silent reset; do not write echo back
        isApplyingExternalSyncRef.current = false;
        return true;
      }

      setSavingState('saving');
      let saveSucceeded = false;

      try {
        await withStorageLock(async () => {
          const currentLocalSnapshot = createDataSnapshot(customSettings);
          const storedRevision = getStoredRevision();
          const rawStored = localStorage.getItem(STORAGE_KEY_DATA);

          let dataToSave: PlannerBackupData = currentLocalSnapshot;
          let conflicts: ConflictItem[] = [];

          // Optimistic concurrency check: another tab wrote a newer revision
          if (rawStored && storedRevision > currentRevisionRef.current && baseSnapshotRef.current) {
            try {
              const parsedStored = JSON.parse(rawStored) as PlannerBackupData;
              if (parsedStored && parsedStored.version === '1.0.0') {
                const result = reconcilePlannerData(
                  baseSnapshotRef.current,
                  currentLocalSnapshot,
                  parsedStored,
                  'tab'
                );
                dataToSave = result.mergedData;
                conflicts = result.conflicts;

                // If stored data contained remote updates, update our React state as well
                if (result.hasRemoteChanges) {
                  isApplyingExternalSyncRef.current = true;
                  applyStateFromBackup(dataToSave);
                }
              }
            } catch (parseErr) {
              console.warn('Could not parse stored data for reconciliation:', parseErr);
            }
          }

          // Monotonically advance revision
          const nextRevision = Math.max(storedRevision, currentRevisionRef.current) + 1;
          dataToSave.revision = nextRevision;
          dataToSave.exportedAt = new Date().toISOString();

          // Transactional atomic write with readback verification and rollback on failure (LP-02)
          const writeResult = atomicWritePlannerStorage(dataToSave, nextRevision);
          if (!writeResult.success) {
            throw new Error(writeResult.error || 'Atomic write to localStorage failed');
          }

          // Update tracking references
          currentRevisionRef.current = nextRevision;
          baseSnapshotRef.current = dataToSave;
          setLastSaveError(null);
          saveSucceeded = true;

          // Broadcast to all other open tabs
          syncManagerRef.current?.broadcast(nextRevision, dataToSave);

          if (conflicts.length > 0) {
            enqueueConflicts(conflicts);
          } else {
            setConflictQueue((prevQueue) => {
              if (prevQueue.length > 0) {
                setSavingState('needs_choice');
              } else {
                setSavingState('saved_local');
              }
              return prevQueue;
            });
          }
        });
        return saveSucceeded;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Coordinated save failed:', err);
        setLastSaveError(message);
        setSavingState('could_not_save');
        return false;
      }
    },
    [createDataSnapshot, applyStateFromBackup, enqueueConflicts]
  );

  // Genuine retry save action for SavingIndicator (LP-02)
  const retrySave = useCallback(async (): Promise<boolean> => {
    return triggerSave();
  }, [triggerSave]);

  // Download unsaved in-memory planner snapshot when localStorage write fails (LP-02)
  const exportUnsavedSnapshot = useCallback(() => {
    try {
      const snapshot = createDataSnapshot();
      const json = JSON.stringify(snapshot, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `our-life-planner-unsaved-recovery-${currentDate}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export unsaved snapshot:', e);
    }
  }, [createDataSnapshot, currentDate]);

  // Export quarantined corrupt startup data so user never loses raw bytes (LP-02)
  const exportCorruptQuarantine = useCallback(() => {
    const q = corruptStartupQuarantine || getQuarantinedCorruptData();
    if (!q) return;
    try {
      const json = JSON.stringify(q, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `our-life-planner-corrupt-quarantine-${currentDate}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export corrupt quarantine:', e);
    }
  }, [corruptStartupQuarantine, currentDate]);

  const dismissCorruptQuarantine = useCallback(() => {
    clearQuarantinedCorruptData();
    setCorruptStartupQuarantine(null);
  }, []);

  // Load from local storage or standalone bootstrap on mount
  useEffect(() => {
    try {
      setPreRestoreSnapshot(getPreRestoreSnapshot());
      setCorruptStartupQuarantine(getQuarantinedCorruptData());

      // 1. Check for standalone embedded bootstrap data
      const bootstrapEl = document.getElementById('embedded-planner-bootstrap-data');
      if (bootstrapEl && bootstrapEl.textContent) {
        const raw = bootstrapEl.textContent.trim();
        if (raw && !raw.includes(BOOTSTRAP_PLACEHOLDER_TOKEN)) {
          try {
            const parsedBootstrap = JSON.parse(raw);
            const validation = validateBackupData(parsedBootstrap);
            if (validation.isValid && validation.data) {
              const existingStored = localStorage.getItem(STORAGE_KEY_DATA);
              if (!existingStored) {
                // First time opening the offline standalone bundle file
                const stg = {
                  ...validation.data.settings,
                  edition: 'downloaded' as EditionType,
                };
                const hydratedBootstrap: PlannerBackupData = {
                  ...validation.data,
                  settings: stg,
                };
                applyStateFromBackup(hydratedBootstrap);
                localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(stg));
                localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(hydratedBootstrap));
                return;
              }
            }
          } catch (e) {
            console.error('Failed to parse embedded bootstrap data', e);
          }
        }
      }

      // 2. Load from localStorage
      const storedData = localStorage.getItem(STORAGE_KEY_DATA);
      const storedSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
      const storedRevisionRaw = localStorage.getItem(STORAGE_KEY_REVISION);

      if (!storedSettings && !storedData) {
        // First visit: open setup wizard
        setActiveModal('setup');
      }

      // Verify storedSettings if present without storedData
      if (storedSettings) {
        try {
          const parsedStg = JSON.parse(storedSettings);
          if (!parsedStg || typeof parsedStg !== 'object' || Array.isArray(parsedStg)) {
            const q = quarantineCorruptStorage({
              rawData: storedData,
              rawSettings: storedSettings,
              rawRevision: storedRevisionRaw,
              reason: 'Stored settings JSON is not a valid object.',
            });
            setCorruptStartupQuarantine(q);
          }
        } catch (stgErr) {
          const q = quarantineCorruptStorage({
            rawData: storedData,
            rawSettings: storedSettings,
            rawRevision: storedRevisionRaw,
            reason: `Stored settings JSON parse error: ${stgErr instanceof Error ? stgErr.message : String(stgErr)}`,
          });
          setCorruptStartupQuarantine(q);
        }
      }

      if (storedData) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(storedData);
        } catch (parseErr) {
          console.warn('Stored planner data is malformed JSON; quarantining before fallback:', parseErr);
          const q = quarantineCorruptStorage({
            rawData: storedData,
            rawSettings: storedSettings,
            rawRevision: storedRevisionRaw,
            reason: `Malformed JSON in stored planner data: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
          });
          setCorruptStartupQuarantine(q);
          // Prevent immediate auto-save from overwriting the corrupt data until user acts
          isApplyingExternalSyncRef.current = true;
          baseSnapshotRef.current = createDataSnapshot();
          return;
        }

        const validation = validateBackupData(parsed);
        if (validation.isValid && validation.data) {
          const rev = validation.data.revision || getStoredRevision();
          currentRevisionRef.current = rev;
          baseSnapshotRef.current = validation.data;
          applyStateFromBackup(validation.data);
        } else {
          console.warn('Stored planner data failed schema validation; quarantining before fallback:', validation.errors);
          const q = quarantineCorruptStorage({
            rawData: storedData,
            rawSettings: storedSettings,
            rawRevision: storedRevisionRaw,
            reason: 'Stored planner data failed schema validation.',
            validationErrors: validation.errors,
          });
          setCorruptStartupQuarantine(q);
          isApplyingExternalSyncRef.current = true;
          baseSnapshotRef.current = createDataSnapshot();
        }
      } else {
        baseSnapshotRef.current = createDataSnapshot();
      }
    } catch (err) {
      console.warn('Could not read saved data from localStorage:', err);
    }
  }, [applyStateFromBackup, createDataSnapshot]);

  // Real-time cross-tab synchronization listener
  useEffect(() => {
    const manager = new TabSyncManager();
    syncManagerRef.current = manager;

    manager.onSync((msg) => {
      if (!msg || !msg.data || msg.revision <= currentRevisionRef.current) {
        return;
      }

      // Check if this tab has uncommitted changes differing from base
      const localSnapshot = createDataSnapshot();
      const hasLocalDiff = baseSnapshotRef.current
        ? !fastDeepEqual(localSnapshot, baseSnapshotRef.current)
        : false;

      if (!hasLocalDiff) {
        // No pending changes in this tab: smoothly adopt incoming data
        isApplyingExternalSyncRef.current = true;
        applyStateFromBackup(msg.data);
        currentRevisionRef.current = msg.revision;
        baseSnapshotRef.current = msg.data;
        setSavingState('saved_local');
      } else {
        // Pending local edits exist: reconcile incoming state with local edits
        const result = reconcilePlannerData(
          baseSnapshotRef.current || localSnapshot,
          localSnapshot,
          msg.data,
          'tab'
        );
        isApplyingExternalSyncRef.current = true;
        applyStateFromBackup(result.mergedData);
        currentRevisionRef.current = msg.revision;
        baseSnapshotRef.current = msg.data;

        if (result.conflicts.length > 0) {
          enqueueConflicts(result.conflicts);
        } else {
          // Trigger save of merged state so our edits are committed
          triggerSave();
        }
      }
    });

    return () => {
      manager.destroy();
    };
  }, [createDataSnapshot, applyStateFromBackup, triggerSave, enqueueConflicts]);

  // Watch for data mutations and auto-save
  const [isInitialized, setIsInitialized] = useState(false);
  useEffect(() => {
    if (!isInitialized) {
      setIsInitialized(true);
      return;
    }
    triggerSave();
  }, [
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
    triggerSave,
  ]);

  // Update settings
  const updateSettings = (newSettings: Partial<UserSettings>) => {
    setSettings((prev) => {
      const next: UserSettings = { ...prev, ...newSettings };
      if (newSettings.currency) {
        next.currencySymbol = getCurrencySymbol(newSettings.currency);
      }
      if (newSettings.enabledTools !== undefined) {
        next.enabledTools = migrateEnabledTools(newSettings.enabledTools);
      } else if (next.enabledTools) {
        next.enabledTools = migrateEnabledTools(next.enabledTools);
      }
      if (newSettings.pinnedTools !== undefined) {
        next.pinnedTools = migratePinnedTools(newSettings.pinnedTools);
      } else if (next.pinnedTools) {
        next.pinnedTools = migratePinnedTools(next.pinnedTools);
      }
      if (newSettings.theme !== undefined || newSettings.accentColor !== undefined) {
        applyThemeToDocument(
          newSettings.theme ?? prev.theme ?? 'light',
          newSettings.accentColor ?? prev.accentColor ?? 'teal'
        );
      }
      if (newSettings.timeZone && newSettings.timeZone !== prev.timeZone) {
        const freshToday = getRealTodayDate(newSettings.timeZone);
        setTodayDate(freshToday);
        if (currentDate === todayDate) {
          setCurrentDate(freshToday);
        }
      }
      settingsRef.current = next;
      triggerSave(next);
      return next;
    });
  };

  // Resolve conflict across all 19 collections and durably persist (LP-03)
  const resolveConflict = (chosenVersion: 'local' | 'online') => {
    const activeConflict = conflictQueue[0];
    if (!activeConflict) return;

    const currentSnapshot = createDataSnapshot();
    const resolvedSnapshot = applyConflictResolutionToData(
      currentSnapshot,
      activeConflict,
      chosenVersion
    );

    const storedRevision = getStoredRevision();
    const nextRevision = Math.max(storedRevision, currentRevisionRef.current) + 1;
    resolvedSnapshot.revision = nextRevision;
    resolvedSnapshot.exportedAt = new Date().toISOString();

    isApplyingExternalSyncRef.current = true;
    applyStateFromBackup(resolvedSnapshot);

    const remainingQueue = conflictQueue.slice(1);
    setConflictQueue(remainingQueue);

    const writeResult = atomicWritePlannerStorage(resolvedSnapshot, nextRevision);
    if (writeResult.success) {
      currentRevisionRef.current = nextRevision;
      baseSnapshotRef.current = resolvedSnapshot;
      setLastSaveError(null);
      syncManagerRef.current?.broadcast(nextRevision, resolvedSnapshot);
      setSavingState(remainingQueue.length > 0 ? 'needs_choice' : 'saved_local');
    } else {
      setLastSaveError(writeResult.error || 'Failed to save conflict resolution');
      setSavingState('could_not_save');
    }
  };

  // Online Account Cloud Sync action (LP-01)
  const syncWithCloudNow = useCallback(
    async (migrationMode?: 'merge' | 'use_cloud' | 'overwrite_cloud'): Promise<CloudSyncResult> => {
      setSavingState('saving');
      const localSnapshot = createDataSnapshot();
      const res = await syncWithCloud({
        localSnapshot,
        baseSnapshot: baseSnapshotRef.current,
        migrationMode,
      });
      setCloudSyncState(getStoredCloudSyncState());

      if (res.success && res.mergedData) {
        const storedRevision = getStoredRevision();
        const nextRevision = Math.max(
          storedRevision,
          currentRevisionRef.current,
          res.serverRevision || 0
        ) + 1;
        const hydrated: PlannerBackupData = {
          ...res.mergedData,
          revision: nextRevision,
          exportedAt: new Date().toISOString(),
        };

        isApplyingExternalSyncRef.current = true;
        applyStateFromBackup(hydrated);

        const writeResult = atomicWritePlannerStorage(hydrated, nextRevision);
        if (writeResult.success) {
          currentRevisionRef.current = nextRevision;
          baseSnapshotRef.current = hydrated;
          setLastSaveError(null);
          syncManagerRef.current?.broadcast(nextRevision, hydrated);
        }

        if (res.conflicts && res.conflicts.length > 0) {
          enqueueConflicts(res.conflicts);
        } else {
          setSavingState('saved_cloud');
        }
      } else {
        setSavingState('saved_local');
      }

      return res;
    },
    [createDataSnapshot, applyStateFromBackup, enqueueConflicts]
  );

  // Budget period range computation
  const defaultPeriodRange = useMemo(() => {
    return getBudgetPeriodRange({
      referenceDate: currentDate,
      periodType: settings.budgetPeriodType,
      weekStartsOn: settings.weekStartsOn,
      customStartDate: settings.budgetStartDate,
      customEndDate: settings.budgetEndDate,
    });
  }, [currentDate, settings.budgetPeriodType, settings.weekStartsOn, settings.budgetStartDate, settings.budgetEndDate]);

  const [navigatedPeriodRange, setNavigatedPeriodRange] = useState<BudgetPeriodRange | null>(null);

  useEffect(() => {
    setNavigatedPeriodRange(null);
  }, [settings.budgetPeriodType, currentDate]);

  const activeBudgetPeriodRange = navigatedPeriodRange || defaultPeriodRange;

  const navigateBudgetPeriodRange = useCallback(
    (direction: 'prev' | 'next') => {
      setNavigatedPeriodRange((prev) =>
        navigateBudgetPeriod(prev || defaultPeriodRange, direction, settings.weekStartsOn)
      );
    },
    [defaultPeriodRange, settings.weekStartsOn]
  );

  const resetBudgetPeriodToCurrent = useCallback(() => {
    setNavigatedPeriodRange(null);
  }, []);

  // Cash flow calculation (Period-aware & Section 6 fixture compliant)
  const cashFlow = useMemo(() => {
    return calculatePeriodCashFlow({
      settings,
      transactions,
      bills,
      periodRange: activeBudgetPeriodRange,
      referenceDate: currentDate,
    });
  }, [settings, transactions, bills, activeBudgetPeriodRange, currentDate]);

  // Task Actions
  const addTask = (task: Omit<TaskItem, 'id' | 'createdAt'>): string => {
    const newTask: TaskItem = {
      ...task,
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => {
      const next = [newTask, ...prev];
      tasksRef.current = next;
      return next;
    });
    return newTask.id;
  };

  const updateTask = (id: string, updates: Partial<TaskItem>) => {
    setTasks((prev) => {
      const next = prev.map((t) => {
        if (t.id !== id) return t;
        const merged = { ...t, ...updates };
        if (updates.status !== undefined) {
          if (updates.status === 'completed' && !merged.completedAt) {
            merged.completedAt = new Date().toISOString();
          } else if (updates.status !== 'completed' && updates.completedAt === undefined) {
            merged.completedAt = undefined;
          }
        }
        return merged;
      });
      tasksRef.current = next;
      return next;
    });
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => {
      const next = prev.filter((t) => t.id !== id);
      tasksRef.current = next;
      return next;
    });
  };

  const restoreDeletedTask = (task: TaskItem) => {
    setTasks((prev) => {
      if (prev.some((t) => t.id === task.id)) return prev;
      const next = [task, ...prev];
      tasksRef.current = next;
      return next;
    });
  };

  const toggleTaskCompletion = (id: string) => {
    setTasks((prev) => {
      const next = prev.map((t): TaskItem => {
        if (t.id !== id) return t;
        const willBeCompleted = t.status !== 'completed';
        const newStatus: TaskStatus = willBeCompleted ? 'completed' : 'not_started';
        return {
          ...t,
          status: newStatus,
          completedAt: willBeCompleted ? new Date().toISOString() : undefined,
        };
      });
      tasksRef.current = next;
      return next;
    });
  };

  const archiveTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isArchived: true } : t))
    );
  };

  const unarchiveTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isArchived: false } : t))
    );
  };

  const rescheduleTask = (id: string, newDate: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, dueDate: newDate } : t))
    );
  };

  // Routine Actions
  const addRoutine = (
    routine: Omit<RoutineItem, 'id' | 'completedDates' | 'skippedDates'>
  ) => {
    const newRoutine: RoutineItem = {
      ...routine,
      id: `routine-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      completedDates: [],
      skippedDates: [],
    };
    setRoutines((prev) => [newRoutine, ...prev]);
  };

  const updateRoutine = (id: string, updates: Partial<RoutineItem>) => {
    setRoutines((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  };

  const updateRoutineWithScope = (
    id: string,
    occurrenceDate: string,
    scope: 'this' | 'future',
    updates: Partial<RoutineItem>
  ) => {
    setRoutines((prev) => {
      const routineIndex = prev.findIndex((r) => r.id === id);
      if (routineIndex === -1) return prev;
      const target = prev[routineIndex];

      if (scope === 'this') {
        const currentExceptions = target.exceptions || {};
        const updatedRoutine: RoutineItem = {
          ...target,
          exceptions: {
            ...currentExceptions,
            [occurrenceDate]: {
              ...(currentExceptions[occurrenceDate] || {}),
              ...updates,
            },
          },
        };
        const next = [...prev];
        next[routineIndex] = updatedRoutine;
        return next;
      }

      // scope === 'future'
      if (!occurrenceDate || occurrenceDate <= target.startDate) {
        const next = [...prev];
        next[routineIndex] = { ...target, ...updates };
        return next;
      }

      // Split series at occurrenceDate
      const splitEnd = getDayBefore(occurrenceDate);
      const updatedOriginal: RoutineItem = {
        ...target,
        endDate: splitEnd,
      };

      const newContinuation: RoutineItem = {
        ...target,
        ...updates,
        id: `routine-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        startDate: occurrenceDate,
        endDate: updates.endDate !== undefined ? updates.endDate : target.endDate,
        completedDates: target.completedDates.filter((d) => d >= occurrenceDate),
        skippedDates: target.skippedDates.filter((d) => d >= occurrenceDate),
        exceptions: {},
      };

      const next = [...prev];
      next[routineIndex] = updatedOriginal;
      next.unshift(newContinuation);
      return next;
    });
  };

  const deleteRoutine = (id: string) => {
    setRoutines((prev) => prev.filter((r) => r.id !== id));
  };

  const toggleRoutineCompletion = (id: string, date: string) => {
    setRoutines((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const isCompleted = r.completedDates.includes(date);
        return {
          ...r,
          completedDates: isCompleted
            ? r.completedDates.filter((d) => d !== date)
            : [...r.completedDates, date],
          skippedDates: r.skippedDates.filter((d) => d !== date), // unskip if completed
        };
      })
    );
  };

  const skipRoutineOccurrence = (id: string, date: string) => {
    setRoutines((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        return {
          ...r,
          skippedDates: r.skippedDates.includes(date)
            ? r.skippedDates
            : [...r.skippedDates, date],
          completedDates: r.completedDates.filter((d) => d !== date),
        };
      })
    );
  };

  const unskipRoutineOccurrence = (id: string, date: string) => {
    setRoutines((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        return {
          ...r,
          skippedDates: r.skippedDates.filter((d) => d !== date),
        };
      })
    );
  };

  const forgiveRoutineOccurrence = (id: string, date: string) => {
    setRoutines((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const currentForgiven = r.forgivenDates || [];
        return {
          ...r,
          forgivenDates: currentForgiven.includes(date)
            ? currentForgiven
            : [...currentForgiven, date],
          skippedDates: r.skippedDates.filter((d) => d !== date),
        };
      })
    );
  };

  const unforgiveRoutineOccurrence = (id: string, date: string) => {
    setRoutines((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        return {
          ...r,
          forgivenDates: (r.forgivenDates || []).filter((d) => d !== date),
        };
      })
    );
  };

  const toggleRoutinePause = (id: string) => {
    const pauseDateStr = getRealTodayDate(settingsRef.current.timeZone);
    setRoutines((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const willBePaused = !r.isPaused;
        return {
          ...r,
          isPaused: willBePaused,
          pausedDate: willBePaused ? pauseDateStr : undefined,
        };
      })
    );
  };

  // Goal Actions
  const addGoal = (goal: Omit<GoalItem, 'id' | 'createdAt'>) => {
    const newGoal: GoalItem = {
      ...goal,
      id: `goal-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
    };
    setGoals((prev) => [newGoal, ...prev]);
  };

  const updateGoal = (id: string, updates: Partial<GoalItem>) => {
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...updates } : g))
    );
  };

  const deleteGoal = (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
  };

  const toggleGoalStep = (goalId: string, stepId: string) => {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;
        const updatedSteps = g.steps.map((s) =>
          s.id === stepId ? { ...s, isCompleted: !s.isCompleted } : s
        );
        const allCompleted =
          updatedSteps.length > 0 && updatedSteps.every((s) => s.isCompleted);
        const status = allCompleted
          ? 'completed'
          : g.status === 'completed'
          ? 'in_progress'
          : g.status;
        return {
          ...g,
          steps: updatedSteps,
          status,
        };
      })
    );
  };

  const addGoalStep = (goalId: string, title: string) => {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;
        const newStep = {
          id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 3)}`,
          title,
          isCompleted: false,
        };
        return {
          ...g,
          steps: [...g.steps, newStep],
          status: g.status === 'completed' ? 'in_progress' : g.status,
        };
      })
    );
  };

  // Habit Actions
  const addHabit = (habit: Omit<HabitItem, 'id' | 'checkedDates'>) => {
    const newHabit: HabitItem = {
      ...habit,
      id: `habit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      checkedDates: [],
    };
    setHabits((prev) => [...prev, newHabit]);
  };

  const updateHabit = (id: string, updates: Partial<HabitItem>) => {
    setHabits((prev) =>
      prev.map((h) => (h.id === id ? { ...h, ...updates } : h))
    );
  };

  const deleteHabit = (id: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
  };

  const toggleHabitCheck = (id: string, date: string) => {
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const exists = h.checkedDates.includes(date);
        return {
          ...h,
          checkedDates: exists
            ? h.checkedDates.filter((d) => d !== date)
            : [...h.checkedDates, date],
        };
      })
    );
  };

  // Inbox Actions
  const addInboxItem = (text: string): string => {
    const item: BrainDumpItem = {
      id: `inbox-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    setInbox((prev) => [item, ...prev]);
    return item.id;
  };

  const deleteInboxItem = (id: string) => {
    setInbox((prev) => prev.filter((i) => i.id !== id));
  };

  const convertInboxToTask = (
    inboxId: string,
    taskData: Omit<TaskItem, 'id' | 'createdAt'>
  ) => {
    // 1. Add Task
    addTask(taskData);
    // 2. Remove Inbox Item
    deleteInboxItem(inboxId);
  };

  // Money Actions
  const addTransaction = (tx: Omit<FinancialTransaction, 'id'>): string => {
    const newTx: FinancialTransaction = {
      ...tx,
      id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };
    setTransactions((prev) => [newTx, ...prev]);
    return newTx.id;
  };

  const updateTransaction = (id: string, updates: Partial<FinancialTransaction>) => {
    setTransactions((prev) =>
      prev.map((tx) => {
        if (tx.id !== id) return tx;
        const updated = { ...tx, ...updates };

        // If this transaction is linked to a bill, synchronize the bill
        if (updated.linkedBillId) {
          setBills((bPrev) =>
            bPrev.map((b) => {
              if (b.id !== updated.linkedBillId) return b;
              return {
                ...b,
                actualPaidAmount: updated.amount,
                paidDate: updated.date,
                category: updated.category,
              };
            })
          );
        }

        // If linked to a savings pot, synchronize the deposit
        if (updated.linkedPotId) {
          setSavingsPots((pPrev) =>
            pPrev.map((pot) => {
              if (pot.id !== updated.linkedPotId) return pot;
              return {
                ...pot,
                deposits: pot.deposits.map((d) =>
                  d.linkedTransferId === id
                    ? { ...d, amount: updated.amount, date: updated.date }
                    : d
                ),
              };
            })
          );
        }

        return updated;
      })
    );
  };

  const deleteTransaction = (id: string) => {
    // Check if this transaction is linked to a bill
    const tx = transactions.find((t) => t.id === id);
    if (tx?.linkedBillId) {
      setBills((prev) =>
        prev.map((b) => {
          if (b.id !== tx.linkedBillId) return b;
          const nextOccurrences = b.paidOccurrences ? { ...b.paidOccurrences } : undefined;
          if (nextOccurrences) {
            for (const [occKey, rec] of Object.entries(nextOccurrences)) {
              if (rec.linkedExpenseId === id) {
                delete nextOccurrences[occKey];
              }
            }
          }
          return {
            ...b,
            ...(b.linkedExpenseId === id
              ? {
                  isPaid: false,
                  actualPaidAmount: undefined,
                  paidDate: undefined,
                  linkedExpenseId: undefined,
                }
              : {}),
            ...(nextOccurrences ? { paidOccurrences: nextOccurrences } : {}),
          };
        })
      );
    }
    // Check if this transaction is linked to a savings pot
    if (tx?.linkedPotId) {
      setSavingsPots((prev) =>
        prev.map((pot) =>
          pot.id === tx.linkedPotId
            ? {
                ...pot,
                deposits: pot.deposits.filter((d) => d.linkedTransferId !== id),
              }
            : pot
        )
      );
    }
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const addBill = (bill: Omit<BillItem, 'id' | 'isPaid'>) => {
    const newBill: BillItem = {
      ...bill,
      id: `bill-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      isPaid: false,
    };
    setBills((prev) => [...prev, newBill]);
  };

  const updateBill = (id: string, updates: Partial<BillItem>) => {
    setBills((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const updated = { ...b, ...updates };

        // If bill was paid and category or amount changed, synchronize linked transaction
        if (updated.isPaid && updated.linkedExpenseId) {
          setTransactions((tPrev) =>
            tPrev.map((tx) => {
              if (tx.id !== updated.linkedExpenseId) return tx;
              return {
                ...tx,
                category: updates.category ?? tx.category,
                amount: updates.actualPaidAmount ?? tx.amount,
                note: updates.title ? `Paid bill: ${updates.title}` : tx.note,
              };
            })
          );
        }

        return updated;
      })
    );
  };

  const deleteBill = (id: string) => {
    const bill = bills.find((b) => b.id === id);
    const linkedTxIds = new Set<string>();
    if (bill?.linkedExpenseId) linkedTxIds.add(bill.linkedExpenseId);
    if (bill?.paidOccurrences) {
      Object.values(bill.paidOccurrences).forEach((rec) => {
        if (rec.linkedExpenseId) linkedTxIds.add(rec.linkedExpenseId);
      });
    }
    setTransactions((prev) =>
      prev.filter((tx) => !linkedTxIds.has(tx.id) && tx.linkedBillId !== id)
    );
    setBills((prev) => prev.filter((b) => b.id !== id));
  };

  const markBillPaid = (
    billId: string,
    actualAmount: number,
    paymentDate: string,
    occurrenceDueDate?: string
  ) => {
    const bill = bills.find((b) => b.id === billId);
    if (!bill) return;

    const occKey = occurrenceDueDate || bill.dueDate;
    const existingPaid = bill.paidOccurrences?.[occKey];

    // Check if already paid to prevent double-charging
    if (existingPaid?.linkedExpenseId || (occKey === bill.dueDate && bill.isPaid && bill.linkedExpenseId)) {
      const txId = existingPaid?.linkedExpenseId || bill.linkedExpenseId;
      setTransactions((prev) =>
        prev.map((tx) =>
          tx.id === txId
            ? { ...tx, amount: actualAmount, date: paymentDate }
            : tx
        )
      );
      setBills((prev) =>
        prev.map((b) => {
          if (b.id !== billId) return b;
          const updatedOccurrences = {
            ...(b.paidOccurrences || {}),
            [occKey]: {
              actualPaidAmount: actualAmount,
              paidDate: paymentDate,
              linkedExpenseId: txId,
            },
          };
          return {
            ...b,
            paidOccurrences: updatedOccurrences,
            ...(occKey === b.dueDate ? { actualPaidAmount: actualAmount, paidDate: paymentDate } : {}),
          };
        })
      );
      return;
    }

    const linkedTxId = `tx-paid-bill-${Date.now()}`;
    const newTx: FinancialTransaction = {
      id: linkedTxId,
      type: 'expense',
      amount: actualAmount,
      category: bill.category,
      date: paymentDate,
      note: `Paid bill: ${bill.title}`,
      linkedBillId: billId,
    };

    setTransactions((prev) => [newTx, ...prev]);
    setBills((prev) =>
      prev.map((b) => {
        if (b.id !== billId) return b;
        const updatedOccurrences = {
          ...(b.paidOccurrences || {}),
          [occKey]: {
            actualPaidAmount: actualAmount,
            paidDate: paymentDate,
            linkedExpenseId: linkedTxId,
          },
        };
        const isBase = occKey === b.dueDate;
        return {
          ...b,
          paidOccurrences: updatedOccurrences,
          ...(isBase
            ? {
                isPaid: true,
                actualPaidAmount: actualAmount,
                paidDate: paymentDate,
                linkedExpenseId: linkedTxId,
              }
            : {}),
        };
      })
    );
  };

  const unpayBill = (billId: string, occurrenceDueDate?: string) => {
    const bill = bills.find((b) => b.id === billId);
    if (!bill) return;

    const occKey = occurrenceDueDate || bill.dueDate;
    const existingPaid = bill.paidOccurrences?.[occKey];
    const txIdToRemove = existingPaid?.linkedExpenseId || (occKey === bill.dueDate ? bill.linkedExpenseId : undefined);

    if (txIdToRemove) {
      setTransactions((prev) =>
        prev.filter((tx) => tx.id !== txIdToRemove)
      );
    }

    setBills((prev) =>
      prev.map((b) => {
        if (b.id !== billId) return b;
        const nextPaidOccurrences = { ...(b.paidOccurrences || {}) };
        delete nextPaidOccurrences[occKey];
        const isBase = occKey === b.dueDate;
        return {
          ...b,
          paidOccurrences: nextPaidOccurrences,
          ...(isBase
            ? {
                isPaid: false,
                actualPaidAmount: undefined,
                paidDate: undefined,
                linkedExpenseId: undefined,
              }
            : {}),
        };
      })
    );
  };

  // Savings Actions
  const addSavingsPot = (pot: Omit<SavingsPot, 'id' | 'deposits'>) => {
    const newPot: SavingsPot = {
      ...pot,
      id: `pot-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      deposits: [],
    };
    setSavingsPots((prev) => [...prev, newPot]);
  };

  const updateSavingsPot = (id: string, updates: Partial<SavingsPot>) => {
    setSavingsPots((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  const deleteSavingsPot = (id: string) => {
    setTransactions((prev) =>
      prev.map((tx) => (tx.linkedPotId === id ? { ...tx, linkedPotId: undefined } : tx))
    );
    setSavingsPots((prev) => prev.filter((p) => p.id !== id));
  };

  const addSavingsDeposit = (
    potId: string,
    amount: number,
    date: string,
    source: 'spending_balance' | 'outside'
  ) => {
    let linkedTxId: string | undefined = undefined;

    if (source === 'spending_balance') {
      linkedTxId = `tx-pot-transfer-${Date.now()}`;
      const newTx: FinancialTransaction = {
        id: linkedTxId,
        type: 'transfer',
        amount,
        category: 'Savings',
        date,
        note: `Transfer into savings pot`,
        linkedPotId: potId,
      };
      setTransactions((prev) => [newTx, ...prev]);
    }

    const newDeposit = {
      id: `dep-${Date.now()}`,
      amount,
      date,
      source,
      linkedTransferId: linkedTxId,
    };

    setSavingsPots((prev) =>
      prev.map((p) =>
        p.id === potId
          ? { ...p, deposits: [...p.deposits, newDeposit] }
          : p
      )
    );
  };

  // Debt Actions
  const addDebt = (debt: Omit<DebtItem, 'id'>) => {
    const newDebt: DebtItem = {
      ...debt,
      id: `debt-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };
    setDebts((prev) => [...prev, newDebt]);
  };

  const updateDebt = (id: string, updates: Partial<DebtItem>) => {
    setDebts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
    );
  };

  const deleteDebt = (id: string) => {
    setDebts((prev) => prev.filter((d) => d.id !== id));
  };

  // Food & Grocery Actions
  const addRecipe = (recipe: Omit<RecipeItem, 'id'>) => {
    const newRecipe: RecipeItem = {
      ...recipe,
      id: `rec-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };
    setRecipes((prev) => [...prev, newRecipe]);
  };

  const updateRecipe = (id: string, updates: Partial<RecipeItem>) => {
    setRecipes((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  };

  const deleteRecipe = (id: string) => {
    setPlannedMeals((prev) =>
      prev.map((m) => (m.recipeId === id ? { ...m, recipeId: undefined } : m))
    );
    setRecipes((prev) => prev.filter((r) => r.id !== id));
  };

  const addPlannedMeal = (meal: Omit<PlannedMeal, 'id'>) => {
    const newMeal: PlannedMeal = {
      ...meal,
      id: `pm-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };
    setPlannedMeals((prev) => [...prev, newMeal]);
  };

  const updatePlannedMeal = (id: string, updates: Partial<PlannedMeal>) => {
    setPlannedMeals((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
    );
  };

  const deletePlannedMeal = (id: string) => {
    setPlannedMeals((prev) => prev.filter((m) => m.id !== id));
  };

  const toggleMealConsumed = (mealId: string) => {
    setPlannedMeals((prev) =>
      prev.map((m) => (m.id === mealId ? { ...m, isConsumed: !m.isConsumed } : m))
    );
  };

  const regenerateGroceries = (weekStartDateStr: string) => {
    // 1. Gather all planned meals for this week (timezone safe)
    const [y, m, d] = weekStartDateStr.split('-').map(Number);
    const weekDates = new Set<string>();
    for (let i = 0; i < 7; i++) {
      const dt = new Date(y, m - 1, d + i);
      const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      weekDates.add(iso);
    }

    const weekMeals = plannedMeals.filter((meal) => weekDates.has(meal.date));

    // 2. Aggregate ingredients by normalized ingredient name & compatible measurement dimension
    const nextGroceries = aggregateGroceriesFromMeals({
      weekMeals,
      existingGroceries: groceries,
    });

    setGroceries(nextGroceries);
  };

  const addGroceryItem = (item: Omit<GroceryItem, 'id' | 'sourceType'>) => {
    const newItem: GroceryItem = {
      ...item,
      id: `gro-man-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      sourceType: 'manual',
    };
    setGroceries((prev) => [...prev, newItem]);
  };

  const updateGroceryItem = (id: string, updates: Partial<GroceryItem>) => {
    setGroceries((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...updates } : g))
    );
  };

  const deleteGroceryItem = (id: string) => {
    setGroceries((prev) => prev.filter((g) => g.id !== id));
  };

  const toggleGroceryPurchased = (id: string) => {
    setGroceries((prev) =>
      prev.map((g) => (g.id === id ? { ...g, isPurchased: !g.isPurchased } : g))
    );
  };

  const resetGroceryCheckmarks = () => {
    setGroceries((prev) => prev.map((g) => ({ ...g, isPurchased: false })));
  };

  // Workout Actions
  const addWorkoutSession = (session: Omit<WorkoutSession, 'id'>): string => {
    const newId = `wo-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const newSession: WorkoutSession = {
      ...session,
      id: newId,
    };
    setWorkouts((prev) => {
      // If adding a non-rest session on a date that only had an empty rest placeholder, remove that placeholder
      const cleaned = session.isRestDay
        ? prev
        : prev.filter((w) => !(w.date === session.date && w.isRestDay && (!w.exercises || w.exercises.length === 0)));
      return [...cleaned, newSession];
    });
    return newId;
  };

  const updateWorkoutSession = (id: string, updates: Partial<WorkoutSession>) => {
    setWorkouts((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...updates } : w))
    );
  };

  const deleteWorkoutSession = (id: string) => {
    setWorkouts((prev) => prev.filter((w) => w.id !== id));
  };

  const toggleSetCompleted = (
    sessionId: string,
    exerciseId: string,
    setNumber: number
  ) => {
    setWorkouts((prev) =>
      prev.map((w) => {
        if (w.id !== sessionId) return w;
        return {
          ...w,
          exercises: w.exercises.map((ex) => {
            if (ex.id !== exerciseId) return ex;
            return {
              ...ex,
              sets: ex.sets.map((s) =>
                s.setNumber === setNumber
                  ? { ...s, isCompleted: !s.isCompleted }
                  : s
              ),
            };
          }),
        };
      })
    );
  };

  const addExerciseToSession = (
    sessionId: string,
    exercise: Omit<WorkoutExercise, 'id'>
  ) => {
    const newEx: WorkoutExercise = {
      ...exercise,
      id: `ex-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };
    setWorkouts((prev) =>
      prev.map((w) =>
        w.id === sessionId ? { ...w, exercises: [...w.exercises, newEx] } : w
      )
    );
  };

  const updateExerciseInSession = (
    sessionId: string,
    exerciseId: string,
    updates: Partial<WorkoutExercise>
  ) => {
    setWorkouts((prev) =>
      prev.map((w) =>
        w.id === sessionId
          ? {
              ...w,
              exercises: w.exercises.map((ex) =>
                ex.id === exerciseId ? { ...ex, ...updates } : ex
              ),
            }
          : w
      )
    );
  };

  const deleteExerciseFromSession = (
    sessionId: string,
    exerciseId: string
  ) => {
    setWorkouts((prev) =>
      prev.map((w) =>
        w.id === sessionId
          ? {
              ...w,
              exercises: w.exercises.filter((ex) => ex.id !== exerciseId),
            }
          : w
      )
    );
  };

  const addSetToExercise = (
    sessionId: string,
    exerciseId: string,
    setDetails?: Partial<WorkoutExerciseSet>
  ) => {
    setWorkouts((prev) =>
      prev.map((w) => {
        if (w.id !== sessionId) return w;
        return {
          ...w,
          exercises: w.exercises.map((ex) => {
            if (ex.id !== exerciseId) return ex;
            const lastSet = ex.sets[ex.sets.length - 1];
            const newSetNumber = ex.sets.length + 1;
            const newSet: WorkoutExerciseSet = {
              setNumber: newSetNumber,
              weightKg: setDetails?.weightKg ?? lastSet?.weightKg ?? 20,
              weightUnit: setDetails?.weightUnit ?? lastSet?.weightUnit ?? 'kg',
              reps: setDetails?.reps ?? lastSet?.reps ?? 10,
              restSeconds: setDetails?.restSeconds ?? lastSet?.restSeconds ?? 60,
              isCompleted: false,
            };
            return {
              ...ex,
              sets: [...ex.sets, newSet],
            };
          }),
        };
      })
    );
  };

  const updateSetInExercise = (
    sessionId: string,
    exerciseId: string,
    setNumber: number,
    updates: Partial<WorkoutExerciseSet>
  ) => {
    setWorkouts((prev) =>
      prev.map((w) => {
        if (w.id !== sessionId) return w;
        return {
          ...w,
          exercises: w.exercises.map((ex) => {
            if (ex.id !== exerciseId) return ex;
            return {
              ...ex,
              sets: ex.sets.map((s) =>
                s.setNumber === setNumber ? { ...s, ...updates } : s
              ),
            };
          }),
        };
      })
    );
  };

  const deleteSetFromExercise = (
    sessionId: string,
    exerciseId: string,
    setNumber: number
  ) => {
    setWorkouts((prev) =>
      prev.map((w) => {
        if (w.id !== sessionId) return w;
        return {
          ...w,
          exercises: w.exercises.map((ex) => {
            if (ex.id !== exerciseId) return ex;
            const filtered = ex.sets.filter((s) => s.setNumber !== setNumber);
            const reindexed = filtered.map((s, idx) => ({
              ...s,
              setNumber: idx + 1,
            }));
            return { ...ex, sets: reindexed };
          }),
        };
      })
    );
  };

  // Weight Actions
  const addWeightProfile = (profile: Omit<WeightProfile, 'id'>): boolean => {
    if (weightProfiles.length >= 8) return false;
    const newProfile: WeightProfile = {
      ...profile,
      id: `wp-${Date.now()}`,
    };
    setWeightProfiles((prev) => [...prev, newProfile]);
    return true;
  };

  const addWeightRecord = (record: Omit<WeightRecord, 'id'>): string => {
    const newRecord: WeightRecord = {
      ...record,
      id: `wr-${Date.now()}`,
    };
    setWeightRecords((prev) => [newRecord, ...prev]);
    return newRecord.id;
  };

  const deleteWeightRecord = (id: string) => {
    setWeightRecords((prev) => prev.filter((r) => r.id !== id));
  };

  // Hydration Actions
  const addWaterLog = (amountMl: number, timeStr?: string): string => {
    const finalTime = timeStr || getCurrentTimeStr();
    const newEntry: HydrationLogEntry = {
      id: `hl-${Date.now()}`,
      date: currentDate,
      time: finalTime,
      amountMl,
    };
    setHydrationEntries((prev) => [newEntry, ...prev]);
    return newEntry.id;
  };

  const undoLastWaterLog = () => {
    // Find latest log for current date
    const todayLogs = hydrationEntries.filter((e) => e.date === currentDate);
    if (todayLogs.length === 0) return;
    const lastId = todayLogs[0].id; // newest first
    setHydrationEntries((prev) => prev.filter((e) => e.id !== lastId));
  };

  const deleteWaterLog = (id: string) => {
    setHydrationEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const updateWaterTarget = (targetMl: number) => {
    setHydrationTargets((prev) => [
      { date: currentDate, targetMl },
      ...prev.filter((t) => t.date !== currentDate),
    ]);
  };

  // Calendar Event Actions
  const addCalendarEvent = (event: Omit<CalendarEvent, 'id'>) => {
    const newEv: CalendarEvent = {
      ...event,
      id: `ce-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };
    setCalendarEvents((prev) => {
      const next = [...prev, newEv];
      calendarEventsRef.current = next;
      return next;
    });
  };

  const updateCalendarEvent = (id: string, updates: Partial<CalendarEvent>) => {
    setCalendarEvents((prev) => {
      const next = prev.map((e) => (e.id === id ? { ...e, ...updates } : e));
      calendarEventsRef.current = next;
      return next;
    });
  };

  const deleteCalendarEvent = (id: string) => {
    setCalendarEvents((prev) => {
      const next = prev.filter((e) => e.id !== id);
      calendarEventsRef.current = next;
      return next;
    });
  };

  const restoreCalendarEvent = (event: CalendarEvent) => {
    setCalendarEvents((prev) => {
      if (prev.some((e) => e.id === event.id)) return prev;
      const next = [...prev, event];
      calendarEventsRef.current = next;
      return next;
    });
  };

  // Weekly Review Actions
  const saveWeeklyReview = (
    entry: Omit<WeeklyReviewEntry, 'id' | 'updatedAt'> & { id?: string }
  ): WeeklyReviewEntry => {
    const existing = weeklyReviewsRef.current.find(
      (r) => r.weekStartDate === entry.weekStartDate || (entry.id && r.id === entry.id)
    );
    const savedEntry: WeeklyReviewEntry = {
      ...existing,
      ...entry,
      id: existing?.id || entry.id || `wrv-${entry.weekStartDate}`,
      updatedAt: new Date().toISOString(),
    };
    setWeeklyReviews((prev) => {
      const filtered = prev.filter(
        (r) => r.weekStartDate !== savedEntry.weekStartDate && r.id !== savedEntry.id
      );
      const next = [savedEntry, ...filtered].sort((a, b) =>
        b.weekStartDate.localeCompare(a.weekStartDate)
      );
      weeklyReviewsRef.current = next;
      return next;
    });
    return savedEntry;
  };

  const deleteWeeklyReview = (idOrWeekStartDate: string) => {
    setWeeklyReviews((prev) => {
      const next = prev.filter(
        (r) => r.id !== idOrWeekStartDate && r.weekStartDate !== idOrWeekStartDate
      );
      weeklyReviewsRef.current = next;
      return next;
    });
  };

  const undoLastCreation = useCallback(() => {
    if (!lastCreationFeedback) return;
    const { id, type } = lastCreationFeedback;
    if (type === 'task') deleteTask(id);
    else if (type === 'expense') deleteTransaction(id);
    else if (type === 'workout') deleteWorkoutSession(id);
    else if (type === 'weight') deleteWeightRecord(id);
    else if (type === 'water') deleteWaterLog(id);
    else if (type === 'thought') deleteInboxItem(id);
    setLastCreationFeedback(null);
    setHighlightedTaskId((prev) => (prev === id ? null : prev));
  }, [lastCreationFeedback]);

  // Household & Tool Customization Actions
  const addHouseholdMember = (name: string, color: string) => {
    const newMember: HouseholdMember = {
      id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: name.trim(),
      color: color || '#087F83',
    };
    const current = settings.householdMembers || [];
    updateSettings({ householdMembers: [...current, newMember] });
  };

  const removeHouseholdMember = (id: string) => {
    const current = settings.householdMembers || [];
    setTasks((prev) =>
      prev.map((t) => (t.assignedMemberId === id ? { ...t, assignedMemberId: undefined } : t))
    );
    setRoutines((prev) =>
      prev.map((r) => (r.assignedMemberId === id ? { ...r, assignedMemberId: undefined } : r))
    );
    updateSettings({ householdMembers: current.filter((m) => m.id !== id) });
  };

  const toggleToolEnabled = (toolId: string) => {
    const next = toggleModuleEnabledInList(settings.enabledTools, toolId);
    updateSettings({ enabledTools: next });
    if (!isModuleOrToolEnabled(activeView, next)) {
      setActiveView(getFallbackEnabledToolView(next));
    }
  };

  const toggleToolPinned = (toolId: string) => {
    const next = toggleModulePinnedInList(settings.pinnedTools, toolId);
    updateSettings({ pinnedTools: next });
  };

  // Calendar Export
  const exportCalendarIcs = () => {
    const icsContent = serializePlannerCalendarToIcs({
      tasks,
      calendarEvents,
      timeZone: settings.timeZone,
      calendarName: settings.ownerName
        ? `${settings.ownerName}'s Life Planner`
        : 'Our Life Planner',
    });

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `our-life-planner-${currentDate}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const clearAllCollectionsInMemory = () => {
    setTasks([]); tasksRef.current = [];
    setRoutines([]); routinesRef.current = [];
    setGoals([]); goalsRef.current = [];
    setHabits([]); habitsRef.current = [];
    setInbox([]); inboxRef.current = [];
    setTransactions([]); transactionsRef.current = [];
    setBills([]); billsRef.current = [];
    setSavingsPots([]); savingsPotsRef.current = [];
    setDebts([]); debtsRef.current = [];
    setRecipes([]); recipesRef.current = [];
    setPlannedMeals([]); plannedMealsRef.current = [];
    setGroceries([]); groceriesRef.current = [];
    setWorkouts([]); workoutsRef.current = [];
    setWeightProfiles([]); weightProfilesRef.current = [];
    setSelectedProfileId('');
    setWeightRecords([]); weightRecordsRef.current = [];
    setHydrationEntries([]); hydrationEntriesRef.current = [];
    setHydrationTargets([]); hydrationTargetsRef.current = [];
    setCalendarEvents([]); calendarEventsRef.current = [];
    setWeeklyReviews([]); weeklyReviewsRef.current = [];
  };

  // Global operations
  const removeSampleData = () => {
    setTasks((prev) => prev.filter((i) => !i.isSample));
    setRoutines((prev) => prev.filter((i) => !i.isSample));
    setGoals((prev) => prev.filter((i) => !i.isSample));
    setHabits((prev) => prev.filter((i) => !i.isSample));
    setInbox((prev) => prev.filter((i) => !i.isSample));
    setTransactions((prev) => prev.filter((i) => !i.isSample));
    setBills((prev) => prev.filter((i) => !i.isSample));
    setSavingsPots((prev) => prev.filter((i) => !i.isSample));
    setDebts((prev) => prev.filter((i) => !i.isSample));
    setRecipes((prev) => prev.filter((i) => !i.isSample));
    setPlannedMeals((prev) => prev.filter((i) => !i.isSample));
    setGroceries((prev) => prev.filter((i) => !i.isSample));
    setWorkouts((prev) => prev.filter((i) => !i.isSample));
    setWeightRecords((prev) => prev.filter((i) => !i.isSample));
    setHydrationEntries((prev) => prev.filter((i) => !i.isSample));
    setCalendarEvents((prev) => prev.filter((i) => !i.isSample));
    setWeeklyReviews((prev) => prev.filter((i) => !i.isSample));
    updateSettings({
      isSampleDataActive: false,
      budgetOpeningBalance: 0,
      budgetPlannedIncome: 0,
      budgetPlannedSavings: 0,
      budgetCategoryLimits: {},
    });
  };

  // Clears planner entries while keeping settings/profile & creating a recovery snapshot (LP-06 / LP-07)
  const resetAllData = () => {
    const snap = savePreRestoreSnapshot(createDataSnapshot(), currentRevisionRef.current);
    if (snap) setPreRestoreSnapshot(snap);
    clearAllCollectionsInMemory();
    updateSettings({
      isSampleDataActive: false,
      budgetOpeningBalance: 0,
      budgetPlannedIncome: 0,
      budgetPlannedSavings: 0,
      budgetCategoryLimits: {},
    });
  };

  // Starts a clean empty planner without demo budget or weight fixtures (LP-06)
  const startEmptyPlanner = (customSettings?: Partial<UserSettings>) => {
    const currentSnap = createDataSnapshot();
    const hasAnyRecords =
      currentSnap.tasks.length > 0 ||
      currentSnap.routines.length > 0 ||
      currentSnap.goals.length > 0 ||
      currentSnap.habits.length > 0 ||
      currentSnap.transactions.length > 0 ||
      currentSnap.bills.length > 0 ||
      currentSnap.calendarEvents.length > 0;

    if (hasAnyRecords) {
      const snap = savePreRestoreSnapshot(currentSnap, currentRevisionRef.current);
      if (snap) setPreRestoreSnapshot(snap);
    }

    clearAllCollectionsInMemory();
    const cleanSettings = createEmptySettings({
      ...customSettings,
      isSampleDataActive: false,
      hasCompletedSetup: true,
    });
    if (cleanSettings.currency) {
      cleanSettings.currencySymbol = getCurrencySymbol(cleanSettings.currency);
    }
    cleanSettings.enabledTools = migrateEnabledTools(cleanSettings.enabledTools);
    cleanSettings.pinnedTools = migratePinnedTools(cleanSettings.pinnedTools);
    applyThemeToDocument(cleanSettings.theme, cleanSettings.accentColor || 'teal');
    const freshToday = getRealTodayDate(cleanSettings.timeZone);
    setTodayDate(freshToday);
    setCurrentDate(freshToday);
    setSettings(cleanSettings);
    settingsRef.current = cleanSettings;
    triggerSave(cleanSettings);
  };

  // Full erase of all app-owned personal data, settings, cloud session, and recovery snapshots on this device (LP-07)
  const eraseAllPlannerData = () => {
    isApplyingExternalSyncRef.current = true;
    clearAllCollectionsInMemory();
    clearCloudSession();
    eraseAllAppStorageKeys();

    const freshSettings = createEmptySettings({
      hasCompletedSetup: false,
      isSampleDataActive: false,
    });
    applyThemeToDocument(freshSettings.theme, freshSettings.accentColor || 'teal');
    setSettings(freshSettings);
    settingsRef.current = freshSettings;
    currentRevisionRef.current = 1;
    baseSnapshotRef.current = null;
    setPreRestoreSnapshot(null);
    setCorruptStartupQuarantine(null);
    setConflictQueue([]);
    setLastSaveError(null);
    setCloudSyncState(getStoredCloudSyncState());
    setSavingState('saved_local');
    setActiveView('today');
    setActiveModal('setup');
  };

  const loadSampleData = () => {
    const snap = savePreRestoreSnapshot(createDataSnapshot(), currentRevisionRef.current);
    if (snap) setPreRestoreSnapshot(snap);

    const relative = generateRelativeSampleData(todayDate);

    setTasks(relative.tasks); tasksRef.current = relative.tasks;
    setRoutines(relative.routines); routinesRef.current = relative.routines;
    setGoals(relative.goals); goalsRef.current = relative.goals;
    setHabits(relative.habits); habitsRef.current = relative.habits;
    setInbox(relative.inbox); inboxRef.current = relative.inbox;
    setTransactions(relative.transactions); transactionsRef.current = relative.transactions;
    setBills(relative.bills); billsRef.current = relative.bills;
    setSavingsPots(relative.savingsPots); savingsPotsRef.current = relative.savingsPots;
    setDebts(relative.debts); debtsRef.current = relative.debts;
    setRecipes(relative.recipes); recipesRef.current = relative.recipes;
    setPlannedMeals(relative.plannedMeals); plannedMealsRef.current = relative.plannedMeals;
    setGroceries(relative.groceries); groceriesRef.current = relative.groceries;
    setWorkouts(relative.workouts); workoutsRef.current = relative.workouts;
    setWeightProfiles(relative.weightProfiles); weightProfilesRef.current = relative.weightProfiles;
    setSelectedProfileId('wp-1');
    setWeightRecords(relative.weightRecords); weightRecordsRef.current = relative.weightRecords;
    setHydrationEntries(relative.hydrationEntries); hydrationEntriesRef.current = relative.hydrationEntries;
    setHydrationTargets(relative.hydrationTargets); hydrationTargetsRef.current = relative.hydrationTargets;
    setCalendarEvents(relative.calendarEvents); calendarEventsRef.current = relative.calendarEvents;
    setWeeklyReviews([]); weeklyReviewsRef.current = [];
    updateSettings({
      budgetOpeningBalance: INITIAL_SETTINGS.budgetOpeningBalance,
      budgetPlannedIncome: INITIAL_SETTINGS.budgetPlannedIncome,
      budgetPlannedSavings: INITIAL_SETTINGS.budgetPlannedSavings,
      budgetCategoryLimits: INITIAL_SETTINGS.budgetCategoryLimits,
      isSampleDataActive: true,
    });
  };

  const exportBackup = (): PlannerBackupData => {
    return {
      ...createDataSnapshot(),
      revision: currentRevisionRef.current,
    };
  };

  const validateBackup = (input: unknown): BackupValidationResult => {
    return validateBackupData(input);
  };

  const restoreBackup = (backup: PlannerBackupData): boolean => {
    const result = atomicRestoreBackup({
      incomingBackup: backup,
      currentSnapshot: createDataSnapshot(),
      currentRevision: currentRevisionRef.current,
    });

    if (!result.success || !result.restoredData || result.nextRevision === undefined) {
      return false;
    }

    try {
      isApplyingExternalSyncRef.current = true;
      applyStateFromBackup(result.restoredData);
      currentRevisionRef.current = result.nextRevision;
      baseSnapshotRef.current = result.restoredData;
      setPreRestoreSnapshot(result.previousSnapshot || getPreRestoreSnapshot());
      syncManagerRef.current?.broadcast(result.nextRevision, result.restoredData);
      setSavingState('saved_local');
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const rollbackLastRestore = (): boolean => {
    const result = rollbackPreRestoreSnapshot({
      currentSnapshot: createDataSnapshot(),
      currentRevision: currentRevisionRef.current,
    });

    if (!result.success || !result.restoredData || result.nextRevision === undefined) {
      return false;
    }

    try {
      isApplyingExternalSyncRef.current = true;
      applyStateFromBackup(result.restoredData);
      currentRevisionRef.current = result.nextRevision;
      baseSnapshotRef.current = result.restoredData;
      setPreRestoreSnapshot(result.previousSnapshot || getPreRestoreSnapshot());
      syncManagerRef.current?.broadcast(result.nextRevision, result.restoredData);
      setSavingState('saved_local');
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const generateStandaloneHtml = (): string => {
    const backup = exportBackup();
    backup.settings = {
      ...backup.settings,
      edition: 'downloaded',
    };
    return buildStandaloneFallbackHtml(backup);
  };

  return (
    <PlannerContext.Provider
      value={{
        settings,
        updateSettings,
        todayDate,
        currentDate,
        setCurrentDate,
        isViewingToday: currentDate === todayDate,
        goToToday: () => setCurrentDate(todayDate),
        activeView,
        setActiveView,
        activeModal,
        setActiveModal,
        savingState,
        setSavingState,
        lastSaveError,
        retrySave,
        exportUnsavedSnapshot,
        corruptStartupQuarantine,
        exportCorruptQuarantine,
        dismissCorruptQuarantine,
        conflictItem,
        conflictQueue,
        setConflictItem,
        resolveConflict,
        cloudSyncState,
        setCloudSyncState,
        syncWithCloudNow,
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
        selectedProfileId,
        setSelectedProfileId,
        weightRecords,
        hydrationEntries,
        hydrationTargets,
        calendarEvents,
        weeklyReviews,
        cashFlow,
        budgetPeriodRange: activeBudgetPeriodRange,
        navigateBudgetPeriod: navigateBudgetPeriodRange,
        resetBudgetPeriodToCurrent,
        addTask,
        updateTask,
        deleteTask,
        restoreDeletedTask,
        toggleTaskCompletion,
        archiveTask,
        unarchiveTask,
        rescheduleTask,
        addRoutine,
        updateRoutine,
        updateRoutineWithScope,
        deleteRoutine,
        toggleRoutineCompletion,
        skipRoutineOccurrence,
        unskipRoutineOccurrence,
        forgiveRoutineOccurrence,
        unforgiveRoutineOccurrence,
        toggleRoutinePause,
        addGoal,
        updateGoal,
        deleteGoal,
        toggleGoalStep,
        addGoalStep,
        addHabit,
        updateHabit,
        deleteHabit,
        toggleHabitCheck,
        addInboxItem,
        deleteInboxItem,
        convertInboxToTask,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addBill,
        updateBill,
        deleteBill,
        markBillPaid,
        unpayBill,
        addSavingsPot,
        updateSavingsPot,
        deleteSavingsPot,
        addSavingsDeposit,
        addDebt,
        updateDebt,
        deleteDebt,
        addRecipe,
        updateRecipe,
        deleteRecipe,
        addPlannedMeal,
        updatePlannedMeal,
        deletePlannedMeal,
        toggleMealConsumed,
        regenerateGroceries,
        addGroceryItem,
        updateGroceryItem,
        deleteGroceryItem,
        toggleGroceryPurchased,
        resetGroceryCheckmarks,
        addWorkoutSession,
        updateWorkoutSession,
        deleteWorkoutSession,
        toggleSetCompleted,
        addExerciseToSession,
        updateExerciseInSession,
        deleteExerciseFromSession,
        addSetToExercise,
        updateSetInExercise,
        deleteSetFromExercise,
        addWeightProfile,
        addWeightRecord,
        deleteWeightRecord,
        addWaterLog,
        undoLastWaterLog,
        deleteWaterLog,
        updateWaterTarget,
        addCalendarEvent,
        updateCalendarEvent,
        deleteCalendarEvent,
        restoreCalendarEvent,
        saveWeeklyReview,
        deleteWeeklyReview,
        addHouseholdMember,
        removeHouseholdMember,
        toggleToolEnabled,
        toggleToolPinned,
        exportCalendarIcs,
        removeSampleData,
        resetAllData,
        startEmptyPlanner,
        eraseAllPlannerData,
        loadSampleData,
        exportBackup,
        validateBackup,
        restoreBackup,
        preRestoreSnapshot,
        rollbackLastRestore,
        generateStandaloneHtml,
        lastCreationFeedback,
        setLastCreationFeedback,
        undoLastCreation,
        highlightedTaskId,
        setHighlightedTaskId,
      }}
    >
      {children}
    </PlannerContext.Provider>
  );
};

export const usePlanner = () => {
  const context = useContext(PlannerContext);
  if (!context) throw new Error('usePlanner must be used within a PlannerProvider');
  return context;
};
