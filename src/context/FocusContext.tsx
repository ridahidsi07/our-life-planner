import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { usePlanner } from './PlannerContext';
import { TaskItem } from '../types/planner';

export type FocusMode = 'focus' | 'break';
export type FocusStatus = 'idle' | 'running' | 'paused' | 'break';

export interface FocusSessionState {
  mode: FocusMode;
  status: FocusStatus;
  durationSeconds: number;
  remainingSeconds: number;
  targetEndTimestamp: number | null;
  associatedTaskId: string | null;
  lastUpdated: number;
}

export interface FocusContextValue {
  session: FocusSessionState;
  displaySeconds: number;
  formattedTimer: string;
  isRunning: boolean;
  isPaused: boolean;
  isBreak: boolean;
  currentTask: TaskItem | undefined;
  pendingTasks: TaskItem[];
  startTimer: () => void;
  pauseTimer: () => void;
  toggleTimer: () => void;
  resetTimer: () => void;
  startBreak: () => void;
  selectTask: (taskId: string) => void;
  completeTask: () => void;
  deferTaskTomorrow: () => void;
  setSessionDuration: (seconds: number, autoStart?: boolean) => void;
}

export const STORAGE_KEY_FOCUS_SESSION = 'our_life_planner_focus_session_v1';
export const FOCUS_SYNC_CHANNEL_NAME = 'our_life_planner_focus_sync_v1';

export const DEFAULT_FOCUS_DURATION = 25 * 60;
export const DEFAULT_BREAK_DURATION = 5 * 60;

function getInitialSession(): FocusSessionState {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY_FOCUS_SESSION);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed === 'object' &&
          typeof parsed.remainingSeconds === 'number' &&
          typeof parsed.mode === 'string'
        ) {
          const now = Date.now();
          if (parsed.status === 'running' && parsed.targetEndTimestamp) {
            if (now >= parsed.targetEndTimestamp) {
              // Timer finished while offline/away
              return {
                mode: parsed.mode === 'focus' ? 'break' : 'focus',
                status: 'idle',
                durationSeconds: parsed.mode === 'focus' ? DEFAULT_BREAK_DURATION : DEFAULT_FOCUS_DURATION,
                remainingSeconds: parsed.mode === 'focus' ? DEFAULT_BREAK_DURATION : DEFAULT_FOCUS_DURATION,
                targetEndTimestamp: null,
                associatedTaskId: parsed.associatedTaskId || null,
                lastUpdated: now,
              };
            } else {
              // Still running - calculate true remaining seconds from target timestamp
              const left = Math.max(0, Math.ceil((parsed.targetEndTimestamp - now) / 1000));
              return {
                ...parsed,
                remainingSeconds: left,
                lastUpdated: now,
              };
            }
          }
          return {
            mode: parsed.mode === 'break' ? 'break' : 'focus',
            status: parsed.status === 'paused' ? 'paused' : 'idle',
            durationSeconds: parsed.durationSeconds || DEFAULT_FOCUS_DURATION,
            remainingSeconds: Math.max(0, parsed.remainingSeconds),
            targetEndTimestamp: null,
            associatedTaskId: parsed.associatedTaskId || null,
            lastUpdated: now,
          };
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load focus session from storage:', e);
  }

  return {
    mode: 'focus',
    status: 'idle',
    durationSeconds: DEFAULT_FOCUS_DURATION,
    remainingSeconds: DEFAULT_FOCUS_DURATION,
    targetEndTimestamp: null,
    associatedTaskId: null,
    lastUpdated: Date.now(),
  };
}

const FocusContext = createContext<FocusContextValue | null>(null);

export const FocusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tasks, toggleTaskCompletion, rescheduleTask, todayDate } = usePlanner();

  const [session, setSession] = useState<FocusSessionState>(getInitialSession);
  const [displaySeconds, setDisplaySeconds] = useState<number>(() => session.remainingSeconds);

  // Tab coordination channel
  const channelRef = useRef<BroadcastChannel | null>(null);
  const sessionRef = useRef<FocusSessionState>(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Pending tasks list
  const pendingTasks = useMemo(() => {
    return tasks.filter((t) => !t.isArchived && t.status !== 'completed');
  }, [tasks]);

  // Derived current task with stale task protection
  const currentTask: TaskItem | undefined = useMemo(() => {
    if (session.associatedTaskId) {
      const found = tasks.find(
        (t) => t.id === session.associatedTaskId && !t.isArchived && t.status !== 'completed'
      );
      if (found) return found;
    }
    return pendingTasks[0];
  }, [tasks, session.associatedTaskId, pendingTasks]);

  // Persist session state helper
  const persistSession = useCallback((next: FocusSessionState) => {
    try {
      localStorage.setItem(STORAGE_KEY_FOCUS_SESSION, JSON.stringify(next));
      channelRef.current?.postMessage({ type: 'FOCUS_SYNC', session: next });
    } catch (e) {
      console.warn('Failed to persist focus session:', e);
    }
  }, []);

  // Update display seconds and handle countdown accurately using targetEndTimestamp
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (session.status === 'running' && session.targetEndTimestamp) {
      const updateTick = () => {
        const now = Date.now();
        const left = Math.max(0, Math.ceil((session.targetEndTimestamp! - now) / 1000));
        setDisplaySeconds(left);

        if (left <= 0) {
          // Timer reached completion
          if (session.mode === 'focus') {
            // Auto transition to break
            const nextSession: FocusSessionState = {
              mode: 'break',
              status: 'idle',
              durationSeconds: DEFAULT_BREAK_DURATION,
              remainingSeconds: DEFAULT_BREAK_DURATION,
              targetEndTimestamp: null,
              associatedTaskId: session.associatedTaskId,
              lastUpdated: Date.now(),
            };
            setSession(nextSession);
            setDisplaySeconds(DEFAULT_BREAK_DURATION);
            persistSession(nextSession);
          } else {
            // Break completed -> reset to focus
            const nextSession: FocusSessionState = {
              mode: 'focus',
              status: 'idle',
              durationSeconds: DEFAULT_FOCUS_DURATION,
              remainingSeconds: DEFAULT_FOCUS_DURATION,
              targetEndTimestamp: null,
              associatedTaskId: session.associatedTaskId,
              lastUpdated: Date.now(),
            };
            setSession(nextSession);
            setDisplaySeconds(DEFAULT_FOCUS_DURATION);
            persistSession(nextSession);
          }
        }
      };

      updateTick();
      interval = setInterval(updateTick, 250);
    } else {
      setDisplaySeconds(session.remainingSeconds);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [session.status, session.targetEndTimestamp, session.mode, session.associatedTaskId, persistSession]);

  // Cross-tab synchronization via BroadcastChannel and StorageEvent
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel(FOCUS_SYNC_CHANNEL_NAME);
        bc.onmessage = (ev) => {
          if (ev.data?.type === 'FOCUS_SYNC' && ev.data.session) {
            const incoming = ev.data.session as FocusSessionState;
            setSession(incoming);
            if (incoming.status === 'running' && incoming.targetEndTimestamp) {
              const left = Math.max(0, Math.ceil((incoming.targetEndTimestamp - Date.now()) / 1000));
              setDisplaySeconds(left);
            } else {
              setDisplaySeconds(incoming.remainingSeconds);
            }
          }
        };
        channelRef.current = bc;
      } catch {}
    }

    const handleStorage = (ev: StorageEvent) => {
      if (ev.key === STORAGE_KEY_FOCUS_SESSION && ev.newValue) {
        try {
          const incoming = JSON.parse(ev.newValue) as FocusSessionState;
          setSession(incoming);
          if (incoming.status === 'running' && incoming.targetEndTimestamp) {
            const left = Math.max(0, Math.ceil((incoming.targetEndTimestamp - Date.now()) / 1000));
            setDisplaySeconds(left);
          } else {
            setDisplaySeconds(incoming.remainingSeconds);
          }
        } catch {}
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      channelRef.current?.close();
    };
  }, []);

  // Actions
  const startTimer = useCallback(() => {
    const cur = sessionRef.current;
    const now = Date.now();
    const duration = cur.remainingSeconds > 0 ? cur.remainingSeconds : cur.durationSeconds;
    const targetEnd = now + duration * 1000;

    const next: FocusSessionState = {
      ...cur,
      status: 'running',
      remainingSeconds: duration,
      targetEndTimestamp: targetEnd,
      lastUpdated: now,
    };
    setSession(next);
    setDisplaySeconds(duration);
    persistSession(next);
  }, [persistSession]);

  const pauseTimer = useCallback(() => {
    const cur = sessionRef.current;
    const now = Date.now();
    let left = cur.remainingSeconds;
    if (cur.status === 'running' && cur.targetEndTimestamp) {
      left = Math.max(0, Math.ceil((cur.targetEndTimestamp - now) / 1000));
    }

    const next: FocusSessionState = {
      ...cur,
      status: 'paused',
      remainingSeconds: left,
      targetEndTimestamp: null,
      lastUpdated: now,
    };
    setSession(next);
    setDisplaySeconds(left);
    persistSession(next);
  }, [persistSession]);

  const toggleTimer = useCallback(() => {
    if (sessionRef.current.status === 'running') {
      pauseTimer();
    } else {
      startTimer();
    }
  }, [startTimer, pauseTimer]);

  const resetTimer = useCallback(() => {
    const now = Date.now();
    const next: FocusSessionState = {
      mode: 'focus',
      status: 'idle',
      durationSeconds: DEFAULT_FOCUS_DURATION,
      remainingSeconds: DEFAULT_FOCUS_DURATION,
      targetEndTimestamp: null,
      associatedTaskId: sessionRef.current.associatedTaskId,
      lastUpdated: now,
    };
    setSession(next);
    setDisplaySeconds(DEFAULT_FOCUS_DURATION);
    persistSession(next);
  }, [persistSession]);

  const startBreak = useCallback(() => {
    const now = Date.now();
    const duration = DEFAULT_BREAK_DURATION;
    const targetEnd = now + duration * 1000;

    const next: FocusSessionState = {
      mode: 'break',
      status: 'running',
      durationSeconds: duration,
      remainingSeconds: duration,
      targetEndTimestamp: targetEnd,
      associatedTaskId: sessionRef.current.associatedTaskId,
      lastUpdated: now,
    };
    setSession(next);
    setDisplaySeconds(duration);
    persistSession(next);
  }, [persistSession]);

  const selectTask = useCallback(
    (taskId: string) => {
      const next: FocusSessionState = {
        ...sessionRef.current,
        associatedTaskId: taskId,
        lastUpdated: Date.now(),
      };
      setSession(next);
      persistSession(next);
    },
    [persistSession]
  );

  const completeTask = useCallback(() => {
    if (currentTask) {
      toggleTaskCompletion(currentTask.id);
    }
  }, [currentTask, toggleTaskCompletion]);

  const deferTaskTomorrow = useCallback(() => {
    if (currentTask) {
      const parts = todayDate.split('-');
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      d.setDate(d.getDate() + 1);
      const tomorrow = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      rescheduleTask(currentTask.id, tomorrow);
    }
  }, [currentTask, todayDate, rescheduleTask]);

  // Test fixture helper: allows setting short remaining duration for automated verification
  const setSessionDuration = useCallback(
    (seconds: number, autoStart = false) => {
      const now = Date.now();
      const targetEnd = autoStart ? now + seconds * 1000 : null;
      const next: FocusSessionState = {
        ...sessionRef.current,
        status: autoStart ? 'running' : 'idle',
        durationSeconds: seconds,
        remainingSeconds: seconds,
        targetEndTimestamp: targetEnd,
        lastUpdated: now,
      };
      setSession(next);
      setDisplaySeconds(seconds);
      persistSession(next);
    },
    [persistSession]
  );

  // Formatted timer string (e.g. "24:59")
  const formattedTimer = useMemo(() => {
    const mins = Math.floor(displaySeconds / 60);
    const secs = displaySeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [displaySeconds]);

  // Attach global debug fixture for headless browser verification
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__olp_focus__ = {
        getState: () => sessionRef.current,
        getDisplaySeconds: () => displaySeconds,
        start: startTimer,
        pause: pauseTimer,
        toggle: toggleTimer,
        reset: resetTimer,
        startBreak: startBreak,
        setDuration: setSessionDuration,
      };
    }
  }, [displaySeconds, startTimer, pauseTimer, toggleTimer, resetTimer, startBreak, setSessionDuration]);

  const value: FocusContextValue = {
    session,
    displaySeconds,
    formattedTimer,
    isRunning: session.status === 'running',
    isPaused: session.status === 'paused',
    isBreak: session.mode === 'break',
    currentTask,
    pendingTasks,
    startTimer,
    pauseTimer,
    toggleTimer,
    resetTimer,
    startBreak,
    selectTask,
    completeTask,
    deferTaskTomorrow,
    setSessionDuration,
  };

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
};

export const useFocusSession = (): FocusContextValue => {
  const ctx = useContext(FocusContext);
  if (!ctx) {
    throw new Error('useFocusSession must be used within a FocusProvider');
  }
  return ctx;
};
