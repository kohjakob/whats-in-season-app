import { useEffect, useState, type RefObject } from 'react';
import { A4, AXIS_LABEL_TOP_Y, CW, X0 } from './Poster';
import { currentWeek } from './ridge';
import { handDrawnArrow } from './handDrawn';

interface Props {
  /** The positioned container the overlay covers */
  stageRef: RefObject<HTMLElement>;
  /** The handwritten "this week" text the arrow starts from */
  textRef: RefObject<HTMLElement>;
  /** The poster SVG the arrow points into */
  posterRef: RefObject<SVGSVGElement>;
  week?: number;
}

interface Geometry {
  w: number;
  h: number;
  shaft: string;
  head: string;
}

/**
 * Hand-drawn arrow from the "this week" note to the point just above the month labels at the
 * current week. Measured from the live layout, redrawn on resize, so it stays true when the
 * picker opens or the window changes. Pixel units, not part of the downloaded SVG.
 */
export function NowArrow({ stageRef, textRef, posterRef, week = currentWeek() }: Props) {
  const [g, setG] = useState<Geometry | null>(null);

  // A passive effect, not a layout effect: the stage element is this component's parent, and React
  // attaches a parent's ref only after its children's layout effects have run.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const text = textRef.current;
      const poster = posterRef.current;
      if (!text || !poster) return;
      const s = stage.getBoundingClientRect();
      const t = text.getBoundingClientRect();
      const p = poster.getBoundingClientRect();
      const scale = p.width / A4.w;
      const from = { x: t.left - s.left + t.width * 0.35, y: t.bottom - s.top + 2 };
      const to = { x: p.left - s.left + (X0 + (week + 0.5) * CW) * scale, y: p.top - s.top + AXIS_LABEL_TOP_Y * scale };
      setG({ w: s.width, h: s.height, ...handDrawnArrow(from, to, week) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    if (textRef.current) ro.observe(textRef.current);
    return () => ro.disconnect();
  }, [stageRef, textRef, posterRef, week]);

  if (!g) return null;
  return (
    <svg className="now-overlay" width={g.w} height={g.h} viewBox={`0 0 ${g.w} ${g.h}`} aria-hidden="true">
      <g className="now-ink">
        <path className="halo" d={g.shaft} />
        <path className="halo" d={g.head} />
        <path d={g.shaft} />
        <path d={g.head} />
      </g>
    </svg>
  );
}
