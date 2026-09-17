import { useEffect, useRef, useState } from 'react';
import { reverseGeocode, searchPlaces, type Place } from './api';

interface Props {
  onSelect: (place: Place) => void;
  busy: boolean;
}

export function LocationSearch({ onSelect, busy }: Props) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [geoError, setGeoError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  /** Name of the place just picked; typing it into the box must not trigger a new search */
  const chosen = useRef<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2 || query === chosen.current) {
      setHits([]);
      setOpen(false);
      return;
    }
    const ctrl = new AbortController();
    abort.current?.abort();
    abort.current = ctrl;
    const t = setTimeout(() => {
      searchPlaces(query.trim(), ctrl.signal)
        .then((h) => {
          setHits(h);
          setActive(0);
          setOpen(true);
        })
        .catch((e: unknown) => {
          if (!(e instanceof DOMException && e.name === 'AbortError')) setHits([]);
        });
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const pick = (p: Place) => {
    abort.current?.abort();
    chosen.current = p.name;
    setQuery(p.name);
    setHits([]);
    setOpen(false);
    onSelect(p);
  };

  const toast = (msg: string) => {
    setGeoError(msg);
    window.setTimeout(() => setGeoError((cur) => (cur === msg ? null : cur)), 4000);
  };

  const locate = () => {
    setGeoError(null);
    if (!navigator.geolocation) {
      toast('Location Not Supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        reverseGeocode(lat, lon)
          .then((name) => pick({ name, lat, lon }))
          .catch(() => pick({ name: `Your location (${lat.toFixed(2)}, ${lon.toFixed(2)})`, lat, lon }));
      },
      (err) => toast(err.code === err.PERMISSION_DENIED ? 'Location Denied' : err.code === err.TIMEOUT ? 'Location Timed Out' : 'Location Unavailable'),
      { timeout: 10_000, maximumAge: 600_000 },
    );
  };

  return (
    <div className="search" role="search">
      <input
        type="search"
        placeholder="Town, city or region"
        aria-label="Search for a place"
        aria-autocomplete="list"
        aria-expanded={open && hits.length > 0}
        aria-controls="place-suggestions"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => hits.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, hits.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && hits[active]) {
            e.preventDefault();
            pick(hits[active]);
          } else if (e.key === 'Escape') setOpen(false);
        }}
      />
      <button type="button" className="btn with-icon" onClick={locate} disabled={busy}>
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="6.5" />
          <path d="M1.5 8h13M8 1.5c2.2 2 3.3 4.2 3.3 6.5S10.2 12.5 8 14.5M8 1.5C5.8 3.5 4.7 5.7 4.7 8s1.1 4.5 3.3 6.5" />
        </svg>
        Use My Location
      </button>
      {open && hits.length > 0 && (
        <ul id="place-suggestions" className="suggestions" role="listbox">
          {hits.map((h, i) => (
            <li
              key={`${h.lat},${h.lon}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={() => pick(h)}
              onMouseEnter={() => setActive(i)}
            >
              {h.detail ?? h.name}
            </li>
          ))}
        </ul>
      )}
      {geoError && (
        <div className="toast" role="status" aria-live="polite">
          {geoError}
        </div>
      )}
    </div>
  );
}
