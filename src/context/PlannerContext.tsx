import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import {
  BillItem,
  BrainDumpItem,
  CalendarEvent,
  ConflictItem,
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
  UserSettings,
  WeightProfile,
  WeightRecord,
  WorkoutSession,
  WorkoutExercise,
  WorkoutExerciseSet,
} from '../types/planner';
import { getDayBefore } from '../utils/routineRecurrence';
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
} from '../utils/sampleData';
import { calculateCashFlow, CashFlowCalculation } from '../utils/calculations';
import { getCurrencySymbol } from '../utils/formatters';

const STORAGE_KEY_DATA = 'our_life_planner_data_v1';
const STORAGE_KEY_SETTINGS = 'our_life_planner_settings_v1';

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
  conflictItem: ConflictItem | null;
  setConflictItem: (conflict: ConflictItem | null) => void;
  resolveConflict: (chosenVersion: 'local' | 'online') => void;

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

  // Computed Summaries
  cashFlow: CashFlowCalculation;

  // Task Actions
  addTask: (task: Omit<TaskItem, 'id' | 'createdAt'>) => void;
  updateTask: (id: string, updates: Partial<TaskItem>) => void;
  deleteTask: (id: string) => void;
  toggleTaskCompletion: (id: string) => void;

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
  addInboxItem: (text: string) => void;
  deleteInboxItem: (id: string) => void;
  convertInboxToTask: (inboxId: string, taskData: Omit<TaskItem, 'id' | 'createdAt'>) => void;

  // Money Actions
  addTransaction: (tx: Omit<FinancialTransaction, 'id'>) => void;
  updateTransaction: (id: string, updates: Partial<FinancialTransaction>) => void;
  deleteTransaction: (id: string) => void;
  addBill: (bill: Omit<BillItem, 'id' | 'isPaid'>) => void;
  updateBill: (id: string, updates: Partial<BillItem>) => void;
  deleteBill: (id: string) => void;
  markBillPaid: (billId: string, actualAmount: number, paymentDate: string) => void;
  unpayBill: (billId: string) => void;

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
  addWeightRecord: (record: Omit<WeightRecord, 'id'>) => void;
  deleteWeightRecord: (id: string) => void;

  // Hydration Actions
  addWaterLog: (amountMl: number, timeStr: string) => void;
  undoLastWaterLog: () => void;
  deleteWaterLog: (id: string) => void;
  updateWaterTarget: (targetMl: number) => void;

  // Calendar Event Actions
  addCalendarEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  deleteCalendarEvent: (id: string) => void;

  // Global Operations
  removeSampleData: () => void;
  resetAllData: () => void;
  loadSampleData: () => void;
  exportBackup: () => PlannerBackupData;
  restoreBackup: (backup: PlannerBackupData) => boolean;
  generateStandaloneHtml: () => string;
}

const PlannerContext = createContext<PlannerContextType | undefined>(undefined);

export const getRealTodayDate = (timeZone?: string): string => {
  try {
    if (timeZone) {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(new Date());
    }
  } catch (e) {
    console.warn('Invalid timeZone:', timeZone, e);
  }
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const applyThemeToDocument = (theme: 'light' | 'dark' | 'system') => {
  if (typeof window === 'undefined') return;
  const isDark =
    theme === 'dark'
      ? true
      : theme === 'light'
      ? false
      : Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const root = document.documentElement;
  const body = document.body;

  if (isDark) {
    root.classList.add('dark');
    root.classList.remove('light');
    root.setAttribute('data-theme', 'dark');
    root.style.colorScheme = 'dark';
    if (body) {
      body.classList.add('dark');
      body.classList.remove('light');
      body.style.backgroundColor = '#0B1220';
      body.style.color = '#EDF4FF';
    }
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
    root.setAttribute('data-theme', 'light');
    root.style.colorScheme = 'light';
    if (body) {
      body.classList.remove('dark');
      body.classList.add('light');
      body.style.backgroundColor = '#F3F8FC';
      body.style.color = '#071A3A';
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
        if (parsed.currency) {
          parsed.currencySymbol = getCurrencySymbol(parsed.currency);
        }
        return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_SETTINGS;
  });

  // Dynamic real today and selected current date
  const [todayDate, setTodayDate] = useState<string>(() => getRealTodayDate(settings.timeZone));
  const [currentDate, setCurrentDate] = useState<string>(() => getRealTodayDate(settings.timeZone));
  const [activeView, setActiveView] = useState<string>('today');
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [savingState, setSavingState] = useState<SavingState>(
    settings.edition === 'downloaded' ? 'saved_local' : 'saved_online'
  );
  const [conflictItem, setConflictItem] = useState<ConflictItem | null>(null);

  const settingsRef = useRef<UserSettings>(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Reactive theme application: explicit Light and Dark override system; only System follows it.
  useEffect(() => {
    applyThemeToDocument(settings.theme || 'light');

    if (settings.theme === 'system' && typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => {
        applyThemeToDocument('system');
      };
      mediaQuery.addEventListener('change', listener);
      return () => {
        mediaQuery.removeEventListener('change', listener);
      };
    }
  }, [settings.theme]);

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

  // Load from local storage or standalone bootstrap on mount
  useEffect(() => {
    try {
      // 1. Check for standalone embedded bootstrap data
      const bootstrapEl = document.getElementById('embedded-planner-bootstrap-data');
      if (bootstrapEl && bootstrapEl.textContent) {
        const raw = bootstrapEl.textContent.trim();
        if (raw && !raw.includes('<!--BOOTSTRAP_DATA_PLACEHOLDER-->')) {
          try {
            const parsedBootstrap = JSON.parse(raw) as PlannerBackupData;
            if (parsedBootstrap.version === '1.0.0') {
              const existingStored = localStorage.getItem(STORAGE_KEY_DATA);
              if (!existingStored) {
                // First time opening the offline standalone bundle file
                restoreBackup(parsedBootstrap);
                const stg = {
                  ...parsedBootstrap.settings,
                  edition: 'downloaded' as EditionType,
                };
                setSettings(stg);
                localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(stg));
                localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(parsedBootstrap));
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

      if (!storedSettings && !storedData) {
        // First visit on online app: open setup wizard
        setActiveModal('setup');
      }

      if (storedData) {
        const parsed = JSON.parse(storedData) as PlannerBackupData;
        if (parsed.version === '1.0.0') {
          if (parsed.tasks) setTasks(parsed.tasks);
          if (parsed.routines) setRoutines(parsed.routines);
          if (parsed.goals) setGoals(parsed.goals);
          if (parsed.habits) setHabits(parsed.habits);
          if (parsed.inbox) setInbox(parsed.inbox);
          if (parsed.transactions) setTransactions(parsed.transactions);
          if (parsed.bills) setBills(parsed.bills);
          if (parsed.savingsPots) setSavingsPots(parsed.savingsPots);
          if (parsed.debts) setDebts(parsed.debts);
          if (parsed.recipes) setRecipes(parsed.recipes);
          if (parsed.plannedMeals) setPlannedMeals(parsed.plannedMeals);
          if (parsed.groceries) setGroceries(parsed.groceries);
          if (parsed.workouts) setWorkouts(parsed.workouts);
          if (parsed.weightProfiles) setWeightProfiles(parsed.weightProfiles);
          if (parsed.weightRecords) setWeightRecords(parsed.weightRecords);
          if (parsed.hydrationEntries) setHydrationEntries(parsed.hydrationEntries);
          if (parsed.hydrationTargets) setHydrationTargets(parsed.hydrationTargets);
          if (parsed.calendarEvents) setCalendarEvents(parsed.calendarEvents);
          if (parsed.settings) {
            let loadedSettings = { ...parsed.settings };
            try {
              const rawStg = localStorage.getItem(STORAGE_KEY_SETTINGS);
              if (rawStg) {
                const parsedStg = JSON.parse(rawStg);
                loadedSettings = { ...loadedSettings, ...parsedStg };
              }
            } catch (e) {
              console.warn('Could not parse settings from storage:', e);
            }
            if (loadedSettings.currency) {
              loadedSettings.currencySymbol = getCurrencySymbol(loadedSettings.currency);
            }
            setSettings(loadedSettings);
            settingsRef.current = loadedSettings;
          }
        }
      }
    } catch (err) {
      console.warn('Could not read saved data from localStorage:', err);
    }
  }, []);

  // Sync to localStorage and manage saving states
  const triggerSave = (newSettings?: UserSettings) => {
    setSavingState('saving');
    try {
      const stg = newSettings || settingsRef.current;
      const backup: PlannerBackupData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        settings: stg,
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
      };
      localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(backup));
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(stg));

      setTimeout(() => {
        if (stg.edition === 'downloaded') {
          setSavingState('saved_local');
        } else {
          setSavingState('saved_online');
        }
      }, 250);
    } catch (e) {
      console.error(e);
      setSavingState('could_not_save');
    }
  };

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
  ]);

  // Update settings
  const updateSettings = (newSettings: Partial<UserSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...newSettings };
      if (newSettings.currency) {
        next.currencySymbol = getCurrencySymbol(newSettings.currency);
      }
      if (newSettings.theme) {
        applyThemeToDocument(newSettings.theme);
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

  // Resolve conflict
  const resolveConflict = (chosenVersion: 'local' | 'online') => {
    if (!conflictItem) return;
    if (chosenVersion === 'online') {
      // Apply online version
      if (conflictItem.entityType === 'task') {
        setTasks((prev) =>
          prev.map((t) => (t.id === conflictItem.id ? conflictItem.onlineVersion : t))
        );
      }
    }
    setConflictItem(null);
    setSavingState(settings.edition === 'downloaded' ? 'saved_local' : 'saved_online');
  };

  // Cash flow calculation (Section 6 fixture compliant)
  const cashFlow = useMemo(() => {
    const openingBalance = settings.budgetOpeningBalance ?? 100.0;
    const actualIncome = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    // Regular expenses (excluding transfers)
    const actualExpenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    // Spending-funded transfers to savings
    const spendingToSavingsTransfers = transactions
      .filter((t) => t.type === 'transfer' && t.linkedPotId)
      .reduce((sum, t) => sum + t.amount, 0);

    // Unpaid planned bills for the period
    const unpaidBills = bills
      .filter((b) => !b.isPaid)
      .reduce((sum, b) => sum + b.plannedAmount, 0);

    // Planned savings totals
    const totalPlannedSavings = settings.budgetPlannedSavings ?? 250.0;
    const plannedSavingsStillDue = Math.max(0, totalPlannedSavings - spendingToSavingsTransfers);
    const plannedIncome = settings.budgetPlannedIncome ?? 1200.0;

    // Category limits total (e.g. Food 250 + Transport 100 + Home 200 + Personal 150 = 700)
    const categoryLimitsMap = settings.budgetCategoryLimits ?? {
      Food: 250,
      Transport: 100,
      Home: 200,
      Personal: 150,
    };
    const categoryLimitsTotal = Object.values(categoryLimitsMap).reduce((sum, lim) => sum + lim, 0);

    return calculateCashFlow({
      openingBalance,
      actualIncome,
      actualExpenses,
      spendingToSavingsTransfers,
      unpaidBills,
      plannedSavingsStillDue,
      plannedIncome,
      categoryLimitsTotal,
      totalPlannedSavings,
    });
  }, [transactions, bills, settings]);

  // Task Actions
  const addTask = (task: Omit<TaskItem, 'id' | 'createdAt'>) => {
    const newTask: TaskItem = {
      ...task,
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [newTask, ...prev]);
  };

  const updateTask = (id: string, updates: Partial<TaskItem>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const toggleTaskCompletion = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const willBeCompleted = t.status !== 'completed';
        return {
          ...t,
          status: willBeCompleted ? 'completed' : 'not_started',
          completedAt: willBeCompleted ? new Date().toISOString() : undefined,
        };
      })
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

  const toggleRoutinePause = (id: string) => {
    setRoutines((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const willBePaused = !r.isPaused;
        return {
          ...r,
          isPaused: willBePaused,
          pausedDate: willBePaused ? new Date().toISOString().split('T')[0] : undefined,
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
  const addInboxItem = (text: string) => {
    const item: BrainDumpItem = {
      id: `inbox-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    setInbox((prev) => [item, ...prev]);
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
  const addTransaction = (tx: Omit<FinancialTransaction, 'id'>) => {
    const newTx: FinancialTransaction = {
      ...tx,
      id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };
    setTransactions((prev) => [newTx, ...prev]);
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
        prev.map((b) =>
          b.id === tx.linkedBillId
            ? {
                ...b,
                isPaid: false,
                actualPaidAmount: undefined,
                paidDate: undefined,
                linkedExpenseId: undefined,
              }
            : b
        )
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
    if (bill?.linkedExpenseId) {
      setTransactions((prev) => prev.filter((tx) => tx.id !== bill.linkedExpenseId));
    }
    setBills((prev) => prev.filter((b) => b.id !== id));
  };

  const markBillPaid = (
    billId: string,
    actualAmount: number,
    paymentDate: string
  ) => {
    const bill = bills.find((b) => b.id === billId);
    if (!bill) return;

    // Check if already paid to prevent double-charging
    if (bill.isPaid && bill.linkedExpenseId) {
      // Just update existing expense
      setTransactions((prev) =>
        prev.map((tx) =>
          tx.id === bill.linkedExpenseId
            ? { ...tx, amount: actualAmount, date: paymentDate }
            : tx
        )
      );
      setBills((prev) =>
        prev.map((b) =>
          b.id === billId
            ? { ...b, actualPaidAmount: actualAmount, paidDate: paymentDate }
            : b
        )
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
      prev.map((b) =>
        b.id === billId
          ? {
              ...b,
              isPaid: true,
              actualPaidAmount: actualAmount,
              paidDate: paymentDate,
              linkedExpenseId: linkedTxId,
            }
          : b
      )
    );
  };

  const unpayBill = (billId: string) => {
    const bill = bills.find((b) => b.id === billId);
    if (!bill) return;

    if (bill.linkedExpenseId) {
      setTransactions((prev) =>
        prev.filter((tx) => tx.id !== bill.linkedExpenseId)
      );
    }

    setBills((prev) =>
      prev.map((b) =>
        b.id === billId
          ? {
              ...b,
              isPaid: false,
              actualPaidAmount: undefined,
              paidDate: undefined,
              linkedExpenseId: undefined,
            }
          : b
      )
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
    // 1. Gather all planned meals for this week
    const start = new Date(weekStartDateStr);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const weekMeals = plannedMeals.filter((m) => {
      const d = new Date(m.date);
      return d >= start && d < end;
    });

    // 2. Aggregate ingredients with NIST conversion & scaling
    interface AggregatedIng {
      name: string;
      totalNormalized: number;
      primaryUnit: string;
      category: 'Produce' | 'Pantry' | 'Chilled' | 'Household' | 'Bakery' | 'Other';
      mealCount: number;
    }

    const aggregated: Record<string, AggregatedIng> = {};

    for (const meal of weekMeals) {
      const ratio = meal.baseServings > 0 ? meal.plannedServings / meal.baseServings : 1;
      for (const ing of meal.ingredientsSnapshot) {
        const key = ing.name.toLowerCase().trim();
        const scaledAmt = ing.amount * ratio;

        // Determine category hint
        let cat: 'Produce' | 'Pantry' | 'Chilled' | 'Household' | 'Bakery' | 'Other' = 'Pantry';
        const n = key;
        if (n.includes('pepper') || n.includes('spinach') || n.includes('lemon') || n.includes('broccoli') || n.includes('onion') || n.includes('garlic')) {
          cat = 'Produce';
        } else if (n.includes('milk') || n.includes('yogurt') || n.includes('cheese') || n.includes('butter') || n.includes('egg') || n.includes('chicken') || n.includes('salmon')) {
          cat = 'Chilled';
        }

        // Standardize mass (g/kg) and volume (ml/L)
        let normalizedAmt = scaledAmt;
        let baseUnit = ing.unit;

        if (ing.unit === 'g') {
          // Keep in grams
        } else if (ing.unit === 'kg') {
          normalizedAmt = scaledAmt * 1000;
          baseUnit = 'g';
        } else if (ing.unit === 'ml') {
          // Keep in ml
        } else if (ing.unit === 'L') {
          normalizedAmt = scaledAmt * 1000;
          baseUnit = 'ml';
        }

        if (!aggregated[key]) {
          aggregated[key] = {
            name: ing.name,
            totalNormalized: normalizedAmt,
            primaryUnit: baseUnit,
            category: cat,
            mealCount: 1,
          };
        } else {
          aggregated[key].totalNormalized += normalizedAmt;
          aggregated[key].mealCount += 1;
        }
      }
    }

    // 3. Keep manual extras intact
    const manualExtras = groceries.filter((g) => g.sourceType === 'manual');

    // 4. Create new list of generated grocery rows
    const newGenerated: GroceryItem[] = Object.values(aggregated).map((agg) => {
      let finalAmt = agg.totalNormalized;
      let finalUnit = agg.primaryUnit;

      if (agg.primaryUnit === 'g' && agg.totalNormalized >= 1000) {
        finalAmt = Math.round((agg.totalNormalized / 1000) * 10) / 10;
        finalUnit = 'kg';
      } else if (agg.primaryUnit === 'ml' && agg.totalNormalized >= 1000) {
        finalAmt = Math.round((agg.totalNormalized / 1000) * 10) / 10;
        finalUnit = 'L';
      }

      // Check if item was previously purchased with identical amount
      const existing = groceries.find(
        (g) =>
          g.sourceType === 'generated' &&
          g.name.toLowerCase() === agg.name.toLowerCase() &&
          g.unit === finalUnit &&
          g.amount === finalAmt
      );

      return {
        id: existing ? existing.id : `gro-gen-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: agg.name,
        amount: finalAmt,
        unit: finalUnit,
        category: agg.category,
        isPurchased: existing ? existing.isPurchased : false,
        sourceType: 'generated',
        sourceMealCount: agg.mealCount,
      };
    });

    setGroceries([...newGenerated, ...manualExtras]);
  };

  const addGroceryItem = (item: Omit<GroceryItem, 'id' | 'sourceType'>) => {
    const newItem: GroceryItem = {
      ...item,
      id: `gro-man-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      sourceType: 'manual',
    };
    setGroceries((prev) => [...prev, newItem]);
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

  const addWeightRecord = (record: Omit<WeightRecord, 'id'>) => {
    const newRecord: WeightRecord = {
      ...record,
      id: `wr-${Date.now()}`,
    };
    setWeightRecords((prev) => [newRecord, ...prev]);
  };

  const deleteWeightRecord = (id: string) => {
    setWeightRecords((prev) => prev.filter((r) => r.id !== id));
  };

  // Hydration Actions
  const addWaterLog = (amountMl: number, timeStr: string) => {
    const newEntry: HydrationLogEntry = {
      id: `hl-${Date.now()}`,
      date: currentDate,
      time: timeStr,
      amountMl,
    };
    setHydrationEntries((prev) => [newEntry, ...prev]);
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
    setCalendarEvents((prev) => [...prev, newEv]);
  };

  const deleteCalendarEvent = (id: string) => {
    setCalendarEvents((prev) => prev.filter((e) => e.id !== id));
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
    updateSettings({ isSampleDataActive: false });
  };

  const resetAllData = () => {
    setTasks([]);
    setRoutines([]);
    setGoals([]);
    setHabits([]);
    setInbox([]);
    setTransactions([]);
    setBills([]);
    setSavingsPots([]);
    setDebts([]);
    setRecipes([]);
    setPlannedMeals([]);
    setGroceries([]);
    setWorkouts([]);
    setWeightRecords([]);
    setHydrationEntries([]);
    setCalendarEvents([]);
    updateSettings({ isSampleDataActive: false });
  };

  const loadSampleData = () => {
    setTasks(SAMPLE_TASKS);
    setRoutines(SAMPLE_ROUTINES);
    setGoals(SAMPLE_GOALS);
    setHabits(SAMPLE_HABITS);
    setInbox(SAMPLE_BRAIN_DUMP);
    setTransactions(SAMPLE_TRANSACTIONS);
    setBills(SAMPLE_BILLS);
    setSavingsPots(SAMPLE_SAVINGS_POTS);
    setDebts(SAMPLE_DEBTS);
    setRecipes(SAMPLE_RECIPES);
    setPlannedMeals(SAMPLE_PLANNED_MEALS);
    setGroceries(SAMPLE_GROCERIES);
    setWorkouts(SAMPLE_WORKOUTS);
    setWeightProfiles(SAMPLE_WEIGHT_PROFILES);
    setWeightRecords(SAMPLE_WEIGHT_RECORDS);
    setHydrationEntries(SAMPLE_HYDRATION_LOG);
    setHydrationTargets(SAMPLE_HYDRATION_TARGETS);
    setCalendarEvents(SAMPLE_CALENDAR_EVENTS);
    updateSettings({ isSampleDataActive: true });
  };

  const exportBackup = (): PlannerBackupData => {
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      settings,
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
    };
  };

  const restoreBackup = (backup: PlannerBackupData): boolean => {
    if (!backup || backup.version !== '1.0.0') {
      return false;
    }
    try {
      if (backup.tasks) setTasks(backup.tasks);
      if (backup.routines) setRoutines(backup.routines);
      if (backup.goals) setGoals(backup.goals);
      if (backup.habits) setHabits(backup.habits);
      if (backup.inbox) setInbox(backup.inbox);
      if (backup.transactions) setTransactions(backup.transactions);
      if (backup.bills) setBills(backup.bills);
      if (backup.savingsPots) setSavingsPots(backup.savingsPots);
      if (backup.debts) setDebts(backup.debts);
      if (backup.recipes) setRecipes(backup.recipes);
      if (backup.plannedMeals) setPlannedMeals(backup.plannedMeals);
      if (backup.groceries) setGroceries(backup.groceries);
      if (backup.workouts) setWorkouts(backup.workouts);
      if (backup.weightProfiles) setWeightProfiles(backup.weightProfiles);
      if (backup.weightRecords) setWeightRecords(backup.weightRecords);
      if (backup.hydrationEntries) setHydrationEntries(backup.hydrationEntries);
      if (backup.hydrationTargets) setHydrationTargets(backup.hydrationTargets);
      if (backup.calendarEvents) setCalendarEvents(backup.calendarEvents);
      if (backup.settings) setSettings(backup.settings);
      triggerSave(backup.settings);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const generateStandaloneHtml = (): string => {
    const backup = exportBackup();
    const dataJson = JSON.stringify(backup).replace(/</g, '\\u003c');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Our Life Planner - Standalone Edition</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #F3F8FC; color: #071A3A; padding: 2rem; max-width: 800px; margin: auto; }
    .card { background: white; border-radius: 16px; padding: 2rem; box-shadow: 0 4px 12px rgba(7,26,58,0.06); }
    h1 { color: #087F83; margin-top: 0; }
    .btn { background: #087F83; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 600; cursor: pointer; }
    pre { background: #F8FAFC; border: 1px solid #E2E8F0; padding: 1rem; border-radius: 8px; overflow: auto; max-height: 300px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Our Life Planner - Downloaded Offline Edition</h1>
    <p>This is your independent offline planner bundle. Your records are preserved below and will continue to persist in this browser's local storage.</p>
    <p><strong>Export Date:</strong> ${backup.exportedAt}</p>
    <p><strong>Total Records:</strong> ${backup.tasks.length} tasks, ${backup.routines.length} routines, ${backup.bills.length} bills, ${backup.recipes.length} recipes.</p>
    <button class="btn" onclick="downloadJson()">Export JSON Backup</button>
    <h3>Embedded Planner Payload</h3>
    <pre id="data-preview"></pre>
  </div>
  <script>
    const plannerData = ${dataJson};
    document.getElementById('data-preview').textContent = JSON.stringify(plannerData, null, 2);
    function downloadJson() {
      const blob = new Blob([JSON.stringify(plannerData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'our-life-planner-backup.json';
      a.click();
    }
  </script>
</body>
</html>`;
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
        conflictItem,
        setConflictItem,
        resolveConflict,
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
        cashFlow,
        addTask,
        updateTask,
        deleteTask,
        toggleTaskCompletion,
        addRoutine,
        updateRoutine,
        updateRoutineWithScope,
        deleteRoutine,
        toggleRoutineCompletion,
        skipRoutineOccurrence,
        unskipRoutineOccurrence,
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
        deleteCalendarEvent,
        removeSampleData,
        resetAllData,
        loadSampleData,
        exportBackup,
        restoreBackup,
        generateStandaloneHtml,
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
