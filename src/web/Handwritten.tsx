import { noise } from './handDrawn';

interface Props {
  text: string;
  /** Different seeds give different jitter for the same text */
  seed?: number;
  /** Maximum vertical shift per glyph, px */
  amplitude?: number;
  /** Maximum rotation per glyph, degrees */
  tilt?: number;
  className?: string;
}

/**
 * Text with each glyph nudged up or down by a tiny, seeded amount, so a handwriting font stops
 * sitting on a ruler-straight baseline. Assistive tech reads the plain string.
 */
export function Handwritten({ text, seed = 1, amplitude = 1.2, tilt = 1.5, className }: Props) {
  return (
    <span className={`hw${className ? ` ${className}` : ''}`} aria-label={text} role="text">
      {[...text].map((ch, i) => {
        if (ch === ' ') return <span key={i} aria-hidden="true"> </span>;
        const dy = (noise(seed * 97 + i) - 0.5) * 2 * amplitude;
        const rot = (noise(seed * 131 + i + 0.5) - 0.5) * 2 * tilt;
        return (
          <span key={i} className="hw-ch" aria-hidden="true" style={{ transform: `translateY(${dy.toFixed(2)}px) rotate(${rot.toFixed(2)}deg)` }}>
            {ch}
          </span>
        );
      })}
    </span>
  );
}
