import { describe, expect, it } from 'vitest';
import { handDrawnArrow, noise, smoothPath, wobblePoints } from '../src/web/handDrawn';

describe('hand-drawn strokes', () => {
  const from = { x: 0, y: 0 };
  const to = { x: 200, y: 100 };

  it('is deterministic for a seed and different across seeds', () => {
    expect(noise(7)).toBe(noise(7));
    expect(noise(7)).not.toBe(noise(8));
    const a = handDrawnArrow(from, to, 36);
    expect(handDrawnArrow(from, to, 36)).toEqual(a);
    expect(handDrawnArrow(from, to, 37).shaft).not.toBe(a.shaft);
  });

  it('starts and ends exactly on the given points and wobbles in between', () => {
    const pts = wobblePoints(from, { x: 50, y: 60 }, { x: 150, y: 40 }, to, 3, 1);
    expect(pts[0]).toEqual(from);
    expect(pts[pts.length - 1].x).toBeCloseTo(to.x, 5);
    expect(pts[pts.length - 1].y).toBeCloseTo(to.y, 5);
    const straight = wobblePoints(from, { x: 50, y: 60 }, { x: 150, y: 40 }, to, 0, 1);
    const moved = pts.filter((p, i) => Math.hypot(p.x - straight[i].x, p.y - straight[i].y) > 0.5);
    expect(moved.length).toBeGreaterThan(5);
  });

  it('emits smooth cubic path commands', () => {
    const d = smoothPath([from, { x: 10, y: 5 }, to]);
    expect(d.startsWith('M0.0,0.0')).toBe(true);
    expect(d.match(/ C/g)?.length).toBe(2);
  });
});
