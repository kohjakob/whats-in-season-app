# What produce is in season *in your area*? 🍎

Find out at [whats-in-season-app.kohjakob.com](https://whats-in-season-app.kohjakob.com/)

Seasonality of produce is computed from thirty years of daily
[ERA5](https://climate.copernicus.eu/climate-reanalysis) weather for the
location, reduced to climate normals (frost probability, smoothed temperatures, chill hours).
Each item's record (`data/produce/*.json`, seeded from
[FAO EcoCrop](https://gaez.fao.org/pages/ecocrop)) was categorized into
[warm-season](https://en.wikipedia.org/wiki/Warm-season_grass) [annual](https://en.wikipedia.org/wiki/Annual_plant),
[cool-season](https://en.wikipedia.org/wiki/Cool-season_grass) annual or
[perennial](https://en.wikipedia.org/wiki/Perennial_plant). The output is scored against five
published seasonal charts.

## Commands

```sh
pnpm install
pnpm dev                             # web app with /api/normals served by the dev server
pnpm build && pnpm preview           # static build in dist/
pnpm render-chart berlin out.svg     # A4 poster for a fixture, add --all and --storage
pnpm cli --fixture berlin            # offline, uses data/fixtures/climate/berlin.json
pnpm cli --city "Buenos Aires"       # geocodes, fetches ERA5 once, caches under .cache/
pnpm cli --lat 52.52 --lon 13.41 --produce tomato,apple --json
pnpm ecocrop "Cucumis sativus"       # look up EcoCrop thresholds for a species
pnpm fetch-fixture lisbon 38.72 -9.14
pnpm validate                        # score the model against published seasonal charts
pnpm validate --set vertumnus-sfbay --all
pnpm import-calendars                # rebuild truth fixtures from data/raw/calendars
pnpm test
pnpm typecheck
```

## Layout

```
src/engine/       pure TypeScript, no I/O: normals, frost season, produce models, week spans
src/produce/      zod schema and loader for data/produce
src/climate/      Open-Meteo archive and geocoding clients
src/validate/     truth format, scoring, runner for pnpm validate
src/web/          React app: location search, produce picker, A4 poster SVG with download
src/server/       GET /api/normals handler (Web Request/Response), used by the Vite dev server
api/normals.ts    same handler, laid out for hosts that auto-deploy an api/ directory as a
                  function; not used by the current static-only deploy
src/cli.ts        text chart
scripts/          ecocrop lookup, fixture fetcher
data/produce/     one curated JSON record per item
data/raw/         vendored upstream tables (EcoCrop, seasonal calendars)
data/fixtures/    verbatim ERA5 responses per test-bed location, truth sets from published charts
test/             vitest
```

## Climate data

The browser never talks to [Open-Meteo](https://open-meteo.com/) directly; a thirty-year pull
counts as many calls and Open-Meteo throttles free-tier IPs to roughly ten a minute. Instead it
calls `/api/normals?lat&lon`
([↗︎](https://github.com/kohjakob/whats-in-season-app/blob/main/src/server/normals.ts)),
with the coordinates snapped to the centre of a 0.25 degree cell (ERA5's native resolution) so
everyone in the same cell hits the same URL. The function fetches thirty
years once, reduces it to about 20 KB of normals, and responds with `s-maxage=31536000` so the
CDN caches each cell for a year. Produce models then run client-side on those normals.

That endpoint needs a host that runs functions, not just static files. On plain static
hosting, `/api/normals` doesn't exist: the browser runs the same fetch-and-reduce logic
itself and caches recent cells in localStorage instead.
