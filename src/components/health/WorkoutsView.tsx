import React, { useState, useMemo, useEffect } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Modal } from '../ui/Modal';
import {
  Dumbbell,
  Plus,
  Check,
  Calendar,
  Clock,
  Flame,
  ArrowRight,
  TrendingUp,
  Activity,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  X,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { WorkoutSession, WorkoutExercise, WorkoutExerciseSet } from '../../types/planner';
import { calculateWorkoutVolume } from '../../utils/calculations';

const PRESET_EXERCISES = [
  { name: 'Goblet squat', muscleGroup: 'Legs' as const, equipment: 'Dumbbell' as const, defaultWeight: 20, defaultReps: 10 },
  { name: 'Dumbbell row', muscleGroup: 'Back' as const, equipment: 'Dumbbell' as const, defaultWeight: 20, defaultReps: 10 },
  { name: 'Bench press', muscleGroup: 'Chest' as const, equipment: 'Barbell' as const, defaultWeight: 60, defaultReps: 8 },
  { name: 'Romanian deadlift', muscleGroup: 'Legs' as const, equipment: 'Barbell' as const, defaultWeight: 50, defaultReps: 10 },
  { name: 'Overhead press', muscleGroup: 'Arms' as const, equipment: 'Dumbbell' as const, defaultWeight: 14, defaultReps: 10 },
  { name: 'Pull-ups', muscleGroup: 'Back' as const, equipment: 'Bodyweight' as const, defaultWeight: 0, defaultReps: 8 },
  { name: 'Push-ups', muscleGroup: 'Chest' as const, equipment: 'Bodyweight' as const, defaultWeight: 0, defaultReps: 15 },
  { name: 'Plank', muscleGroup: 'Core' as const, equipment: 'Bodyweight' as const, defaultWeight: 0, defaultReps: 60 },
];

export const WorkoutsView: React.FC = () => {
  const {
    settings,
    workouts,
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
    currentDate,
    todayDate,
  } = usePlanner();

  const [activeTab, setActiveTab] = useState<'plan' | 'log' | 'history'>('plan');
  const [selectedDate, setSelectedDate] = useState<string>(currentDate);
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  // Delete session confirm modal
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  // Edit session modal state
  const [isEditSessionModalOpen, setIsEditSessionModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState(currentDate);
  const [editTime, setEditTime] = useState('15:00');
  const [editDuration, setEditDuration] = useState<number>(35);
  const [editMuscles, setEditMuscles] = useState('');
  const [editCardioMin, setEditCardioMin] = useState<number>(0);
  const [editCardioKm, setEditCardioKm] = useState<number>(0);

  // Add Exercise to Session Modal state
  const [isAddExerciseModalOpen, setIsAddExerciseModalOpen] = useState(false);
  const [newExName, setNewExName] = useState('Goblet squat');
  const [newExMuscle, setNewExMuscle] = useState<WorkoutExercise['muscleGroup']>('Legs');
  const [newExEquipment, setNewExEquipment] = useState<NonNullable<WorkoutExercise['equipment']>>('Dumbbell');
  const [newExSetsCount, setNewExSetsCount] = useState<number>(3);
  const [newExDefaultWeight, setNewExDefaultWeight] = useState<number>(20);
  const [newExDefaultReps, setNewExDefaultReps] = useState<number>(10);
  const [newExDefaultRest, setNewExDefaultRest] = useState<number>(60);

  // Edit Exercise Modal state
  const [editingExercise, setEditingExercise] = useState<{ exerciseId: string; name: string; muscleGroup: WorkoutExercise['muscleGroup']; equipment: NonNullable<WorkoutExercise['equipment']> } | null>(null);

  // Creation modal state (with full exercise/sets builder)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDate, setCreateDate] = useState(currentDate);
  const [createTime, setCreateTime] = useState('15:00');
  const [createDuration, setCreateDuration] = useState<number>(35);
  const [createMuscles, setCreateMuscles] = useState('Legs, Back');
  const [createExercises, setCreateExercises] = useState<Array<Omit<WorkoutExercise, 'id'>>>([
    {
      name: 'Goblet squat',
      muscleGroup: 'Legs',
      equipment: 'Dumbbell',
      sets: [
        { setNumber: 1, weightKg: 20, weightUnit: 'kg', reps: 10, restSeconds: 60, isCompleted: false },
        { setNumber: 2, weightKg: 20, weightUnit: 'kg', reps: 10, restSeconds: 60, isCompleted: false },
        { setNumber: 3, weightKg: 20, weightUnit: 'kg', reps: 10, restSeconds: 60, isCompleted: false },
      ],
    },
  ]);

  // Cardio speed calculator state
  const [cardioDuration, setCardioDuration] = useState<number>(30);
  const [cardioDistance, setCardioDistance] = useState<number>(3);
  const [calculatedSpeed, setCalculatedSpeed] = useState<number | null>(6.0);

  // Compute 7-day week strip dynamically from anchor date + week offset
  const weekDays = useMemo(() => {
    try {
      const [y, m, d] = currentDate.split('-').map(Number);
      const anchor = new Date(Date.UTC(y, m - 1, d));
      if (weekOffset !== 0) {
        anchor.setUTCDate(anchor.getUTCDate() + weekOffset * 7);
      }
      const dow = anchor.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      const startOffset = settings.weekStartsOn === 'Sunday' ? -dow : (dow === 0 ? -6 : 1 - dow);
      const startDay = new Date(anchor);
      startDay.setUTCDate(anchor.getUTCDate() + startOffset);

      const DAY_NAMES = settings.weekStartsOn === 'Sunday'
        ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return Array.from({ length: 7 }, (_, i) => {
        const dObj = new Date(startDay);
        dObj.setUTCDate(startDay.getUTCDate() + i);
        const iso = dObj.toISOString().split('T')[0];
        const dayNum = dObj.getUTCDate();
        const dayName = DAY_NAMES[i];

        // Find saved sessions for this day
        const matchingSessions = workouts.filter((w) => w.date === iso);
        const nonRest = matchingSessions.find((w) => !w.isRestDay);
        const rest = matchingSessions.find((w) => w.isRestDay);
        const primary = nonRest || rest || null;

        return {
          dayName,
          dayNum,
          dateStr: iso,
          isToday: iso === todayDate,
          isSelected: iso === selectedDate,
          sessions: matchingSessions,
          primarySession: primary,
          isRest: primary ? primary.isRestDay : true,
          title: primary ? primary.title : 'Rest',
          sub: primary
            ? primary.isRestDay
              ? '–'
              : primary.durationMinutes > 0
              ? `${primary.durationMinutes} min`
              : primary.startTime || '30 min'
            : '–',
          status: primary
            ? primary.isRestDay
              ? 'Rest'
              : primary.isCompleted
              ? 'Completed'
              : 'Scheduled'
            : 'Rest',
        };
      });
    } catch {
      return [];
    }
  }, [currentDate, weekOffset, todayDate, selectedDate, workouts, settings.weekStartsOn]);

  // Selected session resolution
  const selectedSession = useMemo(() => {
    // 1. If explicit selectedSessionId exists in workouts, use it
    if (selectedSessionId) {
      const found = workouts.find((w) => w.id === selectedSessionId);
      if (found) return found;
    }
    // 2. Try to find a non-rest session on selectedDate
    const onSelectedDate = workouts.filter((w) => w.date === selectedDate);
    const nonRestSelected = onSelectedDate.find((w) => !w.isRestDay);
    if (nonRestSelected) return nonRestSelected;
    if (onSelectedDate.length > 0) return onSelectedDate[0];

    // 3. Try to find a non-rest session on currentDate
    const onCurrentDate = workouts.filter((w) => w.date === currentDate);
    const nonRestCurrent = onCurrentDate.find((w) => !w.isRestDay);
    if (nonRestCurrent) return nonRestCurrent;

    // 4. Fallback to any non-rest workout or the first workout
    return workouts.find((w) => !w.isRestDay) || workouts[0] || null;
  }, [workouts, selectedSessionId, selectedDate, currentDate]);

  // Keep selectedSessionId in sync if selectedSession changes
  useEffect(() => {
    if (selectedSession && selectedSession.id !== selectedSessionId) {
      setSelectedSessionId(selectedSession.id);
    }
  }, [selectedSession, selectedSessionId]);

  // Total sets and completed sets for the selected session
  const totalSets = useMemo(() => {
    if (!selectedSession || !selectedSession.exercises) return { total: 0, completed: 0 };
    let total = 0;
    let completed = 0;
    selectedSession.exercises.forEach((ex) => {
      total += ex.sets.length;
      completed += ex.sets.filter((s) => s.isCompleted).length;
    });
    return { total, completed };
  }, [selectedSession]);

  const sessionVolume = useMemo(() => {
    return selectedSession ? calculateWorkoutVolume(selectedSession, settings.weightUnit) : 0;
  }, [selectedSession, settings.weightUnit]);

  // Speed calculation handler
  const handleComputeSpeed = () => {
    if (cardioDuration > 0 && cardioDistance > 0) {
      const speed = cardioDistance / (cardioDuration / 60);
      setCalculatedSpeed(Math.round(speed * 10) / 10);
    }
  };

  // Open Create Modal
  const openCreateModal = (targetDate?: string) => {
    const d = targetDate || selectedDate || currentDate;
    setCreateTitle('');
    setCreateDate(d);
    setCreateTime('15:00');
    setCreateDuration(35);
    setCreateMuscles('Legs, Back');
    setCreateExercises([
      {
        name: 'Goblet squat',
        muscleGroup: 'Legs',
        equipment: 'Dumbbell',
        sets: [
          { setNumber: 1, weightKg: 20, weightUnit: 'kg', reps: 10, restSeconds: 60, isCompleted: false },
          { setNumber: 2, weightKg: 20, weightUnit: 'kg', reps: 10, restSeconds: 60, isCompleted: false },
          { setNumber: 3, weightKg: 20, weightUnit: 'kg', reps: 10, restSeconds: 60, isCompleted: false },
        ],
      },
    ]);
    setIsCreateModalOpen(true);
  };

  // Handle Save New Workout Session
  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) return;

    const formattedMuscles = createMuscles
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);

    const newId = addWorkoutSession({
      title: createTitle.trim(),
      date: createDate,
      startTime: createTime,
      durationMinutes: createDuration,
      muscleGroups: formattedMuscles.length > 0 ? formattedMuscles : ['Full body'],
      exercises: createExercises.map((ex, idx) => ({
        ...ex,
        id: `ex-${Date.now()}-${idx + 1}`,
      })),
      isCompleted: false,
    });

    setSelectedSessionId(newId);
    setSelectedDate(createDate);
    setIsCreateModalOpen(false);
  };

  // Open Edit Session Modal
  const openEditSessionModal = () => {
    if (!selectedSession) return;
    setEditTitle(selectedSession.title);
    setEditDate(selectedSession.date);
    setEditTime(selectedSession.startTime || '15:00');
    setEditDuration(selectedSession.durationMinutes);
    setEditMuscles(selectedSession.muscleGroups.join(', '));
    setEditCardioMin(selectedSession.cardioMinutes || 0);
    setEditCardioKm(selectedSession.cardioDistanceKm || 0);
    setIsEditSessionModalOpen(true);
  };

  // Handle Save Edit Session
  const handleSaveEditSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession || !editTitle.trim()) return;

    updateWorkoutSession(selectedSession.id, {
      title: editTitle.trim(),
      date: editDate,
      startTime: editTime,
      durationMinutes: editDuration,
      muscleGroups: editMuscles.split(',').map((m) => m.trim()).filter(Boolean),
      cardioMinutes: editCardioMin > 0 ? editCardioMin : undefined,
      cardioDistanceKm: editCardioKm > 0 ? editCardioKm : undefined,
    });
    setSelectedDate(editDate);
    setIsEditSessionModalOpen(false);
  };

  // Handle Delete Session
  const handleConfirmDeleteSession = () => {
    if (!deletingSessionId) return;
    deleteWorkoutSession(deletingSessionId);
    setDeletingSessionId(null);
    // Find next session to select
    const remaining = workouts.filter((w) => w.id !== deletingSessionId);
    const nextNonRest = remaining.find((w) => !w.isRestDay);
    if (nextNonRest) {
      setSelectedSessionId(nextNonRest.id);
      setSelectedDate(nextNonRest.date);
    } else if (remaining.length > 0) {
      setSelectedSessionId(remaining[0].id);
      setSelectedDate(remaining[0].date);
    } else {
      setSelectedSessionId('');
    }
  };

  // Add Exercise to Session
  const handleAddExerciseToSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession || !newExName.trim()) return;

    const sets: WorkoutExerciseSet[] = Array.from({ length: Math.max(1, newExSetsCount) }, (_, i) => ({
      setNumber: i + 1,
      weightKg: newExDefaultWeight,
      weightUnit: 'kg',
      reps: newExDefaultReps,
      restSeconds: newExDefaultRest,
      isCompleted: false,
    }));

    addExerciseToSession(selectedSession.id, {
      name: newExName.trim(),
      muscleGroup: newExMuscle,
      equipment: newExEquipment,
      sets,
    });
    setIsAddExerciseModalOpen(false);
  };

  // Handle Save Edit Exercise
  const handleSaveEditExercise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession || !editingExercise || !editingExercise.name.trim()) return;

    updateExerciseInSession(selectedSession.id, editingExercise.exerciseId, {
      name: editingExercise.name.trim(),
      muscleGroup: editingExercise.muscleGroup,
      equipment: editingExercise.equipment,
    });
    setEditingExercise(null);
  };

  // Friendly date display
  const formattedDateStr = useMemo(() => {
    try {
      const parts = selectedDate.split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-[#071A3A] dark:text-[#EDF4FF]">
            Workouts & Training Plan
          </h2>
          <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
            {formattedDateStr} · Weekly schedule, sessions, exercises & sets
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-[#526782]">
            {(['plan', 'log', 'history'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-colors cursor-pointer ${
                  activeTab === t
                    ? 'bg-white dark:bg-[#152238] text-[#087F83] dark:text-[#38D0C5] shadow-xs'
                    : ''
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <button
            onClick={() => openCreateModal(selectedDate)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#087F83] hover:bg-[#06676A] dark:bg-[#38D0C5] dark:hover:bg-[#2BB5AB] text-white dark:text-[#071A3A] font-semibold text-xs transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New workout</span>
          </button>
        </div>
      </div>

      {/* Week Plan Strip (Dynamically populated from saved records) */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF] uppercase tracking-wider">
              Workout week plan
            </h3>
            {weekOffset !== 0 && (
              <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-[#526782] font-semibold">
                {weekOffset > 0 ? `+${weekOffset} wks` : `${weekOffset} wks`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setWeekOffset((prev) => prev - 1)}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[#526782] dark:text-[#A8B8CE] cursor-pointer"
              title="Previous week"
              aria-label="Previous week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setWeekOffset(0);
                setSelectedDate(currentDate);
              }}
              className="px-2 py-1 rounded-lg text-[11px] font-semibold text-[#526782] dark:text-[#A8B8CE] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              This week
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset((prev) => prev + 1)}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[#526782] dark:text-[#A8B8CE] cursor-pointer"
              title="Next week"
              aria-label="Next week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-3 text-center overflow-x-auto min-w-[650px]">
          {weekDays.map((col) => {
            const isColSelected = col.dateStr === selectedDate;

            return (
              <div
                key={col.dateStr}
                onClick={() => {
                  setSelectedDate(col.dateStr);
                  if (col.primarySession) {
                    setSelectedSessionId(col.primarySession.id);
                  }
                }}
                className={`p-3 rounded-xl border text-xs transition-all cursor-pointer select-none text-left flex flex-col justify-between ${
                  isColSelected
                    ? 'border-[#087F83] ring-2 ring-[#087F83]/30 bg-teal-50/60 dark:bg-teal-950/30'
                    : col.isToday
                    ? 'border-teal-300 dark:border-teal-800 bg-teal-50/20 dark:bg-teal-950/10'
                    : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#526782] font-semibold uppercase">
                      {col.dayName} {col.dayNum}
                    </span>
                    {col.isToday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#087F83]" title="Today" />
                    )}
                  </div>
                  <div className="font-bold text-[#071A3A] dark:text-[#EDF4FF] mt-1.5 truncate">
                    {col.title}
                  </div>
                  <div className="text-[11px] text-[#526782] truncate">{col.sub}</div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-semibold ${
                      col.status === 'Rest'
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        : col.status === 'Completed'
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : 'bg-teal-100 dark:bg-teal-900/60 text-[#087F83] dark:text-[#38D0C5]'
                    }`}
                  >
                    {col.status}
                  </span>

                  {col.sessions.length > 1 && (
                    <span className="text-[10px] font-mono text-[#526782]">
                      +{col.sessions.length - 1}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {activeTab !== 'history' ? (
        /* Main 2-Column Area: Selected Session Details (7 cols) & Summary + Cardio (5 cols) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Active Workout Session & Exercises (7 cols) */}
          <div className="lg:col-span-7 bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-6">
            {selectedSession ? (
              <>
                {/* Session Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-4 border-b border-[#E2E8F0] dark:border-[#1E2D4A] gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                        {selectedSession.title}
                      </h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold ${
                          selectedSession.isRestDay
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                            : selectedSession.isCompleted
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : 'bg-teal-50 dark:bg-teal-950/60 text-[#087F83] dark:text-[#38D0C5]'
                        }`}
                      >
                        {selectedSession.isRestDay
                          ? 'Rest Day'
                          : selectedSession.isCompleted
                          ? 'Completed'
                          : 'Scheduled'}
                      </span>
                    </div>

                    <p className="text-xs text-[#526782] dark:text-[#A8B8CE] mt-1 flex items-center gap-2">
                      <span>{selectedSession.date}</span>
                      <span>·</span>
                      <span>{selectedSession.startTime || '15:00'}</span>
                      {selectedSession.durationMinutes > 0 && (
                        <>
                          <span>·</span>
                          <span>{selectedSession.durationMinutes} min</span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={openEditSessionModal}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] flex items-center gap-1.5 cursor-pointer"
                      title="Edit session details"
                      aria-label={`Edit session details for "${selectedSession.title}"`}
                    >
                      <Edit2 className="w-3.5 h-3.5 text-[#087F83]" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeletingSessionId(selectedSession.id)}
                      className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 cursor-pointer"
                      title="Delete workout session"
                      aria-label={`Delete workout session "${selectedSession.title}"`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        updateWorkoutSession(selectedSession.id, {
                          isCompleted: !selectedSession.isCompleted,
                        });
                      }}
                      aria-label={`Mark session "${selectedSession.title}" as ${selectedSession.isCompleted ? 'active' : 'completed'}`}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                        selectedSession.isCompleted
                          ? 'bg-slate-100 dark:bg-slate-800 text-[#526782] dark:text-[#A8B8CE]'
                          : 'bg-[#087F83] text-white hover:bg-[#06676A]'
                      }`}
                    >
                      {selectedSession.isCompleted ? 'Mark active' : 'Complete'}
                    </button>
                  </div>
                </div>

                {/* Muscle groups badges */}
                {selectedSession.muscleGroups && selectedSession.muscleGroups.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-[#526782]">Target:</span>
                    {selectedSession.muscleGroups.map((m) => (
                      <span
                        key={m}
                        className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-[#071A3A] dark:text-[#EDF4FF]"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                )}

                {/* Exercise section header with Add Exercise button */}
                <div className="flex items-center justify-between pt-2">
                  <div className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                    Exercises ({selectedSession.exercises ? selectedSession.exercises.length : 0})
                  </div>

                  <button
                    onClick={() => {
                      setNewExName('Goblet squat');
                      setNewExMuscle('Legs');
                      setNewExEquipment('Dumbbell');
                      setNewExSetsCount(3);
                      setNewExDefaultWeight(20);
                      setNewExDefaultReps(10);
                      setNewExDefaultRest(60);
                      setIsAddExerciseModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 text-[#087F83] dark:text-[#38D0C5] text-xs font-semibold cursor-pointer border border-teal-200 dark:border-teal-900/60"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add exercise</span>
                  </button>
                </div>

                {/* Exercises list */}
                <div className="space-y-4">
                  {!selectedSession.exercises || selectedSession.exercises.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[#526782] bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                      <p>No exercises logged in this session yet.</p>
                      <button
                        onClick={() => setIsAddExerciseModalOpen(true)}
                        className="mt-2 text-xs font-semibold text-[#087F83] dark:text-[#38D0C5] hover:underline"
                      >
                        + Add first exercise
                      </button>
                    </div>
                  ) : (
                    selectedSession.exercises.map((ex, exIdx) => {
                      const completedSets = ex.sets.filter((s) => s.isCompleted).length;
                      let exVol = 0;
                      ex.sets.forEach((s) => {
                        if (s.isCompleted) {
                          exVol += (s.weightKg || 0) * s.reps;
                        }
                      });

                      return (
                        <div
                          key={ex.id}
                          className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                                {exIdx + 1}. {ex.name}
                              </span>
                              <span className="text-[11px] text-[#526782] bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                {ex.muscleGroup} · {ex.equipment || 'Equipment'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-[#087F83] dark:text-[#38D0C5]">
                                {exVol} kg ({completedSets}/{ex.sets.length} sets)
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  setEditingExercise({
                                    exerciseId: ex.id,
                                    name: ex.name,
                                    muscleGroup: ex.muscleGroup,
                                    equipment: ex.equipment || 'Dumbbell',
                                  })
                                }
                                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-[#526782] dark:text-[#A8B8CE] cursor-pointer"
                                title="Edit exercise"
                                aria-label={`Edit exercise "${ex.name}"`}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => deleteExerciseFromSession(selectedSession.id, ex.id)}
                                className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-500 cursor-pointer"
                                title="Delete exercise"
                                aria-label={`Delete exercise "${ex.name}"`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Sets table */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="text-[#526782] border-b border-slate-200 dark:border-slate-700 text-[11px]">
                                  <th className="py-1.5 px-2">Set</th>
                                  <th className="py-1.5 px-2">Weight (kg)</th>
                                  <th className="py-1.5 px-2">Reps</th>
                                  <th className="py-1.5 px-2">Rest (s)</th>
                                  <th className="py-1.5 px-2 text-center">Done</th>
                                  <th className="py-1.5 px-2 text-right">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {ex.sets.map((set) => (
                                  <tr key={set.setNumber} className="hover:bg-white/60 dark:hover:bg-slate-800/60">
                                    <td className="py-2 px-2 font-mono font-semibold">
                                      {set.setNumber}
                                    </td>
                                    <td className="py-2 px-2">
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.5"
                                        value={set.weightKg ?? 0}
                                        onChange={(e) => {
                                          const val = parseFloat(e.target.value) || 0;
                                          updateSetInExercise(
                                            selectedSession.id,
                                            ex.id,
                                            set.setNumber,
                                            { weightKg: val }
                                          );
                                        }}
                                        className="w-16 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] font-mono text-xs font-semibold"
                                      />
                                    </td>
                                    <td className="py-2 px-2">
                                      <input
                                        type="number"
                                        min="1"
                                        value={set.reps}
                                        onChange={(e) => {
                                          const val = parseInt(e.target.value) || 1;
                                          updateSetInExercise(
                                            selectedSession.id,
                                            ex.id,
                                            set.setNumber,
                                            { reps: val }
                                          );
                                        }}
                                        className="w-14 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] font-mono text-xs font-semibold"
                                      />
                                    </td>
                                    <td className="py-2 px-2">
                                      <input
                                        type="number"
                                        min="0"
                                        step="5"
                                        value={set.restSeconds}
                                        onChange={(e) => {
                                          const val = parseInt(e.target.value) || 0;
                                          updateSetInExercise(
                                            selectedSession.id,
                                            ex.id,
                                            set.setNumber,
                                            { restSeconds: val }
                                          );
                                        }}
                                        className="w-14 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] font-mono text-xs"
                                      />
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                      <button
                                        onClick={() =>
                                          toggleSetCompleted(selectedSession.id, ex.id, set.setNumber)
                                        }
                                        className={`w-5 h-5 rounded-md inline-flex items-center justify-center cursor-pointer transition-colors ${
                                          set.isCompleted
                                            ? 'bg-[#087F83] text-white'
                                            : 'border border-slate-300 dark:border-slate-600 hover:border-[#087F83]'
                                        }`}
                                      >
                                        {set.isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                      </button>
                                    </td>
                                    <td className="py-2 px-2 text-right">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          deleteSetFromExercise(selectedSession.id, ex.id, set.setNumber)
                                        }
                                        className="text-slate-400 hover:text-rose-500 cursor-pointer p-0.5"
                                        title="Delete set"
                                        aria-label={`Delete set ${set.setNumber} for "${ex.name}"`}
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Add set button */}
                          <div className="pt-1">
                            <button
                              onClick={() => addSetToExercise(selectedSession.id, ex.id)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#087F83] dark:text-[#38D0C5] hover:bg-teal-50 dark:hover:bg-teal-950/40 border border-teal-200 dark:border-teal-900/40 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add set</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-xs text-[#526782]">
                <Dumbbell className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p>No workout session selected or scheduled for this date.</p>
                <button
                  onClick={() => openCreateModal(selectedDate)}
                  className="mt-3 px-4 py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A] cursor-pointer"
                >
                  Schedule workout on this date
                </button>
              </div>
            )}
          </div>

          {/* Today's Session Summary & Cardio Calculator (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Session Summary Card */}
            <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                Session summary
              </h3>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <div className="text-[11px] text-[#526782]">Sets completed</div>
                  <div className="text-xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF] mt-1">
                    {totalSets.completed}/{totalSets.total}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <div className="text-[11px] text-[#526782]">Volume</div>
                  <div className="text-xl font-bold font-mono text-[#087F83] dark:text-[#38D0C5] mt-1">
                    {sessionVolume.toLocaleString()} {settings.weightUnit}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <div className="text-[11px] text-[#526782]">Duration</div>
                  <div className="text-xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF] mt-1">
                    {selectedSession ? `${selectedSession.durationMinutes} min` : '–'}
                  </div>
                </div>
              </div>

              {selectedSession && (
                <button
                  onClick={() => {
                    updateWorkoutSession(selectedSession.id, {
                      isCompleted: !selectedSession.isCompleted,
                    });
                  }}
                  className={`w-full py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                    selectedSession.isCompleted
                      ? 'bg-slate-100 dark:bg-slate-800 text-[#526782]'
                      : 'bg-[#071A3A] dark:bg-[#087F83] text-white hover:bg-black'
                  }`}
                >
                  {selectedSession.isCompleted ? 'Session completed ✓' : 'Finish session'}
                </button>
              )}
            </div>

            {/* Cardio Activity Calculator */}
            <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                Cardio activity calculator
              </h3>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-[#526782] mb-1">
                    Duration (min)
                  </label>
                  <input
                    type="number"
                    value={cardioDuration}
                    onChange={(e) => setCardioDuration(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs font-mono font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#526782] mb-1">
                    Distance (km)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={cardioDistance}
                    onChange={(e) => setCardioDistance(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs font-mono font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#526782] mb-1">
                    Speed (km/h)
                  </label>
                  <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold text-[#087F83]">
                    {calculatedSpeed ? `${calculatedSpeed} km/h` : '–'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleComputeSpeed}
                className="w-full py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[#526782] hover:bg-slate-50 cursor-pointer"
              >
                Calculate speed
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* History Tab */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#152238] rounded-2xl p-4 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
              <div className="text-xs text-[#526782]">Total sessions</div>
              <div className="text-2xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF] mt-1">
                {workouts.filter((w) => !w.isRestDay).length}
              </div>
              <div className="text-[10px] text-emerald-600 font-medium">
                Active tracked sessions
              </div>
            </div>

            <div className="bg-white dark:bg-[#152238] rounded-2xl p-4 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
              <div className="text-xs text-[#526782] dark:text-[#A8B8CE]">Total volume</div>
              <div className="text-2xl font-bold font-mono text-[#087F83] dark:text-[#38D0C5] mt-1">
                {workouts.reduce((sum, w) => sum + calculateWorkoutVolume(w, settings.weightUnit), 0).toLocaleString()} {settings.weightUnit}
              </div>
              <div className="text-[10px] text-emerald-600 font-medium">
                All-time lifted volume
              </div>
            </div>

            <div className="bg-white dark:bg-[#152238] rounded-2xl p-4 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
              <div className="text-xs text-[#526782] dark:text-[#A8B8CE]">Completed sessions</div>
              <div className="text-2xl font-bold font-mono text-purple-600 mt-1">
                {workouts.filter((w) => w.isCompleted && !w.isRestDay).length}
              </div>
              <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE]">Logged and finished</div>
            </div>

            <div className="bg-white dark:bg-[#152238] rounded-2xl p-4 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
              <div className="text-xs text-[#526782] dark:text-[#A8B8CE]">Rest days</div>
              <div className="text-2xl font-bold font-mono text-slate-600 mt-1">
                {workouts.filter((w) => w.isRestDay).length}
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                Scheduled rest & recovery
              </div>
            </div>
          </div>

          {/* Muscle Groups Breakdown */}
          <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              Trained muscle groups distribution
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-[#526782] dark:text-[#A8B8CE] block text-[11px]">Legs</span>
                <span className="text-lg font-bold text-[#087F83] dark:text-[#38D0C5] mt-1 block">
                  {workouts.filter((w) => w.muscleGroups?.some((mg) => mg.toLowerCase().includes('leg'))).length} sessions
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-[#526782] dark:text-[#A8B8CE] block text-[11px]">Back</span>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1 block">
                  {workouts.filter((w) => w.muscleGroups?.some((mg) => mg.toLowerCase().includes('back'))).length} sessions
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-[#526782] dark:text-[#A8B8CE] block text-[11px]">Chest</span>
                <span className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1 block">
                  {workouts.filter((w) => w.muscleGroups?.some((mg) => mg.toLowerCase().includes('chest'))).length} sessions
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-[#526782] dark:text-[#A8B8CE] block text-[11px]">Shoulders</span>
                <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-1 block">
                  {workouts.filter((w) => w.muscleGroups?.some((mg) => mg.toLowerCase().includes('shoulder'))).length} sessions
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-[#526782] dark:text-[#A8B8CE] block text-[11px]">Arms</span>
                <span className="text-lg font-bold text-violet-600 dark:text-violet-400 mt-1 block">
                  {workouts.filter((w) => w.muscleGroups?.some((mg) => mg.toLowerCase().includes('arm'))).length} sessions
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-[#526782] dark:text-[#A8B8CE] block text-[11px]">Core / Abs</span>
                <span className="text-lg font-bold text-teal-600 dark:text-teal-400 mt-1 block">
                  {workouts.filter((w) => w.muscleGroups?.some((mg) => mg.toLowerCase().includes('core') || mg.toLowerCase().includes('ab'))).length} sessions
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-[#526782] dark:text-[#A8B8CE] block text-[11px]">Full body</span>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
                  {workouts.filter((w) => w.muscleGroups?.some((mg) => mg.toLowerCase().includes('full'))).length} sessions
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-[#526782] dark:text-[#A8B8CE] block text-[11px]">Cardio</span>
                <span className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-1 block">
                  {workouts.filter((w) => w.muscleGroups?.some((mg) => mg.toLowerCase().includes('cardio')) || (Boolean(w.cardioMinutes) && w.cardioMinutes! > 0)).length} sessions
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Workout Modal (Complete with exercise & sets configuration) */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Schedule workout"
        subtitle="Plan a new workout session with exercises, sets, weights and reps"
      >
        <form onSubmit={handleCreateSession} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
              Session title *
            </label>
            <input
              type="text"
              required
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder="e.g. QA TEST — workout, Lower body strength, Morning run"
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-semibold focus:ring-2 focus:ring-[#087F83]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Date
              </label>
              <input
                type="date"
                required
                value={createDate}
                onChange={(e) => setCreateDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Start time
              </label>
              <input
                type="time"
                value={createTime}
                onChange={(e) => setCreateTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Duration (minutes)
              </label>
              <input
                type="number"
                min="5"
                value={createDuration}
                onChange={(e) => setCreateDuration(parseInt(e.target.value) || 30)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Target muscle groups
              </label>
              <input
                type="text"
                value={createMuscles}
                onChange={(e) => setCreateMuscles(e.target.value)}
                placeholder="Legs, Back"
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
              />
            </div>
          </div>

          {/* Exercises in Creation Form */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                Planned exercises & sets
              </span>
              <span className="text-[10px] text-[#526782]">
                {createExercises.length} {createExercises.length === 1 ? 'exercise' : 'exercises'}
              </span>
            </div>

            {/* Quick Presets Buttons */}
            <div className="space-y-1">
              <span className="text-[10px] text-[#526782] block">Quick add exercise:</span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_EXERCISES.slice(0, 6).map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setCreateExercises((prev) => [
                        ...prev,
                        {
                          name: preset.name,
                          muscleGroup: preset.muscleGroup,
                          equipment: preset.equipment,
                          sets: [
                            { setNumber: 1, weightKg: preset.defaultWeight, weightUnit: 'kg', reps: preset.defaultReps, restSeconds: 60, isCompleted: false },
                            { setNumber: 2, weightKg: preset.defaultWeight, weightUnit: 'kg', reps: preset.defaultReps, restSeconds: 60, isCompleted: false },
                            { setNumber: 3, weightKg: preset.defaultWeight, weightUnit: 'kg', reps: preset.defaultReps, restSeconds: 60, isCompleted: false },
                          ],
                        },
                      ]);
                    }}
                    className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:border-[#087F83] text-[#071A3A] dark:text-[#EDF4FF] cursor-pointer"
                  >
                    + {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Exercise items list */}
            <div className="space-y-2.5 max-h-56 overflow-y-auto">
              {createExercises.map((ex, exIdx) => (
                <div
                  key={exIdx}
                  className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#071A3A] dark:text-[#EDF4FF]">
                      {exIdx + 1}. {ex.name} ({ex.sets.length} sets)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCreateExercises((prev) => prev.filter((_, idx) => idx !== exIdx));
                      }}
                      className="text-slate-400 hover:text-rose-500 cursor-pointer p-0.5"
                      title="Remove exercise"
                      aria-label={`Remove exercise "${ex.name || `Exercise ${exIdx + 1}`}"`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <span className="text-[#526782] block text-[10px]">Sets</span>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={ex.sets.length}
                        onChange={(e) => {
                          const count = Math.max(1, parseInt(e.target.value) || 1);
                          const lastSet = ex.sets[ex.sets.length - 1];
                          const newSets = Array.from({ length: count }, (_, i) => ({
                            setNumber: i + 1,
                            weightKg: lastSet ? lastSet.weightKg : 20,
                            weightUnit: 'kg' as const,
                            reps: lastSet ? lastSet.reps : 10,
                            restSeconds: lastSet ? lastSet.restSeconds : 60,
                            isCompleted: false,
                          }));
                          setCreateExercises((prev) =>
                            prev.map((item, idx) =>
                              idx === exIdx ? { ...item, sets: newSets } : item
                            )
                          );
                        }}
                        className="w-full px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[#526782] block text-[10px]">Weight (kg)</span>
                      <input
                        type="number"
                        min="0"
                        value={ex.sets[0]?.weightKg ?? 20}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setCreateExercises((prev) =>
                            prev.map((item, idx) =>
                              idx === exIdx
                                ? {
                                    ...item,
                                    sets: item.sets.map((s) => ({ ...s, weightKg: val })),
                                  }
                                : item
                            )
                          );
                        }}
                        className="w-full px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[#526782] block text-[10px]">Reps</span>
                      <input
                        type="number"
                        min="1"
                        value={ex.sets[0]?.reps ?? 10}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          setCreateExercises((prev) =>
                            prev.map((item, idx) =>
                              idx === exIdx
                                ? {
                                    ...item,
                                    sets: item.sets.map((s) => ({ ...s, reps: val })),
                                  }
                                : item
                            )
                          );
                        }}
                        className="w-full px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[#526782] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A] cursor-pointer"
            >
              Save workout
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Session Modal */}
      {selectedSession && (
        <Modal
          isOpen={isEditSessionModalOpen}
          onClose={() => setIsEditSessionModalOpen(false)}
          title="Edit workout session"
          subtitle="Update session metadata, timing, and muscle groups"
        >
          <form onSubmit={handleSaveEditSession} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Session title *
              </label>
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                  Start time
                </label>
                <input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editDuration}
                  onChange={(e) => setEditDuration(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                  Target muscle groups
                </label>
                <input
                  type="text"
                  value={editMuscles}
                  onChange={(e) => setEditMuscles(e.target.value)}
                  placeholder="Legs, Back"
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditSessionModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#526782]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A]"
              >
                Save changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Exercise Modal */}
      {selectedSession && (
        <Modal
          isOpen={isAddExerciseModalOpen}
          onClose={() => setIsAddExerciseModalOpen(false)}
          title={`Add exercise · ${selectedSession.title}`}
          subtitle="Configure exercise name, equipment, sets, reps and starting weight"
        >
          <form onSubmit={handleAddExerciseToSession} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Exercise name *
              </label>
              <input
                type="text"
                required
                value={newExName}
                onChange={(e) => setNewExName(e.target.value)}
                placeholder="e.g. Bench press, Goblet squat"
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-semibold"
              />

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {PRESET_EXERCISES.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setNewExName(preset.name);
                      setNewExMuscle(preset.muscleGroup);
                      setNewExEquipment(preset.equipment);
                      setNewExDefaultWeight(preset.defaultWeight);
                      setNewExDefaultReps(preset.defaultReps);
                    }}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/60 text-[#071A3A] dark:text-[#EDF4FF] cursor-pointer"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                  Muscle group
                </label>
                <select
                  value={newExMuscle}
                  onChange={(e) => setNewExMuscle(e.target.value as WorkoutExercise['muscleGroup'])}
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
                >
                  <option value="Legs">Legs</option>
                  <option value="Back">Back</option>
                  <option value="Chest">Chest</option>
                  <option value="Arms">Arms</option>
                  <option value="Core">Core</option>
                  <option value="Full body">Full body</option>
                  <option value="Cardio">Cardio</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                  Equipment
                </label>
                <select
                  value={newExEquipment}
                  onChange={(e) =>
                    setNewExEquipment(e.target.value as NonNullable<WorkoutExercise['equipment']>)
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
                >
                  <option value="Dumbbell">Dumbbell</option>
                  <option value="Barbell">Barbell</option>
                  <option value="Machine">Machine</option>
                  <option value="Bodyweight">Bodyweight</option>
                  <option value="Cable">Cable</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="block text-[11px] text-[#526782] mb-1">Sets</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={newExSetsCount}
                  onChange={(e) => setNewExSetsCount(parseInt(e.target.value) || 1)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs font-mono font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#526782] mb-1">Weight (kg)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={newExDefaultWeight}
                  onChange={(e) => setNewExDefaultWeight(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs font-mono font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#526782] mb-1">Reps</label>
                <input
                  type="number"
                  min="1"
                  value={newExDefaultReps}
                  onChange={(e) => setNewExDefaultReps(parseInt(e.target.value) || 1)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs font-mono font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#526782] mb-1">Rest (s)</label>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={newExDefaultRest}
                  onChange={(e) => setNewExDefaultRest(parseInt(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddExerciseModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#526782]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A]"
              >
                Add exercise
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Exercise Modal */}
      {editingExercise && selectedSession && (
        <Modal
          isOpen={!!editingExercise}
          onClose={() => setEditingExercise(null)}
          title="Edit exercise"
          subtitle="Update exercise name, muscle group or equipment"
        >
          <form onSubmit={handleSaveEditExercise} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Exercise name *
              </label>
              <input
                type="text"
                required
                value={editingExercise.name}
                onChange={(e) =>
                  setEditingExercise((prev) => (prev ? { ...prev, name: e.target.value } : null))
                }
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                  Muscle group
                </label>
                <select
                  value={editingExercise.muscleGroup}
                  onChange={(e) =>
                    setEditingExercise((prev) =>
                      prev
                        ? { ...prev, muscleGroup: e.target.value as WorkoutExercise['muscleGroup'] }
                        : null
                    )
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
                >
                  <option value="Legs">Legs</option>
                  <option value="Back">Back</option>
                  <option value="Chest">Chest</option>
                  <option value="Arms">Arms</option>
                  <option value="Core">Core</option>
                  <option value="Full body">Full body</option>
                  <option value="Cardio">Cardio</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                  Equipment
                </label>
                <select
                  value={editingExercise.equipment}
                  onChange={(e) =>
                    setEditingExercise((prev) =>
                      prev
                        ? {
                            ...prev,
                            equipment: e.target.value as NonNullable<WorkoutExercise['equipment']>,
                          }
                        : null
                    )
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
                >
                  <option value="Dumbbell">Dumbbell</option>
                  <option value="Barbell">Barbell</option>
                  <option value="Machine">Machine</option>
                  <option value="Bodyweight">Bodyweight</option>
                  <option value="Cable">Cable</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingExercise(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#526782]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A]"
              >
                Save
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Session Confirm Modal */}
      {deletingSessionId && (
        <Modal
          isOpen={!!deletingSessionId}
          onClose={() => setDeletingSessionId(null)}
          title="Delete workout session?"
          subtitle="Are you sure you want to remove this session from your schedule?"
        >
          <div className="space-y-4">
            <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
              This will permanently delete the workout session and its exercises from your records.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingSessionId(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#526782] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSession}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
              >
                Delete session
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
