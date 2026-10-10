import React, { useState, useMemo } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { getWeekDaysForDate, getWeekStartDate } from '../../utils/formatters';
import { RingProgress } from '../ui/RingProgress';
import { Modal } from '../ui/Modal';
import {
  ShoppingCart,
  Plus,
  RefreshCw,
  Check,
  RotateCcw,
  Trash2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { GroceryItem } from '../../types/planner';

export const GroceriesView: React.FC = () => {
  const {
    settings,
    currentDate,
    groceries,
    plannedMeals,
    toggleGroceryPurchased,
    addGroceryItem,
    updateGroceryItem,
    deleteGroceryItem,
    resetGroceryCheckmarks,
    regenerateGroceries,
  } = usePlanner();

  // Dynamic current week range calculation based on settings.weekStartsOn
  const currentWeekMondayStr = useMemo(() => {
    return getWeekStartDate(currentDate, settings.weekStartsOn);
  }, [currentDate, settings.weekStartsOn]);

  const weekRangeLabel = useMemo(() => {
    const list = getWeekDaysForDate(currentDate, settings.weekStartsOn);
    const start = list[0];
    const end = list[6];
    return `${start.dayName}, ${start.dayNum} ${start.monthName} – ${end.dayName}, ${end.dayNum} ${end.monthName}`;
  }, [currentDate, settings.weekStartsOn]);

  // Selected item for detail inspection & editing
  const [selectedItem, setSelectedItem] = useState<GroceryItem | null>(null);
  const [editAmount, setEditAmount] = useState<number>(1);
  const [editUnit, setEditUnit] = useState<string>('');
  const [editCategory, setEditCategory] = useState<
    'Produce' | 'Pantry' | 'Chilled' | 'Household' | 'Bakery' | 'Other'
  >('Produce');

  const openItemInspection = (item: GroceryItem) => {
    setSelectedItem(item);
    setEditAmount(item.amount);
    setEditUnit(item.unit);
    setEditCategory(item.category);
  };

  const handleSaveItemChanges = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || editAmount <= 0) return;
    updateGroceryItem(selectedItem.id, {
      amount: editAmount,
      unit: editUnit.trim() || selectedItem.unit,
      category: editCategory,
    });
    setSelectedItem(null);
  };

  // Planned meals for current week to check for contributing & missing ingredients
  const currentWeekDatesSet = useMemo(() => {
    const [y, m, d] = currentWeekMondayStr.split('-').map(Number);
    const set = new Set<string>();
    for (let i = 0; i < 7; i++) {
      const dt = new Date(y, m - 1, d + i);
      set.add(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`);
    }
    return set;
  }, [currentWeekMondayStr]);

  const weekPlannedMeals = useMemo(
    () => plannedMeals.filter((pm) => currentWeekDatesSet.has(pm.date)),
    [plannedMeals, currentWeekDatesSet]
  );

  const mealsWithIngredients = useMemo(
    () => weekPlannedMeals.filter((pm) => pm.ingredientsSnapshot && pm.ingredientsSnapshot.length > 0),
    [weekPlannedMeals]
  );

  const mealsWithoutIngredients = useMemo(
    () => weekPlannedMeals.filter((pm) => !pm.ingredientsSnapshot || pm.ingredientsSnapshot.length === 0),
    [weekPlannedMeals]
  );

  // Add Item Modal (Manual Extra)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemAmount, setItemAmount] = useState<number>(1);
  const [itemUnit, setItemUnit] = useState('pcs');
  const [itemCategory, setItemCategory] = useState<
    'Produce' | 'Pantry' | 'Chilled' | 'Household' | 'Bakery' | 'Other'
  >('Household');

  // Regeneration preview modal
  const [isRegenModalOpen, setIsRegenModalOpen] = useState(false);

  // Metrics
  const totalCount = groceries.length;
  const purchasedCount = groceries.filter((g) => g.isPurchased).length;
  const remainingCount = totalCount - purchasedCount;
  const progressPct =
    totalCount > 0 ? Math.round((purchasedCount / totalCount) * 100) : 0;

  // Group by category
  const categories = ['Produce', 'Pantry', 'Chilled', 'Household', 'Bakery', 'Other'] as const;

  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || itemAmount <= 0) return;
    addGroceryItem({
      name: itemName.trim(),
      amount: itemAmount,
      unit: itemUnit,
      category: itemCategory,
      isPurchased: false,
    });
    setIsAddModalOpen(false);
    setItemName('');
  };

  const handleConfirmRegenerate = () => {
    regenerateGroceries(currentWeekMondayStr);
    setIsRegenModalOpen(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-[#071A3A] dark:text-[#EDF4FF]">
            Groceries — Shopping List
          </h2>
          <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
            {weekRangeLabel}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsRegenModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-[#071A3A] dark:text-[#EDF4FF] cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#087F83]" />
            <span>Regenerate from meals</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#087F83] hover:bg-[#06676A] dark:bg-[#38D0C5] dark:hover:bg-[#2BB5AB] text-white dark:text-[#071A3A] font-semibold text-xs transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add item</span>
          </button>
        </div>
      </div>

      {/* Missing Ingredients Warning Banner */}
      {mealsWithoutIngredients.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3 shadow-2xs">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block text-sm">
              {mealsWithoutIngredients.length} planned meal{mealsWithoutIngredients.length > 1 ? 's have' : ' has'} no ingredient data and contributed nothing to this list
            </span>
            <p className="text-xs">
              The following meals have empty ingredient lists: <strong>{mealsWithoutIngredients.map((m) => m.recipeTitle).join(', ')}</strong>.
            </p>
            <p className="text-[11px] opacity-90">
              Only meals with recorded ingredients ({mealsWithIngredients.map((m) => m.recipeTitle).join(', ') || 'none'}) contributed to the generated items below.
            </p>
          </div>
        </div>
      )}

      {/* Progress & Totals Bar (Board 14) */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <RingProgress
            progress={progressPct}
            size={56}
            strokeWidth={5}
            color="#087F83"
          >
            <span className="text-xs font-bold font-mono">
              {progressPct}%
            </span>
          </RingProgress>

          <div>
            <div className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              {purchasedCount} of {totalCount} items purchased
            </div>
            <div className="text-xs text-[#526782]">
              Shopping list completion
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 font-mono text-center">
          <div>
            <span className="text-xl font-bold text-emerald-600">
              {purchasedCount}
            </span>
            <div className="text-[11px] text-[#526782]">Purchased</div>
          </div>
          <div>
            <span className="text-xl font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              {remainingCount}
            </span>
            <div className="text-[11px] text-[#526782]">Remaining</div>
          </div>
          <div>
            <span className="text-xl font-bold text-[#526782]">
              {totalCount}
            </span>
            <div className="text-[11px] text-[#526782]">Total</div>
          </div>

          <button
            type="button"
            onClick={resetGroceryCheckmarks}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-[#526782] dark:text-[#A8B8CE] hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer ml-2"
            title="Reset purchased status only"
            aria-label="Reset checkmarks: Reset purchased status only"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset checkmarks</span>
          </button>
        </div>
      </div>

      {/* Grouped Shopping List Matrix (Board 14) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((cat) => {
          const items = groceries.filter((g) => g.category === cat);
          if (items.length === 0) return null;

          const catPurchased = items.filter((i) => i.isPurchased).length;

          return (
            <div
              key={cat}
              className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0] dark:border-[#1E2D4A]">
                <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                  {cat}
                </h3>
                <span className="text-xs text-[#526782] dark:text-[#A8B8CE] font-mono">
                  {catPurchased} of {items.length}
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="py-2.5 flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={item.isPurchased}
                        aria-label={`Mark "${item.name}" as ${item.isPurchased ? 'not purchased' : 'purchased'}`}
                        onClick={() => toggleGroceryPurchased(item.id)}
                        className={`w-5 h-5 rounded-md flex items-center justify-center cursor-pointer transition-colors shrink-0 ${
                          item.isPurchased
                            ? 'bg-[#087F83] text-white'
                            : 'border border-slate-300 dark:border-slate-600 hover:border-[#087F83]'
                        }`}
                      >
                        {item.isPurchased && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>

                      <div className="truncate">
                        <span
                          onClick={() => openItemInspection(item)}
                          className={`text-xs font-semibold cursor-pointer truncate block hover:underline ${
                            item.isPurchased
                              ? 'line-through text-[#526782] dark:text-[#A8B8CE]'
                              : 'text-[#071A3A] dark:text-[#EDF4FF]'
                          }`}
                        >
                          {item.name}
                        </span>
                        {item.sourceType === 'manual' ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 mt-0.5">
                            Manual extra
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-50 dark:bg-teal-950/60 text-[#087F83] dark:text-[#38D0C5] border border-teal-200 dark:border-teal-800/60">
                              Recipe derived
                            </span>
                            {item.sourceMealTitles && item.sourceMealTitles.length > 0 ? (
                              <span className="text-[10px] text-[#526782] dark:text-[#A8B8CE]">
                                From {item.sourceMealTitles.join(', ')}
                              </span>
                            ) : item.sourceMealCount ? (
                              <span className="text-[10px] text-[#526782] dark:text-[#A8B8CE]">
                                From {item.sourceMealCount} meal{item.sourceMealCount > 1 ? 's' : ''}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono font-bold text-[#526782] dark:text-[#A8B8CE]">
                        {item.amount} {item.unit}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteGroceryItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition-opacity cursor-pointer"
                        title="Delete item"
                        aria-label={`Delete grocery item "${item.name}"`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Item Details Inspection Modal (Board 14) */}
      <Modal
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title={selectedItem?.name}
        subtitle={
          selectedItem?.sourceType === 'generated'
            ? 'Recipe derived item'
            : 'Manual extra'
        }
      >
        {selectedItem && (
          <form onSubmit={handleSaveItemChanges} className="space-y-4">
            <div className="flex items-baseline justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800">
              <span className="text-xs text-[#526782] dark:text-[#A8B8CE]">Current list quantity:</span>
              <span className="text-xl font-bold font-mono text-[#087F83] dark:text-[#38D0C5]">
                {selectedItem.amount} {selectedItem.unit}
              </span>
            </div>

            {selectedItem.sourceType === 'generated' ? (
              <div className="p-3.5 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800/60 text-xs text-[#087F83] dark:text-[#38D0C5] space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Recipe derived item</span>
                </div>
                {selectedItem.sourceMealTitles && selectedItem.sourceMealTitles.length > 0 ? (
                  <p className="text-[11px]">
                    Contributed by planned meals: <strong>{selectedItem.sourceMealTitles.join(', ')}</strong>.
                  </p>
                ) : (
                  <p className="text-[11px]">
                    Scaled and combined from your planned meals for this week.
                  </p>
                )}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-700 dark:text-amber-300">
                <span>Manually added item. Survives regeneration intact.</span>
              </div>
            )}

            {/* Editable Fields */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF] block">
                Edit quantity & aisle assignment:
              </span>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="grocery-edit-amount"
                    className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                  >
                    Amount *
                  </label>
                  <input
                    id="grocery-edit-amount"
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={editAmount}
                    onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label
                    htmlFor="grocery-edit-unit"
                    className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                  >
                    Unit
                  </label>
                  <input
                    id="grocery-edit-unit"
                    type="text"
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="grocery-edit-category"
                  className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                >
                  Aisle / Category
                </label>
                <select
                  id="grocery-edit-category"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2 flex justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  deleteGroceryItem(selectedItem.id);
                  setSelectedItem(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold cursor-pointer"
              >
                Remove from list
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A] cursor-pointer shadow-xs"
              >
                Save changes
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Regeneration Review Preview Modal (Board 23, Part 02D) */}
      <Modal
        isOpen={isRegenModalOpen}
        onClose={() => setIsRegenModalOpen(false)}
        title="Update grocery list"
        subtitle={weekRangeLabel}
      >
        <div className="space-y-4 text-xs">
          <p className="text-[#526782] dark:text-[#A8B8CE]">
            Regenerating checks all planned meals for this week, scales ingredients by your planned servings, and merges compatible quantities (e.g. g &amp; kg, ml &amp; L) while keeping incompatible units (e.g. g &amp; cups) separate.
          </p>

          {/* Contributing Meals List */}
          {mealsWithIngredients.length > 0 && (
            <div className="p-3.5 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800/60 space-y-1">
              <span className="font-semibold text-[#087F83] dark:text-[#38D0C5] block">
                Contributing planned meals ({mealsWithIngredients.length}):
              </span>
              <p className="text-[11px] text-[#087F83] dark:text-[#38D0C5]">
                {mealsWithIngredients.map((m) => `${m.recipeTitle} (${m.plannedServings} servings)`).join(', ')}
              </p>
            </div>
          )}

          {/* Warning for meals missing ingredients */}
          {mealsWithoutIngredients.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 space-y-1">
              <span className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Warning: {mealsWithoutIngredients.length} planned meal{mealsWithoutIngredients.length > 1 ? 's' : ''} have no ingredient data</span>
              </span>
              <p className="text-[11px] opacity-90">
                <strong>{mealsWithoutIngredients.map((m) => m.recipeTitle).join(', ')}</strong> will contribute nothing to the grocery list.
              </p>
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 space-y-2">
            <div className="font-semibold text-[#071A3A] dark:text-[#EDF4FF]">
              Regeneration rules applied:
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[#526782] dark:text-[#A8B8CE]">
              <li>Unchanged purchased items stay checked.</li>
              <li>Increased or modified ingredients become unchecked.</li>
              <li>Manually added items (like Dish soap) stay intact.</li>
            </ul>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsRegenModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[#526782] dark:text-[#A8B8CE]"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmRegenerate}
              className="px-4 py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A]"
            >
              Apply update
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Manual Item Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add grocery item"
        subtitle="Add a manual shopping extra"
      >
        <form onSubmit={handleAddManualItem} className="space-y-4">
          <div>
            <label
              htmlFor="grocery-add-name"
              className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
            >
              Item name *
            </label>
            <input
              id="grocery-add-name"
              type="text"
              required
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Dish soap, Paper towels"
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="grocery-add-amount"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                Amount *
              </label>
              <input
                id="grocery-add-amount"
                type="number"
                step="0.1"
                min="0.1"
                required
                value={itemAmount}
                onChange={(e) => setItemAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label
                htmlFor="grocery-add-unit"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                Unit
              </label>
              <input
                id="grocery-add-unit"
                type="text"
                value={itemUnit}
                onChange={(e) => setItemUnit(e.target.value)}
                placeholder="bottle, pcs, g, L"
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="grocery-add-category"
              className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
            >
              Category
            </label>
            <select
              id="grocery-add-category"
              value={itemCategory}
              onChange={(e) => setItemCategory(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#526782]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A]"
            >
              Add to list
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
