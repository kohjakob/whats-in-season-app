import { useEffect, useMemo, useRef, useState } from 'react';
import { computeChart } from '../engine/compute';
import type { ChartRow, Normals } from '../engine/types';
import { doyToWeek } from '../engine/mask';
import { fetchNormals, langFromUrl, localizedPlaceName, pickFromUrl, placeFromUrl, stateToUrl, type Pick, type Place } from './api';
import { PRODUCE, type Category } from './produce';
import { LocationSearch } from './LocationSearch';
import { Poster } from './Poster';
import { ProduceChooser, ProducePresets, PRESETS } from './ProducePicker';
import { NowArrow } from './NowArrow';
import { Handwritten } from './Handwritten';
import { FitTitle } from './FitTitle';
import produceStrip from './assets/produce-strip.webp';
import { PortfolioBar } from './PortfolioBar';
import { defaultSelection } from './popularity';
import { weekLabelLong } from './ridge';
import { LANGS, LANG_LABEL, produceName, isLang, posterLabels, type Lang } from './i18n';

const categoryOf = new Map(PRODUCE.map((c) => [c.id, c.category as Category]));
const PRODUCE_IDS = new Set(PRODUCE.map((c) => c.id));
const catOf = (id: string): Category => categoryOf.get(id)!;
const hasFresh = (r: ChartRow) => r.spans.some((s) => s.level !== 'stored');
const REPO_URL = 'https://github.com/kohjakob/whats-in-season-app';
/** Shown until the visitor picks somewhere */
const DEFAULT_PLACE: Place = { name: 'Vienna, Austria', lat: 48.208, lon: 16.373 };
/** Preset shown on load */
const DEFAULT_PRESET = 30;

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

interface Climate {
  normals: Normals;
  source: string;
  elevation?: number;
}

function factsOf(climate: Climate): [string, string][] {
  const n = climate.normals;
  const safe = n.frostFree.safe;
  const frost = !safe
    ? 'no frost-free season'
    : safe.length === 365
      ? 'all year'
      : `${weekLabelLong(doyToWeek(safe.start))} to ${weekLabelLong(doyToWeek(safe.end))}`;
  return [
    ['Frost-free', frost],
    ['Winter chill', `${Math.round(n.chillHours).toLocaleString('en')} hours`],
    ['Winter low', `around ${n.annualMinTmin.toFixed(0)} °C`],
    ['Weather data', climate.source === 'era5' ? 'ERA5, 1995 to 2024' : 'NASA POWER, 1995 to 2024'],
  ];
}

/** Title Case, keeping short joining words lower case */
export function titleCase(s: string): string {
  const small = new Set(['to', 'of', 'and', 'from', 'a', 'the', 'in', 'at']);
  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
  return s
    .split(' ')
    .map((w, i) => (i > 0 && small.has(w.toLowerCase()) ? w.toLowerCase() : w.split('-').map(cap).join('-')))
    .join(' ');
}

function ClimateFacts({ place, climate }: { place: Place; climate: Climate }) {
  return (
    <section className="insights" aria-labelledby="insights-title">
      <h2 id="insights-title" className="insights-title">Insights for {place.name}</h2>
      <ul className="facts">
        {factsOf(climate).map(([k, v]) => (
          <li key={k}>
            {titleCase(k)}: {titleCase(v)}
          </li>
        ))}
      </ul>
    </section>
  );
}

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'poster';
}

export function App() {
  const [place, setPlace] = useState<Place | null>(() => placeFromUrl() ?? DEFAULT_PLACE);
  const [climate, setClimate] = useState<Climate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** What to show, from the URL or the default preset; resolved against the produce grown at the place */
  const [pick, setPick] = useState<Pick>(() => pickFromUrl(PRODUCE_IDS) ?? { kind: 'preset', n: DEFAULT_PRESET });
  const [showStorage, setShowStorage] = useState(false);
  const [showAvailable, setShowAvailable] = useState(false);
  const [lang, setLang] = useState<Lang>(() => {
    const fromUrl = langFromUrl();
    return isLang(fromUrl) ? fromUrl : 'en';
  });
  /** Place name as printed on the poster, in the poster language */
  const [posterPlace, setPosterPlace] = useState<string>('');

  useEffect(() => {
    if (!place) return;
    setPosterPlace(place.name);
    if (lang === 'en') return;
    const ctrl = new AbortController();
    localizedPlaceName(place, lang, ctrl.signal)
      .then((name) => setPosterPlace(name))
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [place, lang]);
  const svgRef = useRef<SVGSVGElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const nowTextRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!place) return;
    let cancelled = false;
    setBusy(true);
    setError(null);
    fetchNormals(place.lat, place.lon)
      .then((r) => {
        if (cancelled) return;
        setClimate({ normals: r.normals, source: r.source, elevation: r.elevation });
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [place]);

  const rows = useMemo(() => (climate ? computeChart(PRODUCE, climate.normals) : []), [climate]);
  const presentIds = useMemo(() => new Set(rows.filter(hasFresh).map((r) => r.produceId)), [rows]);
  const presets = useMemo(
    () => new Map<number, Set<string>>(PRESETS.map((n) => [n, defaultSelection(presentIds, catOf, n / 2)])),
    [presentIds],
  );
  const effective = useMemo(() => {
    if (pick.kind === 'all') return presentIds;
    if (pick.kind === 'ids') return new Set(pick.ids);
    return presets.get(pick.n) ?? presets.get(DEFAULT_PRESET)!;
  }, [pick, presets, presentIds]);
  const activePreset = PRESETS.find((n) => sameSet(effective, presets.get(n)!)) ?? null;
  const allActive = sameSet(effective, presentIds);

  useEffect(() => {
    if (place && climate) stateToUrl(place, pick, lang);
  }, [place, climate, pick, lang]);

  const notes = useMemo(() => new Map(rows.filter((r) => r.note).map((r) => [r.produceId, r.note as string])), [rows]);

  const produceById = useMemo(() => new Map(PRODUCE.map((c) => [c.id, c])), []);
  const labels = useMemo(() => posterLabels(lang), [lang]);
  const visible = rows
    .filter((r) => hasFresh(r) && effective.has(r.produceId))
    .map((r) => ({
      ...r,
      name: produceName(produceById.get(r.produceId)!, lang),
      spans: showStorage ? r.spans : r.spans.filter((s) => s.level !== 'stored'),
    }));
  const absent = rows.filter((r) => !hasFresh(r) && effective.has(r.produceId));

  const download = () => {
    const svg = svgRef.current;
    if (!svg || !place) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `in-season-${slugify(place.name)}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
    <main className="app">
      <header className="masthead">
        <img className="hero-strip" src={produceStrip} alt="" aria-hidden="true" width={2200} height={342} decoding="async" />
        <FitTitle fitLine="What's in season in" rest={<>your area?</>} />
        <p className="wip">
          This is a work in progress, improvements via{' '}
          <a href={REPO_URL} target="_blank" rel="noopener">
            GitHub
          </a>{' '}
          are welcome
        </p>
      </header>

      <LocationSearch onSelect={setPlace} busy={busy} />
      <div className={`status${error ? ' error' : ''}`} aria-live="polite">
        {error ? `Could not load climate data: ${error}` : busy ? 'Reading thirty years of weather…' : !place ? 'Pick a place to see its produce calendar.' : ''}
      </div>

      {rows.length > 0 && (
        <>
          <div className="stage" ref={stageRef}>
            <div className="stage-head">
              <ProducePresets
                present={presentIds}
                activePreset={activePreset}
                allActive={allActive}
                onPreset={(n) => setPick({ kind: 'preset', n })}
                onAll={() => setPick({ kind: 'all' })}
                onDownload={download}
              />
              <span className="now-text" ref={nowTextRef} aria-hidden="true">
                <Handwritten text="this week" seed={11} amplitude={0.9} />
              </span>
            </div>
            <Poster
              ref={svgRef}
              rows={visible}
              categoryOf={catOf}
              place={posterPlace || place?.name || ''}
              showStorage={showStorage}
              showAvailable={showAvailable}
              labels={labels}
            />
            <NowArrow stageRef={stageRef} textRef={nowTextRef} posterRef={svgRef} />
          </div>

          <div className="below">
            <label className="toggle">
              <input type="checkbox" checked={showAvailable} onChange={(e) => setShowAvailable(e.target.checked)} />
              Show Available Months
            </label>
            <label className="toggle">
              <input type="checkbox" checked={showStorage} onChange={(e) => setShowStorage(e.target.checked)} />
              Show Storage Months
            </label>
            <label className="toggle lang-pick">
              Language
              <select value={lang} onChange={(e) => isLang(e.target.value) && setLang(e.target.value)} aria-label="Language">
                {LANGS.map((l) => (
                  <option key={l} value={l}>{LANG_LABEL[l]}</option>
                ))}
              </select>
            </label>
          </div>

          <ProduceChooser
            produce={PRODUCE}
            present={presentIds}
            notes={notes}
            selected={effective}
            lang={lang}
            onChange={(next) => setPick({ kind: 'ids', ids: [...next].sort() })}
          />

          {absent.length > 0 && (
            <details className="absent-list">
              <summary>{absent.length} of your picks {absent.length === 1 ? 'is' : 'are'} not grown in your area</summary>
              <ul>
                {absent.map((r) => (
                  <li key={r.produceId}>
                    {r.name}
                    {r.note ? `: ${r.note}` : ''}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {place && climate && <ClimateFacts place={place} climate={climate} />}
        </>
      )}

      <div className="foot">
        <p>Peak: hits its best nine years out of ten. Available: a typical year, outside peak. Storage: after harvest, for produce that keeps.</p>
        <p>Climate data from the Open-Meteo ERA5 archive, NASA POWER as backup. Produce thresholds from FAO EcoCrop (CC BY 4.0), hand-curated.</p>
      </div>
    </main>
    <PortfolioBar />
    </>
  );
}
