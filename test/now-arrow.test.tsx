// @vitest-environment jsdom
/**
 * Regression: the "this week" arrow never appeared in production builds. Its measuring effect
 * ran before React attached the ref of the parent stage element and never ran again; only the
 * double effect run of StrictMode in dev hid it. Renders without StrictMode, like production.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NowArrow } from '../src/web/NowArrow';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class FakeResizeObserver {
  constructor(private cb: () => void) {}
  observe() {
    this.cb();
  }
  disconnect() {}
  unobserve() {}
}

function Stage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const posterRef = useRef<SVGSVGElement>(null);
  return (
    <div className="stage" ref={stageRef}>
      <span ref={textRef}>this week</span>
      <svg ref={posterRef} />
      <NowArrow stageRef={stageRef} textRef={textRef} posterRef={posterRef} week={36} />
    </div>
  );
}

describe('NowArrow', () => {
  let root: Root | null = null;
  afterEach(() => {
    act(() => root?.unmount());
    root = null;
  });

  it('draws the arrow on the first mount, without a second effect run', () => {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = FakeResizeObserver;
    const host = document.createElement('div');
    document.body.appendChild(host);
    act(() => {
      root = createRoot(host);
      root.render(<Stage />);
    });
    const overlay = host.querySelector('svg.now-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay!.querySelectorAll('path').length).toBe(4);
  });
});
