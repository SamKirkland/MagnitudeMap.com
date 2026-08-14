# Models

Static, redistributable 3D assets loaded by the site at runtime from this folder. **Commit `model.glb` and `license.json`.** A clone does not need to download anything.

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

**Default source is Sketchfab (downloadable only).**

1. Search downloadable models: https://sketchfab.com/search?features=downloadable&q=Eiffel+Tower&type=models  
   Prefer [nazidefenseforceofficial](https://sketchfab.com/nazidefenseforceofficial/models) when they have a match. Skip Editorial / Standard / NC.
2. Download the GLB from the model page into `public/models/{id}/model.glb` and add `license.json`. Commit both.
3. Catalog: real-world meters, `scaleAxis`, and `yawDegrees` so **+Z is nose / length** (Facing 0°). Tags in `src/data/catalogTags.ts`.
4. In the viewer, confirm the silhouette is cropped (no empty hangar), it sits on the ground, and scale matches person-male (1.75 m).
5. Run `npm run sync-attributions`.
6. `npm run compress-models` Draco-compresses new GLBs in place and no-ops files that already have Draco/meshopt. The production build runs this automatically.

Prefer exterior-only GLBs. Skip studio floors, terrain, and MSFS/sim kits that hide lights by teleporting them thousands of meters away.

If a requested Sketchfab link is Editorial / Standard / not downloadable, pick a downloadable CC stand-in and record the substitution in that folder’s `license.json` `notes`.

Manual drop-in (if you already have a redistributable GLB):

1. Create `public/models/{id}/`.
2. Put a colored **GLB** at `model.glb` (convert OBJ → GLB first when needed).
3. If the GLB references external textures, put them at the URI path the GLB asks for (use lowercase `textures/` so Vite case-matching works).
4. Add `license.json` with `author`, `license`, `source`, `sourceAsset` (and `attribution` for CC-BY).
   **Only permissive redistributable licenses** (CC0, CC-BY, MIT, Apache-2.0, BSD, NASA media, etc.).
5. Register the item in `src/data/catalog.ts` and run `npm run sync-attributions`.
6. Run `npm run compress-models` (or let the next production build do it).

## Scale rules

Asset files are **not** assumed to be authored in meters. At load time Babylon:

1. Drops helper / needle / below-gear meshes so the AABB matches the visible hull
2. Measures that box and uniformly scales so `scaleAxis` matches the catalog meters
3. Places contact (tires/gear when present) on the ground plane

Pick `scaleAxis` as the dimension you trust most (usually `length` for vehicles, `height` for people/buildings). Authoring yaw must put length on Z and width on X before that scale.

## Licenses

Only add assets that allow redistribution (CC0, MIT, Apache-2.0, CC-BY with attribution in `license.json`, etc.). Keep the original author/source URL in each `license.json`.
