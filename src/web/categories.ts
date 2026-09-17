/** Fixed palette order for categories. Kept free of the virtual produce bundle so Node scripts can import it. */
export const CATEGORIES = ['vegetable', 'fruit', 'herb', 'nut'] as const;
export type Category = (typeof CATEGORIES)[number];
