import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { A4, MAX_AMPLITUDE, PLACE_GAP, PLACE_MAX, PLACE_MIN, Poster, X0, estimateTextWidth, fitPlace, labelWeek, rowGeometry, weekCenterFraction } from '../src/web/Poster';
import type { ChartRow } from '../src/engine/types';

const row = (id: string, name: string, from: number, to: number): ChartRow => ({
  produceId: id,
  name,
  category: 'vegetable',
  spans: [{ level: 'peak', from, to }, { level: 'stored', from: to + 1, to: Math.min(51, to + 8) }],
});
const rows = [row('tomato', 'Tomatoes', 30, 38), row('kale', 'Kale', 40, 51)];
const props = {
  rows,
  categoryOf: () => 'vegetable' as const,
  place: 'Berlin, Germany',
  showStorage: false,
};

describe('Poster', () => {
  const svg = renderToStaticMarkup(createElement(Poster, props));

  it('is a standalone A4 SVG with inline styling only', () => {
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain('width="210mm"');
    expect(svg).toContain('height="297mm"');
    expect(svg).toContain(`viewBox="0 0 ${A4.w} ${A4.h}"`);
    expect(svg).not.toContain('class=');
    expect(svg).not.toContain('var(--');
    expect(svg).not.toMatch(/system-ui|sans-serif/);
  });

  it('labels every row, names the place, and carries no facts or credit line', () => {
    for (const s of ['Tomatoes', 'Kale', 'Berlin, Germany', 'JAN', 'DEC']) expect(svg).toContain(s);
    expect(svg).not.toMatch(/Frost-free|Computed from/);
  });

  it('anchors each label left of its peak, not its earlier available shoulder', () => {
    const early: ChartRow = {
      produceId: 'x',
      name: 'Xproduce',
      category: 'vegetable',
      spans: [{ level: 'available', from: 10, to: 19 }, { level: 'peak', from: 20, to: 30 }],
    };
    expect(labelWeek(early)).toBe(20);
    expect(labelWeek({ ...early, spans: [{ level: 'available', from: 10, to: 19 }] })).toBe(10);
    // a season wrapping the year is labelled at its first peak after January, never the January piece
    const wrap: ChartRow = { ...early, spans: [{ level: 'peak', from: 0, to: 12 }, { level: 'peak', from: 40, to: 51 }] };
    expect(labelWeek(wrap)).toBe(40);
    expect(labelWeek({ ...early, spans: [{ level: 'peak', from: 0, to: 51 }] })).toBe(0);
  });

  it('masks the rows that reach either sheet edge, as one group each', () => {
    const wrapRow: ChartRow = { produceId: 'kale', name: 'Kale', category: 'vegetable', spans: [{ level: 'peak', from: 44, to: 51 }, { level: 'peak', from: 0, to: 8 }] };
    const lateRow: ChartRow = { produceId: 'leek', name: 'Leeks', category: 'vegetable', spans: [{ level: 'peak', from: 40, to: 51 }] };
    const out = renderToStaticMarkup(createElement(Poster, { ...props, rows: [wrapRow, lateRow, ...rows] }));
    // wrapRow, lateRow and the fixture's Kale row (weeks 40 to 51) reach an edge; Tomatoes (30 to 38) does not
    expect(out.match(/mask="url\(#edge-fade\)"/g)?.length).toBe(3);
    expect(out).toContain('<mask id="edge-fade"');
  });

  it('can drop the available layer and its legend entry', () => {
    const peakOnly = renderToStaticMarkup(createElement(Poster, { ...props, showAvailable: false }));
    expect(peakOnly).not.toContain('>available<');
    expect(peakOnly).toContain('>peak<');
    expect(svg).toContain('>available<');
  });

  it('hides storage unless asked', () => {
    expect(svg).not.toContain('from storage');
    const withStorage = renderToStaticMarkup(createElement(Poster, { ...props, showStorage: true }));
    expect(withStorage).toContain('from storage');
  });
});

describe('rowGeometry', () => {
  it('always fills the row area: wider pitch for fewer rows, bump height capped, 92 rows still fit', () => {
    expect(rowGeometry(5).pitch).toBeGreaterThan(rowGeometry(20).pitch);
    expect(rowGeometry(20).pitch).toBeGreaterThan(rowGeometry(92).pitch);
    expect(rowGeometry(5).amplitude).toBe(MAX_AMPLITUDE);
    expect(rowGeometry(5).fontSize).toBe(16);
    for (const n of [5, 20, 92]) {
      const g = rowGeometry(n);
      const lastBaseline = 242 + g.amplitude + n * g.pitch;
      expect(lastBaseline, `${n} rows`).toBeLessThan(A4.h - 78 - 18);
      expect(g.fontSize).toBeGreaterThanOrEqual(7.5);
    }
  });
});

describe('weekCenterFraction', () => {
  it('grows with the week and stays inside the page', () => {
    expect(weekCenterFraction(0)).toBeGreaterThan(0.08);
    expect(weekCenterFraction(51)).toBeLessThan(0.99);
    expect(weekCenterFraction(26)).toBeGreaterThan(weekCenterFraction(10));
  });
});

describe('place name fit', () => {
  const legendLeft = 600;

  it('keeps short names at full size', () => {
    expect(fitPlace(estimateTextWidth('Vienna, Austria', PLACE_MAX), legendLeft)).toEqual({ fontSize: PLACE_MAX });
  });

  it('shrinks long names so they end at least PLACE_GAP before the legend', () => {
    const natural = estimateTextWidth('Villa Carlos Paz, Provincia de Córdoba, Argentina', PLACE_MAX);
    const fit = fitPlace(natural, legendLeft);
    expect(fit.fontSize).toBeLessThan(PLACE_MAX);
    expect(fit.fontSize).toBeGreaterThanOrEqual(PLACE_MIN);
    expect(fit.textLength).toBeUndefined();
    const rightEdge = X0 + (natural * fit.fontSize) / PLACE_MAX;
    expect(rightEdge).toBeLessThanOrEqual(legendLeft - PLACE_GAP);
  });

  it('compresses glyphs only when the minimum size still does not fit', () => {
    const fit = fitPlace(5000, legendLeft);
    expect(fit.fontSize).toBe(PLACE_MIN);
    expect(fit.textLength).toBeGreaterThan(0);
  });

  it('renders a long name smaller than the default in the static SVG', () => {
    const svg = renderToStaticMarkup(
      createElement(Poster, { ...props, place: 'Llanfairpwllgwyngyll, Isle of Anglesey, United Kingdom of Great Britain and Northern Ireland' }),
    );
    const size = Number(/font-size="([\d.]+)" font-weight="600"/.exec(svg)?.[1]);
    expect(size).toBeLessThan(PLACE_MAX);
    expect(renderToStaticMarkup(createElement(Poster, props))).toContain(`font-size="${PLACE_MAX}" font-weight="600"`);
  });
});
