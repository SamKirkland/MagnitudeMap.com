# Agent notes (MagnitudeMap)

## 3D models: Sketchfab by default

When searching for or replacing 3D models in this repo, use **Sketchfab** and the API token in repo-root `.env` (`SKETCHFAB_API_TOKEN`). Do not commit `.env`.

Filter to **downloadable** models:

- Helper: `npm run search-sketchfab -- "Eiffel Tower"`
- Web: https://sketchfab.com/search?features=downloadable&q=Eiffel+Tower&type=models
- API: `GET https://api.sketchfab.com/v3/search?type=models&q=Eiffel+Tower&downloadable=true` with `Authorization: Token $SKETCHFAB_API_TOKEN`

Prefer [nazidefenseforceofficial](https://sketchfab.com/nazidefenseforceofficial/models) when they have a suitable CC-licensed match.

**Ship only** CC0 / CC-BY / CC-BY-SA. Skip Editorial, Standard, NonCommercial, and anything that is not downloadable. If a requested Sketchfab link is not redistributable, find a downloadable CC stand-in and record the substitution in `scripts/fetch-sketchfab.mjs`.

## Commit the GLB — fetch is optional

`public/models/{id}/model.glb` and `license.json` are the runtime source of truth. **Commit them.** A clone / Pages deploy must work without running any fetch script.

`npm run fetch-sketchfab` is only a helper to download a Sketchfab GLB and write `license.json`. You can also drop a redistributable GLB in by hand and run `npm run sync-attributions`.

## Every new or replaced model

1. **Inspect** the file. Prefer a recognizable exterior, ≲200k tris, no studio floor / terrain / MSFS cockpit dump. Sim kits often hide lights and bombs by teleporting nodes to y≈−8192 — that inflates the bounding box into a huge empty volume (B-21).
2. **Orient** in `src/data/catalog.ts`. Authoring `yawDegrees` / `pitchDegrees` / `rollDegrees` must put the GLB in **+Y up, +Z nose/length, +X width**. Verify at Facing **0°** (user rotate is a separate parent).
3. **Crop and ground.** No dead space around the silhouette. Wheels or gear on the ground plane — not floating on engine nacelles or a helper mesh below the hull (747). Runtime crop in `ComparisonScene` is a safety net; still pick a clean asset.
4. Register real-world meters + `scaleAxis`, tags in `src/data/catalogTags.ts`, then confirm scale against person-male (1.75 m).

See `public/models/README.md` and `.cursor/rules/model-import.mdc`.
