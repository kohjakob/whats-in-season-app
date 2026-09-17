import type { Produce } from '../produce/schema';
import { CATEGORIES, type Category } from './categories';
import { byPopularity } from './popularity';
import { produceName, type Lang } from './i18n';

const LABEL: Record<Category, string> = { vegetable: 'Vegetables', fruit: 'Fruit', herb: 'Herbs', nut: 'Nuts' };
export const PRESETS = [10, 20, 30, 40, 50] as const;

interface Shared {
  produce: Produce[];
  /** Produce with a fresh season at this location */
  present: Set<string>;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

interface PresetProps {
  present: Set<string>;
  /** Which "Top N" preset the current selection equals, if any */
  activePreset: number | null;
  /** True when every item grown here is selected */
  allActive: boolean;
  onPreset: (n: number) => void;
  onAll: () => void;
  onDownload: () => void;
}

/** Summary line and the quick presets, shown above the sheet. */
export function ProducePresets({ present, activePreset, allActive, onPreset, onAll, onDownload }: PresetProps) {
  const scrollToChooser = () => document.getElementById('chooser')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <div className="picker">
      <div className="picker-actions">
        {PRESETS.map((n) => (
          <button key={n} type="button" className="btn small" aria-pressed={activePreset === n} onClick={() => onPreset(n)}>
            Top {n}
          </button>
        ))}
        <button type="button" className="btn small" aria-pressed={allActive} onClick={onAll}>
          Everything grown in your area
        </button>
        <button type="button" className="btn small with-icon" onClick={scrollToChooser}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2.5v11M3.5 9 8 13.5 12.5 9" />
          </svg>
          Choose produce
        </button>
        <button type="button" className="btn small with-icon primary" onClick={onDownload}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2v9M4 7.5 8 11.5 12 7.5M3 14h10" />
          </svg>
          Download SVG
        </button>
      </div>
      {present.size === 0 && <p className="picker-summary">Nothing in our list grows here.</p>}
    </div>
  );
}

interface ChooserProps extends Shared {
  /** Why an item is missing here, by id */
  notes: Map<string, string>;
  /** Poster language; when not English the translated name is shown under the English one */
  lang: Lang;
}

/** Every item as a checkbox, grouped by category, shown below the sheet. */
export function ProduceChooser({ produce, present, notes, selected, onChange, lang }: ChooserProps) {
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  const setCategory = (cat: Category, on: boolean) => {
    const next = new Set(selected);
    for (const c of produce) {
      if (c.category !== cat) continue;
      if (on && present.has(c.id)) next.add(c.id);
      if (!on) next.delete(c.id);
    }
    onChange(next);
  };
  return (
    <section className="chooser" id="chooser" aria-labelledby="chooser-title">
      <div className="chooser-head">
        <h2 id="chooser-title" className="chooser-title">Choose which produce to include</h2>
        <button type="button" className="btn small secondary" onClick={() => onChange(new Set())}>
          Deselect all
        </button>
      </div>
      {CATEGORIES.map((cat) => {
        const list = produce.filter((c) => c.category === cat).sort(byPopularity);
        return (
          <fieldset key={cat} className="picker-group">
            <legend>
              <span className="swatch" style={{ background: `var(--cat-${cat})` }} /> {LABEL[cat]}
              <span className="picker-group-actions">
                <button type="button" className="linkish" onClick={() => setCategory(cat, true)}>all grown in your area</button>
                <button type="button" className="linkish" onClick={() => setCategory(cat, false)}>none</button>
              </span>
            </legend>
            <div className="picker-grid">
              {list.map((c) => {
                const here = present.has(c.id);
                return (
                  <label key={c.id} className={here ? '' : 'absent'} title={here ? undefined : notes.get(c.id) ?? 'not grown in your area'}>
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                    <span className="picker-name-wrap">
                      <span className="picker-name">{c.names.en}</span>
                      {lang !== 'en' && <span className="picker-name-alt" lang={lang}>{produceName(c, lang)}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </section>
  );
}
