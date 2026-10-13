export type CanonicalModuleId =
  | 'today'
  | 'calendar'
  | 'tasks'
  | 'routines'
  | 'inbox'
  | 'goals'
  | 'habits'
  | 'money'
  | 'food'
  | 'body';

export type ToolViewId =
  | 'today'
  | 'calendar'
  | 'tasks'
  | 'routines'
  | 'inbox'
  | 'goals'
  | 'habits'
  | 'budget'
  | 'savings'
  | 'debts'
  | 'meals'
  | 'groceries'
  | 'workouts'
  | 'weight'
  | 'water';

export interface PlannerModuleDefinition {
  id: CanonicalModuleId;
  name: string;
  desc: string;
  category: 'core' | 'growth' | 'life';
  toolIds: ToolViewId[];
  primaryToolId: ToolViewId;
}

export interface PlannerToolDefinition {
  id: ToolViewId;
  moduleId: CanonicalModuleId;
  label: string;
  desc: string;
  sidebarGroup: 'plan' | 'growth' | 'money' | 'food' | 'body';
  mobileCategory: 'Plan & organize' | 'Growth & goals' | 'Money' | 'Health & lifestyle';
}

/**
 * Single source of truth for customizable planner modules across Setup, Settings,
 * Sidebar, Pinned Favorites, and Mobile Navigation.
 */
export const MODULE_REGISTRY: PlannerModuleDefinition[] = [
  {
    id: 'today',
    name: 'Today & Next Up',
    desc: 'Unified daily schedule & capture',
    category: 'core',
    toolIds: ['today'],
    primaryToolId: 'today',
  },
  {
    id: 'tasks',
    name: 'Tasks & Projects',
    desc: 'Prioritized actions & all-day backlog',
    category: 'core',
    toolIds: ['tasks'],
    primaryToolId: 'tasks',
  },
  {
    id: 'calendar',
    name: 'Calendar Schedule',
    desc: 'Visual month & week time-blocks',
    category: 'core',
    toolIds: ['calendar'],
    primaryToolId: 'calendar',
  },
  {
    id: 'routines',
    name: 'Recurring Routines',
    desc: 'Daily, weekly & forgiving rituals',
    category: 'core',
    toolIds: ['routines'],
    primaryToolId: 'routines',
  },
  {
    id: 'habits',
    name: 'Habit Consistency',
    desc: 'Daily rhythm & streak tracker',
    category: 'growth',
    toolIds: ['habits'],
    primaryToolId: 'habits',
  },
  {
    id: 'goals',
    name: 'Milestone Goals',
    desc: 'Long-term goals with step breakdowns',
    category: 'growth',
    toolIds: ['goals'],
    primaryToolId: 'goals',
  },
  {
    id: 'inbox',
    name: 'Brain Dump Inbox',
    desc: 'Quick capture before triaging',
    category: 'growth',
    toolIds: ['inbox'],
    primaryToolId: 'inbox',
  },
  {
    id: 'money',
    name: 'Money & Budgets',
    desc: 'Cash flow, bills, savings pots & debts',
    category: 'life',
    toolIds: ['budget', 'savings', 'debts'],
    primaryToolId: 'budget',
  },
  {
    id: 'food',
    name: 'Meals & Groceries',
    desc: 'Weekly menu planning & smart list',
    category: 'life',
    toolIds: ['meals', 'groceries'],
    primaryToolId: 'meals',
  },
  {
    id: 'body',
    name: 'Health & Hydration',
    desc: 'Workouts, weight metrics & water log',
    category: 'life',
    toolIds: ['workouts', 'weight', 'water'],
    primaryToolId: 'workouts',
  },
];

export const DEFAULT_ENABLED_MODULES: CanonicalModuleId[] = MODULE_REGISTRY.map((m) => m.id);

/**
 * Focused starter set of core planning modules for first-time setup (LP-20).
 */
export const STARTER_ENABLED_MODULES: CanonicalModuleId[] = [
  'today',
  'tasks',
  'calendar',
  'routines',
  'inbox',
];

export const DEFAULT_PINNED_MODULES: CanonicalModuleId[] = [];

/**
 * Single source of truth for all 15 individual tool views and their parent module.
 */
export const TOOL_REGISTRY: PlannerToolDefinition[] = [
  {
    id: 'today',
    moduleId: 'today',
    label: 'Today',
    desc: 'Daily overview',
    sidebarGroup: 'plan',
    mobileCategory: 'Plan & organize',
  },
  {
    id: 'calendar',
    moduleId: 'calendar',
    label: 'Calendar',
    desc: 'Plan your time',
    sidebarGroup: 'plan',
    mobileCategory: 'Plan & organize',
  },
  {
    id: 'tasks',
    moduleId: 'tasks',
    label: 'Tasks',
    desc: 'Get things done',
    sidebarGroup: 'plan',
    mobileCategory: 'Plan & organize',
  },
  {
    id: 'routines',
    moduleId: 'routines',
    label: 'Routines',
    desc: 'Build daily rhythms',
    sidebarGroup: 'plan',
    mobileCategory: 'Plan & organize',
  },
  {
    id: 'inbox',
    moduleId: 'inbox',
    label: 'Inbox',
    desc: 'Capture anything',
    sidebarGroup: 'plan',
    mobileCategory: 'Plan & organize',
  },
  {
    id: 'goals',
    moduleId: 'goals',
    label: 'Goals',
    desc: 'Set and track milestones',
    sidebarGroup: 'growth',
    mobileCategory: 'Growth & goals',
  },
  {
    id: 'habits',
    moduleId: 'habits',
    label: 'Habits',
    desc: 'Build consistency',
    sidebarGroup: 'growth',
    mobileCategory: 'Growth & goals',
  },
  {
    id: 'budget',
    moduleId: 'money',
    label: 'Budget & bills',
    desc: 'Track cash flow',
    sidebarGroup: 'money',
    mobileCategory: 'Money',
  },
  {
    id: 'savings',
    moduleId: 'money',
    label: 'Savings',
    desc: 'Grow your money',
    sidebarGroup: 'money',
    mobileCategory: 'Money',
  },
  {
    id: 'debts',
    moduleId: 'money',
    label: 'Debt payoff',
    desc: 'Become debt-free',
    sidebarGroup: 'money',
    mobileCategory: 'Money',
  },
  {
    id: 'meals',
    moduleId: 'food',
    label: 'Meals',
    desc: 'Plan your recipes',
    sidebarGroup: 'food',
    mobileCategory: 'Health & lifestyle',
  },
  {
    id: 'groceries',
    moduleId: 'food',
    label: 'Groceries',
    desc: 'Shopping lists',
    sidebarGroup: 'food',
    mobileCategory: 'Health & lifestyle',
  },
  {
    id: 'workouts',
    moduleId: 'body',
    label: 'Workouts',
    desc: 'Stay active',
    sidebarGroup: 'body',
    mobileCategory: 'Health & lifestyle',
  },
  {
    id: 'weight',
    moduleId: 'body',
    label: 'Weight',
    desc: 'Track your weight & BMI',
    sidebarGroup: 'body',
    mobileCategory: 'Health & lifestyle',
  },
  {
    id: 'water',
    moduleId: 'body',
    label: 'Water',
    desc: 'Stay hydrated',
    sidebarGroup: 'body',
    mobileCategory: 'Health & lifestyle',
  },
];

const LEGACY_OR_TOOL_TO_MODULE_MAP: Record<string, CanonicalModuleId> = {
  today: 'today',
  calendar: 'calendar',
  tasks: 'tasks',
  routines: 'routines',
  inbox: 'inbox',
  goals: 'goals',
  habits: 'habits',
  money: 'money',
  budget: 'money',
  savings: 'money',
  debts: 'money',
  food: 'food',
  meals: 'food',
  groceries: 'food',
  body: 'body',
  health: 'body',
  workouts: 'body',
  weight: 'body',
  water: 'body',
};

const MODULE_BY_ID: Record<CanonicalModuleId, PlannerModuleDefinition> = MODULE_REGISTRY.reduce(
  (acc, mod) => {
    acc[mod.id] = mod;
    return acc;
  },
  {} as Record<CanonicalModuleId, PlannerModuleDefinition>
);

/**
 * Maps any module or individual tool identifier (e.g., 'budget', 'meals', 'workouts', 'money', 'food', 'body')
 * to its canonical module identifier. Returns null if unrecognized (e.g. 'settings').
 */
export function resolveModuleId(id: string | undefined | null): CanonicalModuleId | null {
  if (!id || typeof id !== 'string') return null;
  const normalized = id.trim().toLowerCase();
  return LEGACY_OR_TOOL_TO_MODULE_MAP[normalized] || null;
}

/**
 * Migrates and normalizes any saved `enabledTools` array (which may contain legacy
 * tool-level IDs like 'budget', 'meals', 'workouts' or group-level IDs like 'money', 'food', 'body')
 * into a deduplicated array of canonical module IDs in registry order.
 */
export function migrateEnabledTools(rawEnabledTools?: string[] | null): CanonicalModuleId[] {
  if (!Array.isArray(rawEnabledTools)) {
    return [...DEFAULT_ENABLED_MODULES];
  }

  const enabledSet = new Set<CanonicalModuleId>();
  for (const item of rawEnabledTools) {
    const resolved = resolveModuleId(item);
    if (resolved) {
      enabledSet.add(resolved);
    }
  }

  return MODULE_REGISTRY.map((m) => m.id).filter((id) => enabledSet.has(id));
}

/**
 * Migrates and normalizes any saved `pinnedTools` array into deduplicated canonical module IDs.
 */
export function migratePinnedTools(rawPinnedTools?: string[] | null): CanonicalModuleId[] {
  if (!Array.isArray(rawPinnedTools)) {
    return [...DEFAULT_PINNED_MODULES];
  }

  const pinnedSet = new Set<CanonicalModuleId>();
  for (const item of rawPinnedTools) {
    const resolved = resolveModuleId(item);
    if (resolved) {
      pinnedSet.add(resolved);
    }
  }

  return MODULE_REGISTRY.map((m) => m.id).filter((id) => pinnedSet.has(id));
}

/**
 * Single visibility rule used across Setup, Settings, Sidebar, Favorites, and Mobile navigation.
 * Returns true if the given module or tool view is enabled.
 */
export function isModuleOrToolEnabled(
  id: string,
  rawEnabledTools?: string[] | null
): boolean {
  if (id === 'settings') return true;
  const moduleId = resolveModuleId(id);
  if (!moduleId) return true;
  if (!Array.isArray(rawEnabledTools)) return true;

  const migrated = migrateEnabledTools(rawEnabledTools);
  return migrated.includes(moduleId);
}

/**
 * Checks if a module is pinned in `pinnedTools` (regardless of whether it's currently enabled).
 */
export function isModulePinnedRaw(
  id: string,
  rawPinnedTools?: string[] | null
): boolean {
  const moduleId = resolveModuleId(id);
  if (!moduleId || !Array.isArray(rawPinnedTools)) return false;
  const migrated = migratePinnedTools(rawPinnedTools);
  return migrated.includes(moduleId);
}

/**
 * Returns true if a tool item should appear in the Sidebar / Mobile Favorites section.
 * Enforces the module visibility filter so hidden modules NEVER leak through Favorites.
 */
export function isToolVisibleInFavorites(
  toolId: ToolViewId,
  rawPinnedTools?: string[] | null,
  rawEnabledTools?: string[] | null
): boolean {
  if (!isModuleOrToolEnabled(toolId, rawEnabledTools)) {
    return false;
  }
  if (!Array.isArray(rawPinnedTools) || rawPinnedTools.length === 0) {
    return false;
  }

  // If the specific tool ID was explicitly pinned, show it
  if (rawPinnedTools.includes(toolId)) {
    return true;
  }

  // If the parent module ID was pinned, show its tools (or primary tool)
  const moduleId = resolveModuleId(toolId);
  if (!moduleId) return false;
  return rawPinnedTools.includes(moduleId);
}

/**
 * Toggles a module's enabled state on a canonicalized `enabledTools` list.
 * Removes both the module ID and any legacy child tool IDs when disabling.
 */
export function toggleModuleEnabledInList(
  rawEnabledTools: string[] | undefined | null,
  targetModuleOrToolId: string
): CanonicalModuleId[] {
  const current = migrateEnabledTools(rawEnabledTools);
  const targetModuleId = resolveModuleId(targetModuleOrToolId);
  if (!targetModuleId) return current;

  if (current.includes(targetModuleId)) {
    return current.filter((id) => id !== targetModuleId);
  }
  const nextSet = new Set<CanonicalModuleId>([...current, targetModuleId]);
  return MODULE_REGISTRY.map((m) => m.id).filter((id) => nextSet.has(id));
}

/**
 * Toggles a module's pinned state on a canonicalized `pinnedTools` list.
 */
export function toggleModulePinnedInList(
  rawPinnedTools: string[] | undefined | null,
  targetModuleOrToolId: string
): CanonicalModuleId[] {
  const current = migratePinnedTools(rawPinnedTools);
  const targetModuleId = resolveModuleId(targetModuleOrToolId);
  if (!targetModuleId) return current;

  if (current.includes(targetModuleId)) {
    return current.filter((id) => id !== targetModuleId);
  }
  const nextSet = new Set<CanonicalModuleId>([...current, targetModuleId]);
  return MODULE_REGISTRY.map((m) => m.id).filter((id) => nextSet.has(id));
}

/**
 * Returns the first enabled tool view ID (defaults to 'today' or 'settings' if all modules are hidden).
 */
export function getFallbackEnabledToolView(rawEnabledTools?: string[] | null): string {
  const visibleTool = TOOL_REGISTRY.find((t) => isModuleOrToolEnabled(t.id, rawEnabledTools));
  return visibleTool ? visibleTool.id : 'settings';
}

export function getModuleDefinition(id: CanonicalModuleId): PlannerModuleDefinition {
  return MODULE_BY_ID[id];
}
