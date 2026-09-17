import { forwardRef, useEffect, useRef, useState } from 'react';
import type { ChartRow, Level } from '../engine/types';
import { CATEGORIES, type Category } from './categories';
import { levelHeights, monthStartWeek, MONTHS, ridgePath, touchesEdge, WEEKS } from './ridge';
import type { PosterLabels } from './i18n';

/** A4 portrait at 96 dpi. The SVG carries width/height in mm, so it prints at true size. */
export const A4 = { w: 794, h: 1123 } as const;

/**
 * The JAN and DEC gridlines sit at the same distance from the sheet edges. December's own weeks
 * run on past the DEC line toward the right edge, leaving RIGHT_BREATH there.
 */
const RIGHT_BREATH = 12;
const DEC_START_WEEKS = 334 / 7;
export const CW = (A4.w - 2 * RIGHT_BREATH) / (2 * WEEKS - DEC_START_WEEKS);
export const X0 = A4.w - RIGHT_BREATH - WEEKS * CW;
const M = X0;
const X1 = X0 + WEEKS * CW;
/** Weeks of the previous December drawn left of JAN for wrapping seasons, mirroring December's run past DEC */
const EXTEND_LEFT_WEEKS = WEEKS - DEC_START_WEEKS;
/** Wrapping seasons are fully opaque this far inside the JAN and DEC lines ... */
const FADE_INSIDE = 8;
/** ... and invisible this far outside them */
const FADE_OUTSIDE = 28;
const DEC_X = X0 + DEC_START_WEEKS * CW;
const FADE_X0 = X0 - FADE_OUTSIDE;
const FADE_X1 = DEC_X + FADE_OUTSIDE;
const FADE_RAMP = (FADE_INSIDE + FADE_OUTSIDE) / (FADE_X1 - FADE_X0);
/** Title and place top-left, legend top-right, then the month axis */
const TITLE_Y = 78;
const LEGEND_TOP = 66;
/** Place name size range and the minimum clear space between it and the legend */
export const PLACE_MAX = 34;
export const PLACE_MIN = 16;
export const PLACE_GAP = 32;
const LEGEND_FONT = 11;
const LEGEND_PITCH = 18;
/** Below the header block. Exported so the "this week" overlay can aim at it. */
export const AXIS_TOP_Y = 224;
const ROWS_TOP = AXIS_TOP_Y + 18;
const AXIS_BOTTOM_Y = A4.h - 78;
/** Top of the month labels above the axis; the "this week" arrow stops here */
export const AXIS_LABEL_TOP_Y = AXIS_TOP_Y - 26;
const ROWS_BOTTOM = AXIS_BOTTOM_Y - 18;

/** Printed paper look, independent of the page theme. */
export const PAPER = {
  bg: '#fffdf8',
  text: '#1e1c18',
  text2: '#5c5952',
  text3: '#8a867c',
  grid: '#e3ddce',
  gridStrong: '#c9c2b0',
  /** Okabe and Ito palette: bluish green, reddish purple, blue, orange. Colour-vision safe. */
  cat: { vegetable: '#009e73', fruit: '#cc79a7', herb: '#0072b2', nut: '#e69f00' } as Record<Category, string>,
} as const;

const OPACITY: Record<Level, number> = { peak: 0.92, available: 0.5, stored: 0.22 };
const LEVEL_LABEL: Record<Level, string> = { peak: 'peak', available: 'available', stored: 'from storage' };
const CATEGORY_LABEL: Record<Category, string> = { vegetable: 'vegetables', fruit: 'fruit', herb: 'herbs', nut: 'nuts' };
export const ENGLISH_LABELS: PosterLabels = {
  months: MONTHS.map((m) => m.toUpperCase()),
  level: LEVEL_LABEL,
  category: CATEGORY_LABEL,
};
const SERIF = "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif";

/** Horizontal centre of a week as a share of the poster width, for annotations outside it. */
export function weekCenterFraction(week: number): number {
  return (X0 + (week + 0.5) * CW) / A4.w;
}

/** Tallest bump: rows always spread over the full height, but a handful of produce stays ridge-like */
export const MAX_AMPLITUDE = 56;

/**
 * Row pitch so that the rows always fill the space between the two month axes, whatever their
 * number. Bump height follows the pitch up to a cap; labels scale inside a readable range.
 */
export function rowGeometry(count: number): { pitch: number; amplitude: number; fontSize: number } {
  const pitch = (ROWS_BOTTOM - ROWS_TOP) / (Math.max(count, 1) + 1.2);
  return { pitch, amplitude: Math.min(pitch * 1.1, MAX_AMPLITUDE), fontSize: Math.max(7.5, Math.min(16, pitch * 0.5)) };
}

/**
 * Week the label sits left of: the start of the peak run, so the name reads as a caption of the
 * peak bar. For a season that wraps the year the January piece is last year's run, so the label
 * goes on the first peak after it.
 */
export function labelWeek(row: ChartRow): number | null {
  const peaks = row.spans.filter((s) => s.level === 'peak').sort((a, b) => a.from - b.from);
  if (peaks.length) {
    // a run starting in week 0 is last year's season continuing; label the next run instead
    return peaks[0].from === 0 && peaks.length > 1 ? peaks[1].from : peaks[0].from;
  }
  const avail = row.spans.filter((s) => s.level === 'available').sort((a, b) => a.from - b.from);
  if (!avail.length) return null;
  return avail[0].from === 0 && avail.length > 1 ? avail[1].from : avail[0].from;
}

interface LegendItem {
  key: string;
  y: number;
  swatches: { fill: string; opacity: number }[];
  label: string;
}

/** Legend as a vertical list: levels (a swatch per category on the sheet), a gap, then categories. */
export function layoutLegend(levels: Level[], cats: Category[], labels: PosterLabels = ENGLISH_LABELS): LegendItem[] {
  const items: LegendItem[] = [];
  let y = LEGEND_TOP;
  for (const level of levels) {
    items.push({ key: level, y, swatches: cats.map((c) => ({ fill: PAPER.cat[c], opacity: OPACITY[level] })), label: labels.level[level] });
    y += LEGEND_PITCH;
  }
  y += 8;
  for (const c of cats) {
    items.push({ key: c, y, swatches: [{ fill: PAPER.cat[c], opacity: 1 }], label: labels.category[c] });
    y += LEGEND_PITCH;
  }
  return items;
}

/**
 * Rough advance width of a string in the poster serif, in em units summed per character. Errs
 * wide so the static render never overlaps; the browser replaces it with a real measurement.
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x2e80) em += 1.0; // CJK, kana, fullwidth
    else if (ch === ' ') em += 0.28;
    else if (',.;:\'’!|'.includes(ch)) em += 0.3;
    else if (/[A-ZА-ЯЁ]/.test(ch)) em += 0.74;
    else if (/[mwMWшщжыю]/.test(ch)) em += 0.84;
    else if (/[iljtfrI]/.test(ch)) em += 0.34;
    else em += 0.56;
  }
  return em * fontSize;
}

export interface PlaceFit {
  fontSize: number;
  /** Set only when even the minimum size is too wide: forces the text into this many units */
  textLength?: number;
}

/** Font size for the place name so it ends PLACE_GAP before the legend starts. */
export function fitPlace(naturalWidthAtMax: number, legendLeft: number): PlaceFit {
  const avail = legendLeft - PLACE_GAP - M;
  if (naturalWidthAtMax <= avail) return { fontSize: PLACE_MAX };
  const size = Math.max(PLACE_MIN, Math.floor(((PLACE_MAX * avail) / naturalWidthAtMax) * 10) / 10);
  const widthAtSize = (naturalWidthAtMax * size) / PLACE_MAX;
  return widthAtSize > avail ? { fontSize: size, textLength: Math.floor(avail) } : { fontSize: size };
}

export interface PosterProps {
  rows: ChartRow[];
  categoryOf: (produceId: string) => Category;
  place: string;
  showStorage: boolean;
  /** Draw the lighter "available" layer around the peak */
  showAvailable?: boolean;
  /** Printed words: month abbreviations and legend. Row names come translated in `rows`. */
  labels?: PosterLabels;
}

/**
 * The whole chart as one self-contained SVG: inline colours and fonts only, no CSS classes, no
 * interaction, so the downloaded file looks the same anywhere and prints on A4.
 */
export const Poster = forwardRef<SVGSVGElement, PosterProps>(function Poster(
  { rows, categoryOf, place, showStorage, showAvailable = true, labels = ENGLISH_LABELS },
  ref,
) {
  const { pitch, amplitude, fontSize } = rowGeometry(rows.length);
  // drawn back to front
  const levels: Level[] = [...(showStorage ? (['stored'] as Level[]) : []), ...(showAvailable ? (['available'] as Level[]) : []), 'peak'];
  const cats = CATEGORIES.filter((c) => rows.some((r) => categoryOf(r.produceId) === c));
  const legend = layoutLegend([...levels].reverse(), cats, labels);
  // text to the left of the swatches; the rightmost swatch ends on the DEC gridline
  const decX = DEC_X;
  const maxSwatches = Math.max(...legend.map((it) => it.swatches.length));
  const legendTextX = decX - maxSwatches * 14 - 6;

  // Place name: estimated fit for the static render, then measured in the browser
  const legendLeftEstimate = legendTextX - Math.max(0, ...legend.map((it) => estimateTextWidth(it.label, LEGEND_FONT)));
  const estimated = fitPlace(estimateTextWidth(place, PLACE_MAX), legendLeftEstimate);
  const [measured, setMeasured] = useState<PlaceFit | null>(null);
  const placeRef = useRef<SVGTextElement>(null);
  const legendRef = useRef<SVGGElement>(null);
  const legendKey = legend.map((it) => `${it.label}:${it.swatches.length}`).join('|');

  useEffect(() => {
    const t = placeRef.current;
    const g = legendRef.current;
    if (!t || !g || typeof t.getComputedTextLength !== 'function') return;
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      // natural width at the maximum size, without any compression applied by a previous fit
      const size = t.getAttribute('font-size');
      const len = t.getAttribute('textLength');
      const adj = t.getAttribute('lengthAdjust');
      t.setAttribute('font-size', String(PLACE_MAX));
      t.removeAttribute('textLength');
      t.removeAttribute('lengthAdjust');
      const natural = t.getComputedTextLength();
      if (size !== null) t.setAttribute('font-size', size);
      if (len !== null) t.setAttribute('textLength', len);
      if (adj !== null) t.setAttribute('lengthAdjust', adj);
      const box = g.getBBox();
      if (!natural || !box.width) return;
      const next = fitPlace(natural, box.x);
      setMeasured((prev) => (prev && prev.fontSize === next.fontSize && prev.textLength === next.textLength ? prev : next));
    };
    measure();
    document.fonts?.ready.then(measure).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [place, legendKey]);

  const placeFit = measured ?? estimated;

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${A4.w} ${A4.h}`}
      width="210mm"
      height="297mm"
      role="img"
      aria-label={`${place}: seasonal availability by week`}
      fontFamily={SERIF}
    >
      <defs>
        {/* Seasons reaching either sheet edge fade out and in there instead of dipping to the baseline */}
        <linearGradient id="edge-fade-gradient" gradientUnits="userSpaceOnUse" x1={FADE_X0} x2={FADE_X1} y1={0} y2={0}>
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset={FADE_RAMP} stopColor="#fff" stopOpacity="1" />
          <stop offset={1 - FADE_RAMP} stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="edge-fade" maskUnits="userSpaceOnUse" x={FADE_X0} y={0} width={FADE_X1 - FADE_X0} height={A4.h}>
          <rect x={FADE_X0} y={0} width={FADE_X1 - FADE_X0} height={A4.h} fill="url(#edge-fade-gradient)" />
        </mask>
      </defs>
      <rect x={0} y={0} width={A4.w} height={A4.h} fill={PAPER.bg} />

      <text
        ref={placeRef}
        x={M}
        y={TITLE_Y}
        fontSize={placeFit.fontSize}
        fontWeight={600}
        fill={PAPER.text}
        textLength={placeFit.textLength}
        lengthAdjust={placeFit.textLength ? 'spacingAndGlyphs' : undefined}
      >
        {place}
      </text>

      <g ref={legendRef}>
      {legend.map((item) => (
        <g key={item.key}>
          {item.swatches.map((sw, i) => (
            <rect
              key={i}
              x={decX - (item.swatches.length - i) * 14 + 2}
              y={item.y - 10}
              width={12}
              height={12}
              rx={2}
              fill={sw.fill}
              fillOpacity={sw.opacity}
            />
          ))}
          <text x={legendTextX} y={item.y} textAnchor="end" fontSize={LEGEND_FONT} fill={PAPER.text2}>
            {item.label}
          </text>
        </g>
      ))}
      </g>

      {labels.months.map((m, i) => {
        const x = X0 + monthStartWeek(i) * CW;
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={AXIS_TOP_Y - 6} y2={AXIS_BOTTOM_Y + 6} stroke={i === 0 ? PAPER.gridStrong : PAPER.grid} strokeWidth={1} />
            <text x={x} y={AXIS_TOP_Y - 14} textAnchor="middle" fontSize={10} letterSpacing={1} fill={PAPER.text3}>{m}</text>
            <text x={x} y={AXIS_BOTTOM_Y + 22} textAnchor="middle" fontSize={10} letterSpacing={1} fill={PAPER.text3}>{m}</text>
          </g>
        );
      })}

      {rows.map((row, i) => {
        const baseline = ROWS_TOP + amplitude + (i + 1) * pitch;
        const g = { x0: X0, cw: CW, baseline, amplitude, extendLeft: EXTEND_LEFT_WEEKS };
        const color = PAPER.cat[categoryOf(row.produceId)];
        const lw = labelWeek(row) ?? 0;
        // left of the peak bar; a name that would run off the sheet sits at the bar's start instead
        const peakX = X0 + lw * CW;
        const approxWidth = row.name.length * fontSize * 0.52;
        const fits = peakX - 8 - approxWidth >= 6;
        const labelX = fits ? peakX - 8 : peakX + 6;
        const anchor = fits ? 'end' : 'start';
        const layers = levels.map((level) => ({ level, h: levelHeights(row, level) }));
        // fade the row as one composite, otherwise the translucent peak lets the layer beneath show through in the ramp
        const wraps = layers.some((l) => touchesEdge(l.h));
        return (
          <g key={row.produceId}>
            <g mask={wraps ? 'url(#edge-fade)' : undefined}>
              {layers.map(({ level, h }) => {
                const d = ridgePath(h, g);
                return d ? <path key={level} d={d} fill={color} fillOpacity={OPACITY[level]} stroke={PAPER.bg} strokeWidth={1} /> : null;
              })}
            </g>
            <text
              x={labelX}
              y={baseline - amplitude * 0.62 + fontSize * 0.35}
              textAnchor={anchor}
              fontSize={fontSize}
              fill={PAPER.text}
              paintOrder="stroke"
              stroke={PAPER.bg}
              strokeWidth={3}
              strokeLinejoin="round"
            >
              {row.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
});
