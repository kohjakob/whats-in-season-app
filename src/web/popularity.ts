import type { Category } from './categories';

/**
 * One global popularity order for every item, most popular first. Editorial, not measured:
 * roughly what a supermarket shopper in Europe or North America buys most. Drives which produce
 * a fresh chart shows by default and the order inside the picker.
 */
export const POPULARITY: readonly string[] = [
  'tomato', 'apple', 'potato', 'banana', 'onion', 'strawberry', 'carrot', 'orange', 'lettuce', 'grape',
  'cucumber', 'watermelon', 'sweet-pepper', 'peach', 'broccoli', 'blueberry', 'spinach', 'lemon', 'zucchini', 'pear',
  'cabbage', 'mango', 'sweetcorn', 'sweet-cherry', 'green-bean', 'raspberry', 'garlic', 'melon', 'cauliflower', 'plum',
  'peas', 'mandarin', 'kale', 'pineapple', 'aubergine', 'avocado', 'pumpkin', 'apricot', 'asparagus', 'nectarine',
  'beetroot', 'kiwi', 'celery', 'blackberry', 'leek', 'lime', 'radish', 'grapefruit', 'brussels-sprouts', 'pomegranate',
  'red-cabbage', 'fig', 'sweet-potato', 'papaya', 'winter-squash', 'persimmon', 'chili', 'sour-cherry', 'fennel', 'gooseberry',
  'kohlrabi', 'red-currant', 'rocket', 'black-currant', 'chard', 'cranberry', 'turnip', 'quince', 'parsnip', 'artichoke',
  'pak-choi', 'napa-cabbage', 'celeriac', 'endive', 'savoy-cabbage', 'swede', 'spring-onion', 'daikon', 'rhubarb', 'okra',
  'broad-bean', 'lambs-lettuce',
  'basil', 'parsley', 'mint', 'chives', 'coriander', 'dill',
  'almond', 'walnut', 'hazelnut', 'chestnut',
];

const RANK = new Map(POPULARITY.map((id, i) => [id, i]));

/** Position in the global order; unknown ids sort last. */
export function rankOf(id: string): number {
  return RANK.get(id) ?? POPULARITY.length;
}

export function byPopularity(a: { id: string }, b: { id: string }): number {
  return rankOf(a.id) - rankOf(b.id) || a.id.localeCompare(b.id);
}

export const DEFAULT_CATEGORIES: readonly Category[] = ['fruit', 'vegetable'];
export const DEFAULT_PER_CATEGORY = 10;

/**
 * What a fresh chart shows: the most popular produce that actually grow at the location, a fixed
 * number per default category. Herbs and nuts start unchecked.
 */
export function defaultSelection(
  presentIds: Iterable<string>,
  categoryOf: (id: string) => Category,
  perCategory = DEFAULT_PER_CATEGORY,
  categories: readonly Category[] = DEFAULT_CATEGORIES,
): Set<string> {
  const ids = [...presentIds].sort((a, b) => rankOf(a) - rankOf(b));
  const out = new Set<string>();
  for (const cat of categories) {
    let n = 0;
    for (const id of ids) {
      if (n >= perCategory) break;
      if (categoryOf(id) === cat) {
        out.add(id);
        n++;
      }
    }
  }
  return out;
}
