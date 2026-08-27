# Agent notes (MagnitudeMap)

## 3D models: Sketchfab API

When searching for or replacing 3D models, use the **Sketchfab Data API** with the token in repo-root `.env` (`SKETCHFAB_API_TOKEN`). Do not commit `.env`. Do not use the Sketchfab website as the search path.

```
Authorization: Token $SKETCHFAB_API_TOKEN
```

Search (downloadable only):

```
GET https://api.sketchfab.com/v3/search?type=models&q=Eiffel+Tower&downloadable=true
```

Prefer this creator when they have a suitable CC match:

```
GET https://api.sketchfab.com/v3/search?type=models&q=Eiffel+Tower&downloadable=true&user=nazidefenseforceofficial
```

A linked Sketchfab URL is not enough. Load the model and confirm `isDownloadable` plus a redistributable license:

```
GET https://api.sketchfab.com/v3/models/{uid}
```

Download the GLB (short-lived `glb.url` — fetch it immediately, do not cache the URL):

```
GET https://api.sketchfab.com/v3/models/{uid}/download
```

**Ship only** CC0 / CC-BY / CC-BY-SA (`license.slug` `cc0`, `by`, `by-sa`). Skip Editorial (`ed`), Standard (`st`), NonCommercial (`by-nc`, `by-nc-sa`), store-only, and anything with `isDownloadable: false`. If a requested UID is not redistributable, find a downloadable CC stand-in and record the substitution in that model’s `license.json` `notes`.

Never print or commit the API token.

## Commit the GLB

`public/models/{id}/model.glb` and `license.json` are the runtime source of truth. **Commit them.** A clone / Pages deploy must work from those files alone.

After writing a new or replaced GLB:

1. Run `npm run compress-models -- --only={id}` (skips files that already have Draco/meshopt).
2. Run `npm run sync-attributions`.

Do not leave uncompressed GLBs in `public/models/`. Production `build` / `build:static` also run `compress-models` and no-op already-compressed files.

## Every new or replaced model

1. **Inspect** the file. Prefer a recognizable exterior, ≲200k tris, no studio floor / terrain / MSFS cockpit dump. Sim kits often hide lights and bombs by teleporting nodes to y≈−8192 — that inflates the bounding box into a huge empty volume (B-21).
2. **Orient** in `src/data/catalog.ts`. Authoring `yawDegrees` / `pitchDegrees` / `rollDegrees` must put the GLB in **+Y up, +Z nose/length, +X width**. Verify at Facing **0°** (user rotate is a separate parent).
3. **Crop and ground.** No dead space around the silhouette. Wheels or gear on the ground plane — not floating on engine nacelles or a helper mesh below the hull (747). Runtime crop in `ComparisonScene` is a safety net; still pick a clean asset.
4. Register real-world meters + `scaleAxis`, tags in `src/data/catalogTags.ts`, then confirm scale against person-male (1.75 m).
5. **Verify scale:** `npm run verify-models -- --only={id}`. Reads the GLB, applies catalog yaw/pitch/roll, crops helpers the same way the viewer does, and checks that length/width/height match catalog meters after the trusted `scaleAxis` is forced. With `--only`, it also screenshots the model next to person-male (`tmp/verify-models/`). Open those PNGs: Facing 0° must show +Z nose, the silhouette must sit on the ground, and height vs the 1.75 m adult must look right.
6. **Lineups.** Put the item in **at least one** lineup in `COMPARISON_PRESETS` (`src/data/catalog.ts`), and check it is not sitting in a wrong one. Lineup cards are the only crawl path to the `/c/` pages, so an item in no lineup is reachable only by searching the library for it by name. `npm test` fails if anything is homeless.
7. **Facts** in `src/data/catalogFacts.ts`, authored in metric (see the metric section below).
8. **Compress** with `npm run compress-models -- --only={id}`, then `npm run sync-attributions`.
9. **`npm test`** — catches homeless items, broken lineup ids, and metric prose the imperial converter cannot handle.

### Import checklist

Copy this into the task and tick it off. Steps 4–7 are the ones that get skipped.

```text
[ ] license: CC0 / CC-BY / CC-BY-SA and isDownloadable (never Editorial / Standard / NC)
[ ] public/models/{id}/model.glb committed, plus license.json with author + source + attribution
[ ] catalog entry: real-world metres, scaleAxis, shape, category, colour, blurb
[ ] orientation: +Y up, +Z nose/length, +X width at Facing 0 (yaw/pitch/rollDegrees)
[ ] tags in src/data/catalogTags.ts
[ ] facts in src/data/catalogFacts.ts (metric prose)
[ ] LINEUP: added to >=1 preset in COMPARISON_PRESETS, and in the right one
[ ] npm run verify-models -- --only={id}   (open the PNGs, do not just read PASS)
[ ] npm run compress-models -- --only={id}
[ ] npm run sync-attributions
[ ] npm test && npx tsc --noEmit
```

### Do not delete rotor discs

`verify-models` flags any wide, thin, flat mesh as a `ground-plate` ("looks like a studio floor / shadow slab"). On a **helicopter** that shape is also exactly a **rotor disc** — a coaxial type like the S-97 Raider has two stacked ones. Before deleting a flagged mesh, check its height off the ground and whether the aircraft still has all its blades afterwards. Deleting the lower disc of a coaxial rotor passes `verify-models` and looks obviously wrong in the viewer.

### Helicopters scale on rotor diameter

Catalog `length` for a helicopter is the published rotors-turning figure, but most meshes are authored with the blades **spread**, so the bounding box never matches it — forcing `scaleAxis: 'length'` oversizes the aircraft (47% on the Pave Low). Use `scaleAxis: 'width'` with the rotor diameter, which these meshes encode cleanly, and record the deviation in `license.json`.

See `public/models/README.md` and `.cursor/rules/model-import.mdc`.

## Build-time prerendering (SEO)

`build` / `build:static` run four steps: `vite build` → `build:ssr` → `prerender` → (full `build` only) `generate-og`.

- `vite build` emits `dist/index.html`, plus `dist/c/{slug}/index.html` and `dist/sitemap.xml` from `vite-plugin-og-pages.ts` (per-lineup title, description, canonical, OG tags, JSON-LD).
- `build:ssr` bundles `src/entry-server.tsx` to `dist-ssr/` via `vite.config.ssr.ts`.
- `scripts/prerender.mjs` renders the React tree for each page and injects it into that page's `<div id="root">`. It touches nothing else, so the head tags above survive.

Two rules keep this working:

1. **Nothing may read `window`, `localStorage`, or `navigator` during render.** Node 22 defines a global `navigator` with a real `language`, so `typeof navigator` is not a server check — gate on `window`. Persisted preferences must initialize to their exported defaults and load in a post-mount `useEffect` (see `App.tsx`); reading them in a `useState` initializer causes a hydration mismatch for anyone whose stored value differs from the default.
2. **Babylon must stay behind a dynamic `import()`.** `Viewer.tsx` imports `ComparisonScene` lazily inside its effect. A module-scope import would pull ~7 MB into both the prerenderer and the initial client bundle.

Lineup cards in the sidebar are `<a href>` elements, not buttons — they are the only crawl path to the `/c/` pages. Keep the href and the click handler that intercepts unmodified clicks.

## Descriptions are authored in metric

`blurb` / `facts` in `src/data/catalog.ts` and `catalogFacts.ts` are written in metric prose. `src/unitText.ts` converts the quantities to imperial at render time (sidebar facts, lineup tooltips, 3D plaques) — do not author a second imperial copy.

Write quantities as a number, a space, and the unit (`73 t`, `120 mm`, `25–35 kg`, `67 km/h`) so the converter can find them. If a metric unit must stay metric for every reader (a physical constant, or the unit itself being named), add the phrase to `IMPERIAL_EXEMPT_PHRASES`; if it sits in the denominator of a rate ("per kilometre"), add it to `PHRASE_OVERRIDES`.

Sub-10 ft lengths render as feet and inches (`5 ft 9 in`) via `formatFeetInches` in `src/units.ts`, shared with the viewer's dimension labels. Ranges stay in decimal feet.

`npm test` walks every shipped description and fails if a metric quantity survives conversion. Run it after editing facts.
