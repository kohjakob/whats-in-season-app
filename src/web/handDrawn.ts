/** Hand-drawn looking strokes: a smooth curve with a gentle, seeded wobble. */

export interface Pt {
  x: number;
  y: number;
}

function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

/** Deterministic pseudo-random in [0, 1) from a seed, so the wobble is stable between renders. */
export function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Sample a cubic Bezier, push each sample sideways by the sum of two slow sine waves (zero at
 * both ends so start and tip stay exact), and return the points. `amplitude` is in the same
 * units as the points.
 */
export function wobblePoints(p0: Pt, p1: Pt, p2: Pt, p3: Pt, amplitude: number, seed: number, samples = 28): Pt[] {
  const phase1 = noise(seed) * Math.PI * 2;
  const phase2 = noise(seed + 1) * Math.PI * 2;
  const f1 = 1.1 + noise(seed + 2) * 0.6;
  const f2 = 2.3 + noise(seed + 3) * 0.9;
  const out: Pt[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = cubic(p0, p1, p2, p3, t);
    const q = cubic(p0, p1, p2, p3, Math.min(1, t + 0.01));
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const env = Math.sin(Math.PI * t);
    const w = amplitude * env * (0.65 * Math.sin(2 * Math.PI * f1 * t + phase1) + 0.35 * Math.sin(2 * Math.PI * f2 * t + phase2));
    out.push({ x: p.x + nx * w, y: p.y + ny * w });
  }
  return out;
}

/** Smooth path through points (Catmull-Rom converted to cubic Beziers). */
export function smoothPath(pts: Pt[]): string {
  if (pts.length < 2) return '';
  const f = (n: number) => n.toFixed(1);
  let d = `M${f(pts[0].x)},${f(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${f(c1.x)},${f(c1.y)} ${f(c2.x)},${f(c2.y)} ${f(p2.x)},${f(p2.y)}`;
  }
  return d;
}

/**
 * A hand-drawn arrow from `from` to `to`: it sets off sideways first and arrives from straight
 * above, so it skirts whatever sits between the two points instead of cutting through it.
 * Returns shaft and head paths.
 */
export function handDrawnArrow(from: Pt, to: Pt, seed: number, amplitude = 2.5): { shaft: string; head: string } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const p1 = { x: from.x + dx * 0.6, y: from.y + dy * 0.12 };
  const p2 = { x: to.x - dx * 0.04, y: to.y - dy * 0.42 };
  const pts = wobblePoints(from, p1, p2, to, amplitude, seed);
  const tail = pts[pts.length - 2];
  const ang = Math.atan2(to.y - tail.y, to.x - tail.x);
  const size = 14;
  const wing = (a: number) => ({ x: to.x - Math.cos(ang + a) * size, y: to.y - Math.sin(ang + a) * size });
  const l = wing(0.5 + (noise(seed + 4) - 0.5) * 0.15);
  const r = wing(-0.5 + (noise(seed + 5) - 0.5) * 0.15);
  const head = smoothPath([l, { x: (l.x + to.x) / 2 + nx * 0.6, y: (l.y + to.y) / 2 + ny * 0.6 }, to]) +
    ' ' + smoothPath([to, { x: (r.x + to.x) / 2 - nx * 0.6, y: (r.y + to.y) / 2 - ny * 0.6 }, r]);
  return { shaft: smoothPath(pts), head };
}
