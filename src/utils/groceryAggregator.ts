import { GroceryItem, PlannedMeal } from '../types/planner';

export type GroceryCategory =
  | 'Produce'
  | 'Pantry'
  | 'Chilled'
  | 'Household'
  | 'Bakery'
  | 'Other';

export type MeasurementDimension =
  | 'mass:metric'
  | 'mass:imperial'
  | 'volume:metric'
  | 'volume:cup'
  | 'volume:tbsp'
  | 'volume:tsp'
  | 'volume:fl_oz'
  | 'volume:pint'
  | 'volume:quart'
  | 'volume:gallon'
  | 'count'
  | `unit:${string}`;

export interface NormalizedUnitInfo {
  dimension: MeasurementDimension;
  normalizedAmount: number;
  baseUnit: string;
  originalUnit: string;
}

/**
 * Normalizes an ingredient name for grouping (trimmed, collapsed whitespace, lowercase).
 */
export function normalizeIngredientKey(name: string): string {
  return String(name ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Formats an ingredient display name (trimmed, collapsed internal whitespace).
 */
export function formatIngredientDisplayName(name: string): string {
  return String(name ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Rounds a quantity to at most `decimals` decimal places to eliminate floating-point noise.
 */
export function roundQuantity(value: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Infers a grocery aisle/category from a normalized ingredient key.
 */
export function inferGroceryCategory(normalizedName: string): GroceryCategory {
  const n = normalizedName.toLowerCase();
  if (
    n.includes('pepper') ||
    n.includes('spinach') ||
    n.includes('lemon') ||
    n.includes('broccoli') ||
    n.includes('onion') ||
    n.includes('garlic') ||
    n.includes('tomato') ||
    n.includes('lettuce') ||
    n.includes('avocado') ||
    n.includes('carrot') ||
    n.includes('cucumber') ||
    n.includes('potato') ||
    n.includes('apple') ||
    n.includes('banana') ||
    n.includes('berry') ||
    n.includes('berries') ||
    n.includes('herb') ||
    n.includes('cilantro') ||
    n.includes('parsley') ||
    n.includes('basil')
  ) {
    return 'Produce';
  }
  if (
    n.includes('milk') ||
    n.includes('yogurt') ||
    n.includes('cheese') ||
    n.includes('butter') ||
    n.includes('cream') ||
    n.includes('egg') ||
    n.includes('chicken') ||
    n.includes('salmon') ||
    n.includes('beef') ||
    n.includes('pork') ||
    n.includes('tofu') ||
    n.includes('fish')
  ) {
    return 'Chilled';
  }
  if (
    n.includes('bread') ||
    n.includes('bagel') ||
    n.includes('tortilla') ||
    n.includes('croissant') ||
    n.includes('bun') ||
    n.includes('roll') ||
    n.includes('pita')
  ) {
    return 'Bakery';
  }
  return 'Pantry';
}

const CONTAINER_SINGULAR_MAP: Record<string, string> = {
  bottle: 'bottle',
  bottles: 'bottle',
  can: 'can',
  cans: 'can',
  tin: 'can',
  tins: 'can',
  jar: 'jar',
  jars: 'jar',
  pack: 'pack',
  packs: 'pack',
  package: 'pack',
  packages: 'pack',
  pkt: 'pack',
  bag: 'bag',
  bags: 'bag',
  box: 'box',
  boxes: 'box',
  bunch: 'bunch',
  bunches: 'bunch',
  clove: 'clove',
  cloves: 'clove',
  slice: 'slice',
  slices: 'slice',
  pinch: 'pinch',
  pinches: 'pinch',
  stalk: 'stalk',
  stalks: 'stalk',
  sprig: 'sprig',
  sprigs: 'sprig',
  head: 'head',
  heads: 'head',
  loaf: 'loaf',
  loaves: 'loaf',
};

/**
 * Classifies a unit string into its physical measurement dimension and converts
 * the scaled amount to that dimension's canonical base unit.
 *
 * Compatible units within the same measurement dimension are normalized together
 * (e.g., `g` and `kg` -> `mass:metric` in `g`; `ml` and `L` -> `volume:metric` in `ml`;
 * `cup` and `cups` -> `volume:cup`).
 * Incompatible dimensions (such as mass `g` vs culinary volume `cup`, or `ml` vs `bottle`)
 * receive distinct `dimension` keys so they are never erroneously summed together.
 */
export function classifyAndNormalizeUnit(
  rawUnit: string,
  scaledAmount: number
): NormalizedUnitInfo {
  const trimmed = String(rawUnit ?? '').trim();
  const lower = trimmed.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');

  // 1. Metric Mass (mg, g, kg) -> base 'g'
  if (lower === 'mg' || lower === 'milligram' || lower === 'milligrams') {
    return {
      dimension: 'mass:metric',
      normalizedAmount: scaledAmount * 0.001,
      baseUnit: 'g',
      originalUnit: trimmed || 'mg',
    };
  }
  if (lower === 'g' || lower === 'gm' || lower === 'gram' || lower === 'grams') {
    return {
      dimension: 'mass:metric',
      normalizedAmount: scaledAmount,
      baseUnit: 'g',
      originalUnit: 'g',
    };
  }
  if (
    lower === 'kg' ||
    lower === 'kilo' ||
    lower === 'kilos' ||
    lower === 'kilogram' ||
    lower === 'kilograms'
  ) {
    return {
      dimension: 'mass:metric',
      normalizedAmount: scaledAmount * 1000,
      baseUnit: 'g',
      originalUnit: 'kg',
    };
  }

  // 2. Imperial Mass (oz, lb) -> base 'oz'
  if (lower === 'oz' || lower === 'ounce' || lower === 'ounces') {
    return {
      dimension: 'mass:imperial',
      normalizedAmount: scaledAmount,
      baseUnit: 'oz',
      originalUnit: 'oz',
    };
  }
  if (lower === 'lb' || lower === 'lbs' || lower === 'pound' || lower === 'pounds') {
    return {
      dimension: 'mass:imperial',
      normalizedAmount: scaledAmount * 16,
      baseUnit: 'oz',
      originalUnit: 'lb',
    };
  }

  // 3. Metric Volume (ml, cl, dl, L) -> base 'ml'
  if (
    lower === 'ml' ||
    lower === 'milliliter' ||
    lower === 'milliliters' ||
    lower === 'millilitre' ||
    lower === 'millilitres'
  ) {
    return {
      dimension: 'volume:metric',
      normalizedAmount: scaledAmount,
      baseUnit: 'ml',
      originalUnit: 'ml',
    };
  }
  if (lower === 'cl' || lower === 'centiliter' || lower === 'centiliters') {
    return {
      dimension: 'volume:metric',
      normalizedAmount: scaledAmount * 10,
      baseUnit: 'ml',
      originalUnit: 'ml',
    };
  }
  if (lower === 'dl' || lower === 'deciliter' || lower === 'deciliters') {
    return {
      dimension: 'volume:metric',
      normalizedAmount: scaledAmount * 100,
      baseUnit: 'ml',
      originalUnit: 'ml',
    };
  }
  if (
    lower === 'l' ||
    lower === 'liter' ||
    lower === 'liters' ||
    lower === 'litre' ||
    lower === 'litres'
  ) {
    return {
      dimension: 'volume:metric',
      normalizedAmount: scaledAmount * 1000,
      baseUnit: 'ml',
      originalUnit: 'L',
    };
  }

  // 4. Culinary Volume (cup/cups, tbsp, tsp, fl oz, pint, quart, gallon)
  if (lower === 'cup' || lower === 'cups') {
    return {
      dimension: 'volume:cup',
      normalizedAmount: scaledAmount,
      baseUnit: 'cup',
      originalUnit: trimmed,
    };
  }
  if (
    lower === 'tbsp' ||
    lower === 'tbs' ||
    lower === 'tablespoon' ||
    lower === 'tablespoons'
  ) {
    return {
      dimension: 'volume:tbsp',
      normalizedAmount: scaledAmount,
      baseUnit: 'tbsp',
      originalUnit: 'tbsp',
    };
  }
  if (lower === 'tsp' || lower === 'teaspoon' || lower === 'teaspoons') {
    return {
      dimension: 'volume:tsp',
      normalizedAmount: scaledAmount,
      baseUnit: 'tsp',
      originalUnit: 'tsp',
    };
  }
  if (
    lower === 'fl oz' ||
    lower === 'floz' ||
    lower === 'fluid ounce' ||
    lower === 'fluid ounces'
  ) {
    return {
      dimension: 'volume:fl_oz',
      normalizedAmount: scaledAmount,
      baseUnit: 'fl oz',
      originalUnit: 'fl oz',
    };
  }
  if (lower === 'pt' || lower === 'pint' || lower === 'pints') {
    return {
      dimension: 'volume:pint',
      normalizedAmount: scaledAmount,
      baseUnit: 'pint',
      originalUnit: trimmed,
    };
  }
  if (lower === 'qt' || lower === 'quart' || lower === 'quarts') {
    return {
      dimension: 'volume:quart',
      normalizedAmount: scaledAmount,
      baseUnit: 'quart',
      originalUnit: trimmed,
    };
  }
  if (lower === 'gal' || lower === 'gallon' || lower === 'gallons') {
    return {
      dimension: 'volume:gallon',
      normalizedAmount: scaledAmount,
      baseUnit: 'gallon',
      originalUnit: trimmed,
    };
  }

  // 5. Discrete Count (count, pcs, piece, pieces, item, items, whole)
  if (
    lower === 'count' ||
    lower === 'pcs' ||
    lower === 'pc' ||
    lower === 'piece' ||
    lower === 'pieces' ||
    lower === 'item' ||
    lower === 'items' ||
    lower === 'whole' ||
    lower === ''
  ) {
    return {
      dimension: 'count',
      normalizedAmount: scaledAmount,
      baseUnit: trimmed || 'pcs',
      originalUnit: trimmed || 'pcs',
    };
  }

  // 6. Container or Custom Units (bottle, can, clove, slice, bunch, pack, etc.)
  const canonicalContainer = CONTAINER_SINGULAR_MAP[lower];
  if (canonicalContainer) {
    return {
      dimension: `unit:${canonicalContainer}`,
      normalizedAmount: scaledAmount,
      baseUnit: canonicalContainer,
      originalUnit: trimmed,
    };
  }

  return {
    dimension: `unit:${lower}`,
    normalizedAmount: scaledAmount,
    baseUnit: trimmed,
    originalUnit: trimmed,
  };
}

/**
 * Formats the final aggregated amount and display unit for a bucket.
 */
function finalizeAggregatedUnitAndAmount(bucket: {
  dimension: MeasurementDimension;
  totalNormalized: number;
  baseUnit: string;
  seenUnits: string[];
}): { amount: number; unit: string } {
  const { dimension, totalNormalized, seenUnits } = bucket;

  if (dimension === 'mass:metric') {
    if (totalNormalized >= 1000) {
      return {
        amount: roundQuantity(totalNormalized / 1000, 2),
        unit: 'kg',
      };
    }
    return {
      amount: roundQuantity(totalNormalized, 2),
      unit: 'g',
    };
  }

  if (dimension === 'mass:imperial') {
    const usedLb = seenUnits.some((u) => /^lbs?$|^pounds?$/i.test(u.trim()));
    if (totalNormalized >= 16 && (usedLb || totalNormalized % 16 === 0)) {
      return {
        amount: roundQuantity(totalNormalized / 16, 2),
        unit: 'lb',
      };
    }
    return {
      amount: roundQuantity(totalNormalized, 2),
      unit: 'oz',
    };
  }

  if (dimension === 'volume:metric') {
    if (totalNormalized >= 1000) {
      return {
        amount: roundQuantity(totalNormalized / 1000, 2),
        unit: 'L',
      };
    }
    return {
      amount: roundQuantity(totalNormalized, 2),
      unit: 'ml',
    };
  }

  if (dimension === 'volume:cup') {
    const amount = roundQuantity(totalNormalized, 2);
    // If all inputs used the exact same unit string (e.g. 'cup' or 'cups') and only one entry or matching plurality, preserve it;
    // if multiple entries combined to > 1, use 'cups' if 'cups' was seen or if combining multiple cup entries.
    const uniqueLower = Array.from(new Set(seenUnits.map((u) => u.toLowerCase())));
    if (uniqueLower.length === 1 && seenUnits.length === 1) {
      return { amount, unit: seenUnits[0] };
    }
    return {
      amount,
      unit: amount === 1 ? 'cup' : 'cups',
    };
  }

  const amount = roundQuantity(totalNormalized, 2);
  return {
    amount,
    unit: seenUnits[0] || bucket.baseUnit,
  };
}

export interface AggregateGroceriesInput {
  weekMeals: PlannedMeal[];
  existingGroceries?: GroceryItem[];
  idGenerator?: () => string;
}

/**
 * Aggregates ingredients across planned meals by `(normalizedIngredientName, measurementDimension)`.
 *
 * - Compatible units in the same physical dimension (`g` + `kg`, `ml` + `L`, `oz` + `lb`, `cup` + `cups`, `count` + `pcs`)
 *   are converted and summed cleanly.
 * - Incompatible measurement dimensions (such as `Rice: 200 g` and `Rice: 1 cup`) are kept as separate
 *   grocery list items unless an explicit conversion is defined, preventing erroneous sums like `201 g`.
 * - Preserves `isPurchased` state for unchanged generated items and retains manual grocery items intact.
 */
export function aggregateGroceriesFromMeals({
  weekMeals,
  existingGroceries = [],
  idGenerator = () =>
    `gro-gen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
}: AggregateGroceriesInput): GroceryItem[] {
  interface AggregatedBucket {
    ingredientKey: string;
    displayName: string;
    dimension: MeasurementDimension;
    totalNormalized: number;
    baseUnit: string;
    seenUnits: string[];
    category: GroceryCategory;
    mealCount: number;
    sourceMealIds: Set<string>;
    sourceMealTitles: string[];
  }

  const buckets = new Map<string, AggregatedBucket>();

  for (const meal of weekMeals) {
    if (!meal.ingredientsSnapshot || meal.ingredientsSnapshot.length === 0) {
      continue;
    }
    const ratio =
      meal.baseServings && meal.baseServings > 0
        ? meal.plannedServings / meal.baseServings
        : 1;
    const mealTitle = meal.recipeTitle || 'Planned meal';

    for (const ing of meal.ingredientsSnapshot) {
      const ingredientKey = normalizeIngredientKey(ing.name);
      if (!ingredientKey || !(ing.amount > 0)) continue;

      const scaledAmt = ing.amount * ratio;
      const unitInfo = classifyAndNormalizeUnit(ing.unit, scaledAmt);
      const compositeKey = `${ingredientKey}::${unitInfo.dimension}`;

      const existingBucket = buckets.get(compositeKey);
      if (!existingBucket) {
        const mealIds = new Set<string>();
        if (meal.id) mealIds.add(meal.id);
        buckets.set(compositeKey, {
          ingredientKey,
          displayName: formatIngredientDisplayName(ing.name),
          dimension: unitInfo.dimension,
          totalNormalized: unitInfo.normalizedAmount,
          baseUnit: unitInfo.baseUnit,
          seenUnits: [unitInfo.originalUnit],
          category: inferGroceryCategory(ingredientKey),
          mealCount: 1,
          sourceMealIds: mealIds,
          sourceMealTitles: [mealTitle],
        });
      } else {
        existingBucket.totalNormalized += unitInfo.normalizedAmount;
        existingBucket.seenUnits.push(unitInfo.originalUnit);
        if (meal.id) {
          if (!existingBucket.sourceMealIds.has(meal.id)) {
            existingBucket.sourceMealIds.add(meal.id);
            existingBucket.mealCount += 1;
          }
        } else {
          existingBucket.mealCount += 1;
        }
        if (!existingBucket.sourceMealTitles.includes(mealTitle)) {
          existingBucket.sourceMealTitles.push(mealTitle);
        }
      }
    }
  }

  const manualExtras = existingGroceries.filter((g) => g.sourceType === 'manual');

  const newGenerated: GroceryItem[] = Array.from(buckets.values()).map((bucket) => {
    const { amount: finalAmt, unit: finalUnit } =
      finalizeAggregatedUnitAndAmount(bucket);

    // Preserve purchased state if a generated item with the same ingredient, unit, and amount was already checked
    const existing = existingGroceries.find(
      (g) =>
        g.sourceType === 'generated' &&
        normalizeIngredientKey(g.name) === bucket.ingredientKey &&
        classifyAndNormalizeUnit(g.unit, g.amount).dimension === bucket.dimension &&
        g.unit === finalUnit &&
        g.amount === finalAmt
    );

    return {
      id: existing ? existing.id : idGenerator(),
      name: bucket.displayName,
      amount: finalAmt,
      unit: finalUnit,
      category: bucket.category,
      isPurchased: existing ? existing.isPurchased : false,
      sourceType: 'generated',
      sourceMealCount: bucket.mealCount,
      sourceMealTitles: bucket.sourceMealTitles,
    };
  });

  return [...newGenerated, ...manualExtras];
}
