import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

const MOBILE_MAX = 600;
const BASE = 34;
/** Share of the container the first line should span on narrow screens */
const FILL = 0.75;

interface Props {
  /** The line that should span FILL of the width on narrow screens */
  fitLine: ReactNode;
  /** The rest of the title, shown on its own line on narrow screens */
  rest: ReactNode;
}

/**
 * Headline that, on narrow screens, sizes its font so the first line spans FILL of the container.
 * Measures the line at a base size and scales, re-measuring on resize. Desktop keeps the CSS size.
 */
export function FitTitle({ fitLine, rest }: Props) {
  const h1 = useRef<HTMLHeadingElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const el = h1.current;
    if (!el) return;
    const fit = () => {
      if (window.innerWidth > MOBILE_MAX) {
        setSize(undefined);
        return;
      }
      const span = line.current;
      if (!span) return;
      const prev = el.style.fontSize;
      el.style.fontSize = `${BASE}px`;
      const width = span.getBoundingClientRect().width;
      el.style.fontSize = prev;
      if (width > 0) setSize(Math.max(22, Math.min(72, (BASE * el.clientWidth * FILL) / width)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener('resize', fit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, []);

  return (
    <h1 ref={h1} style={size ? { fontSize: size } : undefined}>
      <span ref={line} className="fit-line">{fitLine}</span>
      <br className="mobile-break" />
      <span className="nowrap">{rest}</span>
    </h1>
  );
}
