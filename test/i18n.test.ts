import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadProduce } from '../src/produce/load';
import { LANGS, produceName, posterLabels } from '../src/web/i18n';
import { Poster } from '../src/web/Poster';

const produce = loadProduce();

describe('poster translations', () => {
  it('cover every item in every language, non-empty and distinct from the English fallback where expected', () => {
    for (const c of produce) {
      for (const lang of LANGS) {
        const name = produceName(c, lang);
        expect(name.trim().length, `${c.id} ${lang}`).toBeGreaterThan(0);
      }
      // French must not silently fall back to English for common produce
      if (c.id === 'tomato') expect(produceName(c, 'fr')).toBe('Tomates');
      if (c.id === 'apple') expect(produceName(c, 'ja')).toBe('りんご');
      if (c.id === 'apple') expect(produceName(c, 'de')).toBe('Äpfel');
    }
  });

  it('have twelve month labels and all legend terms per language', () => {
    for (const lang of LANGS) {
      const l = posterLabels(lang);
      expect(l.months).toHaveLength(12);
      for (const v of [...Object.values(l.level), ...Object.values(l.category)]) expect(v.length).toBeGreaterThan(0);
    }
    expect(posterLabels('de').months[2]).toBe('MÄR');
    expect(posterLabels('ru').category.fruit).toBe('фрукты');
  });

  it('render into the poster', () => {
    const svg = renderToStaticMarkup(
      createElement(Poster, {
        rows: [{ produceId: 'tomato', name: 'Tomaten', category: 'vegetable', spans: [{ level: 'peak', from: 30, to: 38 }] }],
        categoryOf: () => 'vegetable' as const,
        place: 'Wien, Österreich',
        showStorage: false,
        labels: posterLabels('de'),
      }),
    );
    expect(svg).not.toMatch(/in season|Was hat Saison/);
    expect(svg).toContain('Tomaten');
    expect(svg).toContain('>OKT<');
    expect(svg).toContain('>Gemüse<');
  });
});
