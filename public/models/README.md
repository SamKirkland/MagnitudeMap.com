# Models

Static, redistributable 3D assets loaded by the site at runtime from this folder. **Commit `model.glb` and `license.json`.** A clone does not need to run fetch scripts.

## Layout

```text
public/models/
  {id}/
    model.glb          # preferred runtime format
    license.json       # license + source attribution
  index.json           # optional manifest of available model ids
```

The app requests files like `/models/sedan/model.glb` (Vite copies `public/` to the site root on build). This works on GitHub Pages, Cloudflare Pages, and any static host.

## Adding a model

**Default source is Sketchfab (downloadable only).** Put `SKETCHFAB_API_TOKEN` in repo-root `.env` (see `.env.example`).

1. Search downloadable models:
   ```bash
   npm run search-sketchfab -- "Eiffel Tower"
   ```
   Web equivalent: https://sketchfab.com/search?features=downloadable&q=Eiffel+Tower&type=models  
   Prefer [nazidefenseforceofficial](https://sketchfab.com/nazidefenseforceofficial/models) when they have a match. Skip Editorial / Standard / NC.
2. Put `public/models/{id}/model.glb` + `license.json` in git. Optional helper: add `{ id, uid, scaleAxis, notes }` to `scripts/fetch-sketchfab.mjs` and run `npm run fetch-sketchfab -- --only={id} --force`.
3. Catalog: real-world meters, `scaleAxis`, and `yawDegrees` so **+Z is nose / length** (Facing 0°). Tags in `src/data/catalogTags.ts`.
4. In the viewer, confirm the silhouette is cropped (no empty hangar), it sits on the ground, and scale matches person-male (1.75 m).

Prefer exterior-only GLBs. Skip studio floors, terrain, and MSFS/sim kits that hide lights by teleporting them thousands of meters away.

Manual drop-in (if you already have a redistributable GLB):

1. Create `public/models/{id}/`.
2. Put a colored **GLB** at `model.glb` (convert OBJ → GLB first when needed).
3. If the GLB references external textures, put them at the URI path the GLB asks for.
   `npm run fetch-models` rewrites Kenney’s `Textures/` → `textures/` so Vite case-matching works.
4. Add `license.json` with `author`, `license`, `source`, `sourceAsset` (and `attribution` for CC-BY).
   **Only permissive redistributable licenses** (CC0, CC-BY, MIT, Apache-2.0, BSD, NASA media, etc.).
5. Register the item in `src/data/catalog.ts` and run `npm run sync-attributions`.

## Scale rules

Asset files are **not** assumed to be authored in meters. At load time Babylon:

1. Drops helper / needle / below-gear meshes so the AABB matches the visible hull
2. Measures that box and uniformly scales so `scaleAxis` matches the catalog meters
3. Places contact (tires/gear when present) on the ground plane

Pick `scaleAxis` as the dimension you trust most (usually `length` for vehicles, `height` for people/buildings). Authoring yaw must put length on Z and width on X before that scale.

## Licenses

Only add assets that allow redistribution (CC0, MIT, Apache-2.0, CC-BY with attribution in `license.json`, etc.). Keep the original author/source URL in each `license.json`.

## Refreshing assets

```bash
npm run fetch-models       # Kenney CC0 vehicles / characters / buildings
npm run fetch-open-models  # older Quaternius/etc pulls (prefer Sketchfab going forward)
npm run search-sketchfab -- "Eiffel Tower"  # downloadable Sketchfab search (needs SKETCHFAB_API_TOKEN in .env)
npm run fetch-sketchfab    # curated Sketchfab GLBs (needs SKETCHFAB_API_TOKEN in .env)
npm run generate-props     # remaining placeholders (bike, bombs)
```

### Sketchfab

1. Create/log into Sketchfab  
2. Settings → Password → copy **API Token** into repo-root `.env` as `SKETCHFAB_API_TOKEN=` (see `.env.example`)  
3. Search downloadable models, then fetch:

```bash
npm run search-sketchfab -- "Eiffel Tower"
npm run fetch-sketchfab -- --only=eiffel --force
```

Web UI filter: https://sketchfab.com/search?features=downloadable&q=Eiffel+Tower&type=models

Or manually download a GLB from the model page into `public/models/{id}/model.glb`.

CC-BY assets require attribution — see each folder’s `license.json`.

Rocket GLBs (Electron through Starship, including N1) are fetched from Sketchfab via `npm run fetch-sketchfab` — see each folder’s `license.json`.

The N1 mesh is recolored after download (`scripts/paint-n1.mjs`) to the historical olive lower stages + off-white upper section.
