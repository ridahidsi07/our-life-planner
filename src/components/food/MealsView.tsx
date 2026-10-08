import React, { useState, useMemo } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { getWeekDaysForDate, getWeekStartDate } from '../../utils/formatters';
import { Modal } from '../ui/Modal';
import {
  Utensils,
  Plus,
  Calendar,
  Clock,
  Check,
  Search,
  ShoppingCart,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { PlannedMeal, RecipeItem, RecipeIngredient } from '../../types/planner';

interface WeekDayMealCol {
  name: string;
  num: number;
  monthName: string;
  dateStr: string;
}

export const MealsView: React.FC = () => {
  const {
    settings,
    plannedMeals,
    addPlannedMeal,
    updatePlannedMeal,
    deletePlannedMeal,
    toggleMealConsumed,
    recipes,
    addRecipe,
    updateRecipe,
    deleteRecipe,
    regenerateGroceries,
    setActiveView,
    currentDate,
  } = usePlanner();

  const [activeTab, setActiveTab] = useState<'weekly_plan' | 'food_library'>('weekly_plan');
  const [selectedMealId, setSelectedMealId] = useState<string>(
    plannedMeals.length > 0 ? plannedMeals[0].id : ''
  );

  // Current week start string and week days calculation
  const currentWeekMondayStr = useMemo(() => {
    return getWeekStartDate(currentDate, settings.weekStartsOn);
  }, [currentDate, settings.weekStartsOn]);

  const weekDays = useMemo<WeekDayMealCol[]>(() => {
    const list = getWeekDaysForDate(currentDate, settings.weekStartsOn);
    return list.map((d) => ({
      name: d.dayName,
      num: d.dayNum,
      monthName: d.monthName,
      dateStr: d.dateStr,
    }));
  }, [currentDate, settings.weekStartsOn]);

  // Plan Meal Modal state
  const [isPlanMealModalOpen, setIsPlanMealModalOpen] = useState(false);
  const [planDate, setPlanDate] = useState(currentDate);
  const [planMealType, setPlanMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('dinner');
  const [planRecipeId, setPlanRecipeId] = useState<string>(recipes[0]?.id || '');
  const [planServings, setPlanServings] = useState<number>(4);
  const [planTime, setPlanTime] = useState('19:00');

  // Recipe Modal state
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<RecipeItem | null>(null);
  const [recTitle, setRecTitle] = useState('');
  const [recCategory, setRecCategory] = useState<'Vegetarian' | 'Main dish' | 'Quick' | 'Baking' | 'Salad'>('Main dish');
  const [recBaseServings, setRecBaseServings] = useState<number>(2);
  const [recPrepMins, setRecPrepMins] = useState<number>(10);
  const [recCookMins, setRecCookMins] = useState<number>(15);
  const [recInstructions, setRecInstructions] = useState('');
  const [recIngredients, setRecIngredients] = useState<RecipeIngredient[]>([
    { name: 'Rice', amount: 200, unit: 'g' },
    { name: 'Peppers', amount: 2, unit: 'count' },
    { name: 'Stock', amount: 400, unit: 'ml' },
  ]);

  const selectedMeal =
    plannedMeals.find((m) => m.id === selectedMealId) || (plannedMeals.length > 0 ? plannedMeals[0] : null);

  const openPlanMealModalFor = (dateStr: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => {
    setPlanDate(dateStr);
    setPlanMealType(mealType);
    setPlanServings(2);
    setPlanTime(mealType === 'breakfast' ? '08:00' : mealType === 'lunch' ? '12:30' : '19:00');
    setIsPlanMealModalOpen(true);
  };

  const handleSavePlannedMeal = (e: React.FormEvent) => {
    e.preventDefault();
    const recipe = recipes.find((r) => r.id === planRecipeId);
    if (!recipe) return;

    // Snapshot ingredients from recipe
    addPlannedMeal({
      date: planDate,
      mealType: planMealType,
      plannedTime: planTime,
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      plannedServings: planServings,
      baseServings: recipe.baseServings,
      ingredientsSnapshot: [...recipe.ingredients],
      isConsumed: false,
    });
    setIsPlanMealModalOpen(false);
  };

  const openCreateRecipe = () => {
    setEditingRecipe(null);
    setRecTitle('');
    setRecCategory('Main dish');
    setRecBaseServings(2);
    setRecPrepMins(10);
    setRecCookMins(15);
    setRecInstructions('');
    setRecIngredients([{ name: '', amount: 100, unit: 'g' }]);
    setIsRecipeModalOpen(true);
  };

  const handleSaveRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recTitle.trim()) return;

    const validIngs = recIngredients.filter((i) => i.name.trim() && i.amount > 0);

    if (editingRecipe) {
      updateRecipe(editingRecipe.id, {
        title: recTitle.trim(),
        category: recCategory,
        baseServings: recBaseServings,
        prepTimeMinutes: recPrepMins,
        cookTimeMinutes: recCookMins,
        instructions: recInstructions,
        ingredients: validIngs,
      });
    } else {
      addRecipe({
        title: recTitle.trim(),
        category: recCategory,
        baseServings: recBaseServings,
        prepTimeMinutes: recPrepMins,
        cookTimeMinutes: recCookMins,
        instructions: recInstructions,
        ingredients: validIngs,
      });
    }
    setIsRecipeModalOpen(false);
  };

  const handleGenerateGroceries = () => {
    regenerateGroceries(currentWeekMondayStr);
    setActiveView('groceries');
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-[#071A3A] dark:text-[#EDF4FF]">
            Meals & Food Library
          </h2>
          <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
            Plan your weekly meals, try new recipes, and generate your grocery list.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-[#526782]">
            <button
              onClick={() => setActiveTab('weekly_plan')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'weekly_plan'
                  ? 'bg-white dark:bg-[#152238] text-[#087F83] dark:text-[#38D0C5] shadow-xs'
                  : ''
              }`}
            >
              Weekly plan
            </button>
            <button
              onClick={() => setActiveTab('food_library')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'food_library'
                  ? 'bg-white dark:bg-[#152238] text-[#087F83] dark:text-[#38D0C5] shadow-xs'
                  : ''
              }`}
            >
              Food library ({recipes.length})
            </button>
          </div>

          {activeTab === 'weekly_plan' ? (
            <button
              onClick={() => openPlanMealModalFor(currentDate, 'dinner')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#087F83] hover:bg-[#06676A] dark:bg-[#38D0C5] dark:hover:bg-[#2BB5AB] text-white dark:text-[#071A3A] font-semibold text-xs transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Plan meal</span>
            </button>
          ) : (
            <button
              onClick={openCreateRecipe}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#087F83] hover:bg-[#06676A] dark:bg-[#38D0C5] dark:hover:bg-[#2BB5AB] text-white dark:text-[#071A3A] font-semibold text-xs transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New recipe</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'weekly_plan' && (
        <div className="space-y-6">
          {/* Main 2-Column Area: Week Grid (8 cols) & Selected Meal Detail (4 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Week Meal Matrix (8 cols) */}
            <div className="lg:col-span-8 bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs overflow-x-auto">
              <div className="min-w-[650px]">
                {/* Day Header Row */}
                <div className="grid grid-cols-8 pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D4A] text-xs font-bold text-center text-[#526782]">
                  <div className="col-span-1 text-left">Meal</div>
                  {weekDays.map((w) => (
                    <div key={w.dateStr} className="col-span-1">
                      <div>{w.name}</div>
                      <div className="text-[10px] opacity-70">{w.num} {w.monthName}</div>
                    </div>
                  ))}
                </div>

                {/* Rows: Breakfast, Lunch, Dinner, Snack */}
                {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((mType) => (
                  <div
                    key={mType}
                    className="grid grid-cols-8 py-3.5 border-b border-slate-100 dark:border-slate-800 items-start text-xs"
                  >
                    <div className="col-span-1 font-bold capitalize text-[#071A3A] dark:text-[#EDF4FF] pt-1">
                      {mType}
                    </div>

                    {weekDays.map((w) => {
                      const meal = plannedMeals.find(
                        (m) => m.date === w.dateStr && m.mealType === mType
                      );
                      const isSelected = selectedMeal?.id === meal?.id;

                      return (
                        <div key={w.dateStr} className="col-span-1 px-1">
                          {meal ? (
                            <div
                              onClick={() => setSelectedMealId(meal.id)}
                              className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-[#087F83] bg-teal-50/50 dark:bg-teal-950/20'
                                  : 'border-slate-200 dark:border-slate-700 hover:border-[#087F83] bg-slate-50 dark:bg-slate-800/60'
                              }`}
                            >
                              <div className="font-semibold text-[11px] text-[#071A3A] dark:text-[#EDF4FF] truncate">
                                {meal.recipeTitle}
                              </div>
                              <div className="text-[10px] text-[#526782] mt-0.5">
                                {meal.plannedTime || ''} · {meal.plannedServings}s
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => openPlanMealModalFor(w.dateStr, mType)}
                              className="w-full py-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 hover:text-[#087F83] hover:border-[#087F83] text-[10px] font-medium flex items-center justify-center transition-colors cursor-pointer"
                            >
                              + Add
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Planned Meal Details (4 cols) */}
            <div className="lg:col-span-4 bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-5">
              {selectedMeal ? (
                <>
                  <div className="flex items-start justify-between pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D4A]">
                    <div>
                      <h3 className="text-base font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                        {selectedMeal.recipeTitle}
                      </h3>
                      <p className="text-xs text-[#526782] mt-0.5">
                        Planned for {selectedMeal.date} at {selectedMeal.plannedTime || '19:00'}
                      </p>
                    </div>

                    <button
                      onClick={() => deletePlannedMeal(selectedMeal.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600"
                      title="Remove planned meal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-[#087F83] dark:text-[#38D0C5] font-semibold">
                      {selectedMeal.plannedServings} servings
                    </span>
                    <span className="text-[#526782]">
                      Base recipe: {selectedMeal.baseServings} servings
                    </span>
                  </div>

                  {/* Scaled Ingredients List (Section 6 Fixture) */}
                  <div>
                    <h4 className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF] uppercase tracking-wider mb-2">
                      Ingredients needed ({selectedMeal.plannedServings} servings)
                    </h4>

                    <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {selectedMeal.ingredientsSnapshot.map((ing, idx) => {
                        const ratio =
                          selectedMeal.baseServings > 0
                            ? selectedMeal.plannedServings / selectedMeal.baseServings
                            : 1;
                        const scaledAmount = Math.round(ing.amount * ratio * 10) / 10;

                        return (
                          <div key={idx} className="py-2 flex justify-between items-center">
                            <span className="text-[#071A3A] dark:text-[#EDF4FF]">
                              {ing.name}
                            </span>
                            <span className="font-mono font-semibold text-[#526782]">
                              {scaledAmount} {ing.unit}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-2">
                    <button
                      onClick={() => toggleMealConsumed(selectedMeal.id)}
                      className={`w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                        selectedMeal.isConsumed
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-[#087F83] text-white hover:bg-[#06676A]'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      <span>{selectedMeal.isConsumed ? 'Consumed' : 'Mark as consumed'}</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-xs text-[#526782]">
                  Select a planned meal to view ingredients and details.
                </div>
              )}
            </div>
          </div>

          {/* Generate Grocery List Action Banner (Board 13) */}
          <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-[#087F83] flex items-center justify-center">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                  Generate your grocery list for this week
                </h4>
                <p className="text-xs text-[#526782]">
                  Combine scaled ingredients from all planned meals into a grouped shopping list.
                </p>
              </div>
            </div>

            <button
              onClick={handleGenerateGroceries}
              className="px-5 py-2.5 rounded-xl bg-[#087F83] hover:bg-[#06676A] dark:bg-[#38D0C5] dark:hover:bg-[#2BB5AB] text-white dark:text-[#071A3A] font-semibold text-xs shadow-xs cursor-pointer whitespace-nowrap"
            >
              Generate grocery list
            </button>
          </div>
        </div>
      )}

      {/* Food Library Tab (Board 23) */}
      {activeTab === 'food_library' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                    {recipe.title}
                  </h3>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-teal-50 dark:bg-teal-950/60 text-[#087F83] dark:text-[#38D0C5] mt-1 inline-block">
                    {recipe.category}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingRecipe(recipe);
                      setRecTitle(recipe.title);
                      setRecCategory(recipe.category);
                      setRecBaseServings(recipe.baseServings);
                      setRecPrepMins(recipe.prepTimeMinutes);
                      setRecCookMins(recipe.cookTimeMinutes);
                      setRecInstructions(recipe.instructions || '');
                      setRecIngredients([...recipe.ingredients]);
                      setIsRecipeModalOpen(true);
                    }}
                    className="p-1 rounded-md text-[#526782] hover:bg-slate-100"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteRecipe(recipe.id)}
                    className="p-1 rounded-md text-rose-500 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-[#526782]">
                <span>{recipe.baseServings} servings</span>
                <span>{recipe.prepTimeMinutes + recipe.cookTimeMinutes} mins</span>
              </div>

              {/* Ingredients preview */}
              <div className="text-xs space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="font-semibold text-[#071A3A] dark:text-[#EDF4FF] block text-[11px]">
                  Ingredients ({recipe.ingredients.length}):
                </span>
                {recipe.ingredients.map((ing, i) => (
                  <div key={i} className="flex justify-between text-[#526782]">
                    <span>{ing.name}</span>
                    <span className="font-mono">
                      {ing.amount} {ing.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Plan Meal Modal */}
      <Modal
        isOpen={isPlanMealModalOpen}
        onClose={() => setIsPlanMealModalOpen(false)}
        title="Plan a meal"
        subtitle="Schedule a recipe from your food library"
      >
        <form onSubmit={handleSavePlannedMeal} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
              Select Recipe
            </label>
            <select
              value={planRecipeId}
              onChange={(e) => setPlanRecipeId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium"
            >
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title} ({r.baseServings} base servings)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Meal type
              </label>
              <select
                value={planMealType}
                onChange={(e) => setPlanMealType(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium capitalize"
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snack</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Planned servings (scales recipe)
              </label>
              <input
                type="number"
                min="1"
                required
                value={planServings}
                onChange={(e) => setPlanServings(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Date
              </label>
              <input
                type="date"
                required
                value={planDate}
                onChange={(e) => setPlanDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Time
              </label>
              <input
                type="time"
                value={planTime}
                onChange={(e) => setPlanTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsPlanMealModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#526782]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A]"
            >
              Save meal
            </button>
          </div>
        </form>
      </Modal>

      {/* Recipe Create/Edit Modal */}
      <Modal
        isOpen={isRecipeModalOpen}
        onClose={() => setIsRecipeModalOpen(false)}
        title={editingRecipe ? 'Edit recipe' : 'New recipe'}
        subtitle="Manage recipe details, base servings and ingredients"
      >
        <form onSubmit={handleSaveRecipe} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
              Recipe title *
            </label>
            <input
              type="text"
              required
              value={recTitle}
              onChange={(e) => setRecTitle(e.target.value)}
              placeholder="e.g. Rice bowl, Lentil soup"
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Category
              </label>
              <select
                value={recCategory}
                onChange={(e) => setRecCategory(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium"
              >
                <option value="Vegetarian">Vegetarian</option>
                <option value="Main dish">Main dish</option>
                <option value="Quick">Quick</option>
                <option value="Baking">Baking</option>
                <option value="Salad">Salad</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Base servings
              </label>
              <input
                type="number"
                min="1"
                required
                value={recBaseServings}
                onChange={(e) => setRecBaseServings(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Prep mins
              </label>
              <input
                type="number"
                min="0"
                value={recPrepMins}
                onChange={(e) => setRecPrepMins(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono"
              />
            </div>
          </div>

          {/* Ingredients list editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF]">
                Ingredients
              </label>
              <button
                type="button"
                onClick={() =>
                  setRecIngredients([...recIngredients, { name: '', amount: 100, unit: 'g' }])
                }
                className="text-xs font-semibold text-[#087F83] dark:text-[#38D0C5] hover:underline"
              >
                + Add ingredient
              </button>
            </div>

            <div className="space-y-2">
              {recIngredients.map((ing, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Name (e.g. Rice)"
                    value={ing.name}
                    onChange={(e) => {
                      const updated = [...recIngredients];
                      updated[i].name = e.target.value;
                      setRecIngredients(updated);
                    }}
                    className="flex-2 px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
                  />
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="Amount"
                    value={ing.amount}
                    onChange={(e) => {
                      const updated = [...recIngredients];
                      updated[i].amount = parseFloat(e.target.value) || 0;
                      setRecIngredients(updated);
                    }}
                    className="w-20 px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono"
                  />
                  <select
                    value={ing.unit}
                    onChange={(e) => {
                      const updated = [...recIngredients];
                      updated[i].unit = e.target.value;
                      setRecIngredients(updated);
                    }}
                    className="w-20 px-2 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium"
                  >
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="ml">ml</option>
                    <option value="L">L</option>
                    <option value="count">count</option>
                    <option value="pcs">pcs</option>
                    <option value="cups">cups</option>
                    <option value="bottle">bottle</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsRecipeModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#526782]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A]"
            >
              Save recipe
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
