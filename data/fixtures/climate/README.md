# Climate fixtures

Verbatim Open-Meteo archive responses (ERA5, daily Tmin, Tmax, Tmean, precipitation, 1995 to
2024) for the test-bed locations. Fetched 2026-09-16 with `pnpm fetch-fixture <slug> <lat> <lon>`.
Kept verbatim so every derivation can be rerun offline and so tests never touch the network.

| Slug | Lat, lon | Climate | Purpose |
|---|---|---|---|
| `berlin` | 52.52, 13.41 | humid continental | frost-bounded season, spring plus autumn cool produce |
| `sydney` | -33.87, 151.21 | humid subtropical, southern hemisphere | thermal year anchoring, low chill |
| `nairobi` | -1.29, 36.82 | tropical highland | no frost, no chill, rain-driven planting (M4) |
| `phoenix` | 33.45, -112.07 | hot desert | heat cutoff, winter cool produce, two warm seasons |
| `salinas` | 36.68, -121.66 | cool Mediterranean coast | validation against the vertumnus SF Bay Area poster |
| `geneva-ny` | 42.87, -76.98 | humid continental, Finger Lakes | validation against the New York State harvest chart |
| `fresno` | 36.74, -119.78 | hot Mediterranean interior, San Joaquin Valley | second district of the vertumnus SF Bay Area poster (stone fruit, tomatoes, grapes) |
| `toronto` | 43.65, -79.38 | humid continental, lake moderated | validation against the Foodland Ontario availability guide |
| `london` | 51.51, -0.13 | temperate maritime | validation against a UK seasonal calendar |
