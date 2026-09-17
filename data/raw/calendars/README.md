# Seasonal calendars used as validation truth

Facts (which item is listed for which month) transcribed from published calendars on
2026-09-16. Prose was not copied. Used only to score the model in `pnpm validate`; nothing
here ships in the product.

| File | Publisher | Licence | Notes |
|---|---|---|---|
| `ontario.json` | Foodland Ontario availability guide, Ontario Data Catalogue dataset d7b3123b-ccc7-4cd2-ac7b-82717cf6da18 | Open Government Licence Ontario 1.0 | "available" means Ontario product in retail, greenhouse rows are dropped on import |
| `uk.json` | The Vegetarian Society, Seasonal UK Grown Produce | facts transcribed, page copyright of publisher | editorial list, no fresh vs stored distinction, some months visibly incomplete |
| `germany.json` | regional-saisonal.de Saisonkalender Gemuese and Obst | facts transcribed, page copyright of publisher | field harvest only, storage months given separately |

Each `<region>.source.json` records URLs, fetch date and parsing method. `pnpm import-calendars`
maps items onto produce ids and writes `data/fixtures/truth/<region>.json`.
