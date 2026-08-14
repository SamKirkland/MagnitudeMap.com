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
5. **Compress** with `npm run compress-models -- --only={id}`, then sync attributions.

See `public/models/README.md` and `.cursor/rules/model-import.mdc`.
