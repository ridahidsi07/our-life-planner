export type EditionType = 'downloaded' | 'online';

export type SavingState = 
  | 'saving'
  | 'saved_local'
  | 'saved_online'
  | 'saved_cloud'
  | 'waiting_to_sync'
  | 'needs_choice'
  | 'could_not_save';

export type RepeatInterval = 'none' | 'monthly' | 'weekly' | 'yearly';

export type Priority = 'urgent' | 'high' | 'medium' | 'low' | 'lowest';
export type TaskStatus = 'not_started' | 'in_progress' | 'on_hold' | 'completed';
export type RoutineInterval = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
export type DebtStrategy = 'snowball' | 'avalanche' | 'custom';

export type BudgetPeriodType = 'monthly' | 'weekly' | 'paycheck' | 'custom';

export interface BudgetPeriodAllocation {
  plannedIncome?: number;
  plannedSavings?: number;
  categoryLimits?: Record<string, number>;
}

export interface HouseholdMember {
  id: string;
  name: string;
  color: string;
}

export type AccentColor = 'teal' | 'ocean' | 'plum' | 'ember' | 'apple';

export interface UserSettings {
  ownerName: string;
  email: string;
  edition: EditionType;
  weekStartsOn: 'Monday' | 'Sunday';
  timeZone: string;
  currency: string;
  currencySymbol: string;
  weightUnit: 'kg' | 'lb';
  heightUnit: 'cm' | 'in';
  waterUnit: 'ml' | 'oz';
  theme: 'light' | 'dark' | 'system';
  accentColor?: AccentColor;
  isSampleDataActive: boolean;
  hasCompletedSetup: boolean;
  budgetOpeningBalance?: number;
  budgetCategoryLimits?: Record<string, number>;
  budgetPlannedIncome?: number;
  budgetPlannedSavings?: number;
  budgetPeriodType?: BudgetPeriodType;
  budgetStartDate?: string;
  budgetEndDate?: string;
  budgetPeriodAllocations?: Partial<Record<BudgetPeriodType, BudgetPeriodAllocation>>;
  lastBackupDate?: string;
  lastSyncDate?: string;
  enabledTools?: string[];
  pinnedTools?: string[];
  todayVisibleSections?: {
    finance?: boolean;
    health?: boolean;
    meals?: boolean;
    habits?: boolean;
  };
  householdMembers?: HouseholdMember[];
  locale?: string;
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  category: string;
  assignedTo: string;
  assignedMemberId?: string;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  scheduledStart?: string; // HH:mm
  scheduledEnd?: string; // HH:mm
  isAllDay?: boolean;
  isArchived?: boolean;
  priority: Priority;
  status: TaskStatus;
  createdAt: string;
  completedAt?: string;
  isSample?: boolean;
}

export interface RoutineItem {
  id: string;
  title: string;
  category: string;
  assignedTo: string;
  assignedMemberId?: string;
  priority: Priority;
  interval: RoutineInterval;
  customEveryCount?: number; // e.g. every 2 weeks
  customUnit?: 'days' | 'weeks' | 'months' | 'years';
  weekdays?: number[]; // 0=Sun, 1=Mon...
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  notes?: string;
  isPaused: boolean;
  pausedDate?: string;
  completedDates: string[]; // ['2026-10-05', ...]
  skippedDates: string[];
  forgivenDates?: string[];
  exceptions?: Record<string, Partial<RoutineItem>>;
  isSample?: boolean;
}

export interface GoalStep {
  id: string;
  title: string;
  isCompleted: boolean;
}

export interface GoalItem {
  id: string;
  title: string;
  category: 'Health' | 'Finances' | 'Career' | 'Personal growth' | 'Relationships';
  motivation?: string;
  reward?: string;
  deadline?: string; // YYYY-MM-DD
  status: TaskStatus;
  steps: GoalStep[];
  createdAt: string;
  isSample?: boolean;
}

export interface HabitItem {
  id: string;
  title: string;
  frequencyType: 'daily' | 'weekly';
  weeklyTargetDays?: number; // 1-7
  effectiveDate: string; // YYYY-MM-DD
  personalNote?: string;
  checkedDates: string[]; // YYYY-MM-DD
  isSample?: boolean;
}

export interface BrainDumpItem {
  id: string;
  text: string;
  createdAt: string;
  isSample?: boolean;
}

export interface FinancialTransaction {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  category: string;
  date: string; // YYYY-MM-DD
  note?: string;
  linkedBillId?: string;
  linkedPotId?: string;
  isSample?: boolean;
}

export interface BillPaidRecord {
  actualPaidAmount: number;
  paidDate: string;
  linkedExpenseId?: string;
}

export interface BillItem {
  id: string;
  title: string;
  category: string;
  plannedAmount: number;
  dueDate: string; // YYYY-MM-DD
  repeatInterval?: 'none' | 'monthly' | 'weekly' | 'yearly';
  isPaid: boolean;
  actualPaidAmount?: number;
  paidDate?: string;
  linkedExpenseId?: string;
  paidOccurrences?: Record<string, BillPaidRecord>;
  isSample?: boolean;
}

export interface BillOccurrence {
  id: string;
  billId: string;
  title: string;
  category: string;
  plannedAmount: number;
  dueDate: string; // YYYY-MM-DD
  repeatInterval?: 'none' | 'monthly' | 'weekly' | 'yearly';
  isPaid: boolean;
  actualPaidAmount?: number;
  paidDate?: string;
  linkedExpenseId?: string;
  isOverdue: boolean;
  status: 'paid' | 'unpaid' | 'overdue';
}

export interface SavingsDeposit {
  id: string;
  amount: number;
  date: string; // YYYY-MM-DD
  source: 'spending_balance' | 'outside';
  linkedTransferId?: string;
}

export interface SavingsPot {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: string; // YYYY-MM-DD
  openingBalance: number;
  openingDate: string;
  deposits: SavingsDeposit[];
  isSample?: boolean;
}

export interface DebtItem {
  id: string;
  name: string;
  originalBalance: number;
  currentBalance: number;
  annualInterestRate: number; // e.g. 12 for 12%
  minimumMonthlyPayment: number;
  chosenMonthlyPayment?: number;
  customOrderIndex?: number;
  isSample?: boolean;
}

export interface RecipeIngredient {
  name: string;
  amount: number;
  unit: string; // g, kg, ml, L, pcs, count, cups, bottle, etc.
}

export interface RecipeItem {
  id: string;
  title: string;
  category: 'Vegetarian' | 'Main dish' | 'Quick' | 'Baking' | 'Salad';
  baseServings: number;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  ingredients: RecipeIngredient[];
  instructions?: string;
  isSample?: boolean;
}

export interface PlannedMeal {
  id: string;
  date: string; // YYYY-MM-DD
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  plannedTime?: string;
  recipeId?: string;
  recipeTitle: string;
  plannedServings: number;
  baseServings: number;
  ingredientsSnapshot: RecipeIngredient[];
  isConsumed: boolean;
  isSample?: boolean;
}

export interface GroceryItem {
  id: string;
  name: string;
  amount: number;
  unit: string;
  category: 'Produce' | 'Pantry' | 'Chilled' | 'Household' | 'Bakery' | 'Other';
  isPurchased: boolean;
  sourceType: 'generated' | 'manual';
  sourceMealCount?: number;
  sourceMealTitles?: string[];
  isSample?: boolean;
}

export interface WorkoutExerciseSet {
  setNumber: number;
  weightKg?: number; // normalized
  weightOriginal?: number;
  weightUnit: 'kg' | 'lb';
  reps: number;
  restSeconds: number;
  isCompleted: boolean;
}

export interface WorkoutExercise {
  id: string;
  name: string;
  muscleGroup: 'Legs' | 'Back' | 'Chest' | 'Arms' | 'Core' | 'Full body' | 'Cardio';
  equipment?: 'Dumbbell' | 'Barbell' | 'Machine' | 'Bodyweight' | 'Cable';
  sets: WorkoutExerciseSet[];
}

export interface WorkoutSession {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string;
  durationMinutes: number;
  muscleGroups: string[];
  exercises: WorkoutExercise[];
  cardioMinutes?: number;
  cardioDistanceKm?: number;
  isCompleted: boolean;
  isRestDay?: boolean;
  notes?: string;
  isSample?: boolean;
}

export interface WeightProfile {
  id: string;
  name: string;
  heightCm?: number;
  avatarColor: string;
}

export interface WeightRecord {
  id: string;
  profileId: string;
  date: string; // YYYY-MM-DD
  time?: string;
  weightKg: number;
  recordedHeightCm?: number;
  notes?: string;
  isSample?: boolean;
}

export interface HydrationLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  amountMl: number;
  isSample?: boolean;
}

export interface DailyHydrationTarget {
  date: string; // effective from this date YYYY-MM-DD
  targetMl: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
  type: 'birthday' | 'event' | 'free_time';
  notes?: string;
  isSample?: boolean;
}

export interface WeeklyReviewEntry {
  id: string;
  weekStartDate: string; // YYYY-MM-DD
  weekEndDate: string; // YYYY-MM-DD
  reflection: string;
  intentions: string[]; // 3 priority strings
  linkedTaskIds?: Record<number, string>;
  completedTasksCount: number;
  completedWorkoutsCount: number;
  habitCheckInsCount: number;
  completedAt?: string;
  updatedAt: string;
  isSample?: boolean;
}

export interface PlannerBackupData {
  version: '1.0.0';
  exportedAt: string;
  revision?: number;
  settings: UserSettings;
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
  weightRecords: WeightRecord[];
  hydrationEntries: HydrationLogEntry[];
  hydrationTargets: DailyHydrationTarget[];
  calendarEvents: CalendarEvent[];
  weeklyReviews?: WeeklyReviewEntry[];
}

export interface ConflictItem {
  id: string;
  entityType: string;
  title: string;
  localVersion: any;
  onlineVersion: any;
  timestamp: string;
  source?: 'tab' | 'cloud' | 'import';
}

export interface CorruptDataQuarantine {
  quarantinedAt: string;
  rawData: string | null;
  rawSettings: string | null;
  rawRevision: string | null;
  reason: string;
  errors: string[];
  validationErrors?: string[];
}

export type CloudSyncStatus =
  | 'local_only'
  | 'disconnected'
  | 'connected_synced'
  | 'syncing'
  | 'sync_error'
  | 'conflict_pending';

export interface CloudEntitlement {
  status: 'active' | 'trial' | 'offline_only' | 'expired';
  plan: 'lifetime_bundle' | 'annual_sync' | 'free_local' | 'online_plus';
  canSync: boolean;
  validUntil?: string;
}

export interface CloudSyncState {
  status: CloudSyncStatus;
  endpointUrl: string;
  accountId?: string;
  email?: string;
  accountUserId?: string;
  accountEmail?: string;
  accountDisplayName?: string;
  serverRevision?: number;
  etag?: string;
  lastSyncedAt?: string;
  lastSyncError?: string | null;
  entitlement?: CloudEntitlement;
}

export interface CreationFeedback {
  id: string;
  type: 'task' | 'expense' | 'workout' | 'weight' | 'water' | 'thought';
  title: string;
  category?: string;
  dueDate?: string;
  status?: string;
  priority?: string;
  createdAt: number;
}

