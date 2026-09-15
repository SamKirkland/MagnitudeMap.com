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

### `license.slug` is not enough — read the description

A CC licence is only valid if the uploader owns the work. Game rips, asset-store resales and re-uploads of someone else's model are routinely tagged CC-BY on Sketchfab, and that tag conveys **nothing** — the uploader cannot license Activision's or Paramount's asset. A model with a valid-looking `license.slug` and stolen provenance is worse than a clearly-restricted one, because nothing in the API flags it.

So for every candidate, **read `description` and `tags` from the `/v3/models/{uid}` response** before downloading. Reject on any admission of third-party origin:

- `ripped`, `rip from`, `extracted from`, `datamined`, `ported from`
- a named game or engine as the *source* of the geometry — `from CoD`, `from Battlefield`, `from STO`, `from GTA`, `Star Citizen`, `War Thunder`, `DCS`, `MSFS`
- "not my model", "credit to the original author", "found this online", a re-upload credit to someone else

A game *name* alone is not disqualifying — `unity`, `unreal`, `blender`, `maya` as the **tool** are fine, and so is fan-made work that is the uploader's own geometry. What matters is whether the uploader made it. Positive signals: "modelled in Maya", "textured in Substance/Zbrush", a WIP or turntable history, a coherent portfolio of original work.

Judge the **account**, not just the model. If an uploader's other models are admitted rips, treat everything from that account as unusable even where a particular description is silent — 42manako is a known rip channel (`mi-24` shipped from there before this rule existed).

Recording the check: put the provenance evidence in `license.json` `notes` — one clause naming what establishes the uploader as the author, e.g. `"Original work — 'Modelled in Maya and Textured in Zbrush', no third-party source claimed."` A `license.json` with no provenance note has not been checked.

Separately, a clean licence does not clear **design IP**. Real-world hardware is fine; a faithful model of a Star Trek or Star Wars ship is the studio's design however it was built, and that is a judgement call for the repo owner, not something a licence field settles.

```bash
# provenance check, before download
curl -s -H "Authorization: Token $SKETCHFAB_API_TOKEN" \
  "https://api.sketchfab.com/v3/models/{uid}" \
  | python -c "import sys,json;d=json.load(sys.stdin);print(d['user']['displayName']);print([t['slug'] for t in d.get('tags',[])]);print((d.get('description') or '')[:800])"
```

## Commit the GLB

`public/models/{id}/model.glb` and `license.json` are the runtime source of truth. **Commit them.** A clone / Pages deploy must work from those files alone.

After writing a new or replaced GLB:

1. Run `npm run compress-models -- --only={id}` (skips files that already have Draco/meshopt).
2. Run `npm run generate-lods -- --only={id}`, and commit the `model.lod*.glb` it writes
   along with the updated `src/data/modelLods.ts`.
3. Run `npm run sync-attributions`.

Do not leave uncompressed GLBs in `public/models/`. Production `build` / `build:static` also run `compress-models` and no-op already-compressed files.

## Every new or replaced model

1. **Inspect** the file. Prefer a recognizable exterior, ≲200k tris, no studio floor / terrain / MSFS cockpit dump. Sim kits often hide lights and bombs by teleporting nodes to y≈−8192 — that inflates the bounding box into a huge empty volume (B-21).
2. **Orient** in `src/data/catalog.ts`. Authoring `yawDegrees` / `pitchDegrees` / `rollDegrees` must put the GLB in **+Y up, +Z nose/length, +X width**. Verify at Facing **0°** (user rotate is a separate parent).
3. **Crop and ground.** No dead space around the silhouette. Wheels or gear on the ground plane — not floating on engine nacelles or a helper mesh below the hull (747). Runtime crop in `ComparisonScene` is a safety net; still pick a clean asset.
4. Register real-world meters + `scaleAxis`, tags in `src/data/catalogTags.ts`, then confirm scale against person-male (1.75 m).
5. **Verify scale:** `npm run verify-models -- --only={id}`. Reads the GLB, applies catalog yaw/pitch/roll, crops helpers the same way the viewer does, and checks that length/width/height match catalog meters after the trusted `scaleAxis` is forced. With `--only`, it also screenshots the model next to person-male (`tmp/verify-models/`). Open those PNGs: Facing 0° must show +Z nose, the silhouette must sit on the ground, and height vs the 1.75 m adult must look right.
6. **Lineups.** Put the item in **at least one** lineup in `COMPARISON_PRESETS` (`src/data/catalog.ts`), and check it is not sitting in a wrong one. Lineup cards are the only crawl path to the `/c/` pages, so an item in no lineup is reachable only by searching the library for it by name. `npm test` fails if anything is homeless.
7. **Facts** in `src/data/catalogFacts.ts`, authored in metric (see the metric section below).
8. **Compress** with `npm run compress-models -- --only={id}`, then
   `npm run generate-lods -- --only={id}`, then `npm run sync-attributions`.
9. **`npm test`** — catches homeless items, broken lineup ids, and metric prose the imperial converter cannot handle.

### Import checklist

Copy this into the task and tick it off. Steps 4–7 are the ones that get skipped.

```text
[ ] license: CC0 / CC-BY / CC-BY-SA and isDownloadable (never Editorial / Standard / NC)
[ ] provenance: read description + tags; no rip / re-upload admission; uploader is the author
[ ] animations: stripped, with the intended pose (gear down, etc.) baked into node TRS
[ ] public/models/{id}/model.glb committed, plus license.json with author + source + attribution
[ ] catalog entry: real-world metres, scaleAxis, shape, category, colour, blurb
[ ] orientation: +Y up, +Z nose/length, +X width at Facing 0 (yaw/pitch/rollDegrees)
[ ] tags in src/data/catalogTags.ts
[ ] facts in src/data/catalogFacts.ts (metric prose)
[ ] LINEUP: added to >=1 preset in COMPARISON_PRESETS, and in the right one
[ ] npm run verify-models -- --only={id}   (open the PNGs, do not just read PASS)
[ ] npm run compress-models -- --only={id}
[ ] npm run generate-lods -- --only={id}   (commit the model.lod*.glb + src/data/modelLods.ts)
[ ] npm run sync-attributions
[ ] npm test && npx tsc --noEmit
```

### Do not delete rotor discs

`verify-models` flags any wide, thin, flat mesh as a `ground-plate` ("looks like a studio floor / shadow slab"). On a **helicopter** that shape is also exactly a **rotor disc** — a coaxial type like the S-97 Raider has two stacked ones. Before deleting a flagged mesh, check its height off the ground and whether the aircraft still has all its blades afterwards. Deleting the lower disc of a coaxial rotor passes `verify-models` and looks obviously wrong in the viewer.

### Strip animations, bake the pose you want

The viewer renders the **rest pose** — the TRS on each node — and never plays animation tracks. So an animated asset ships in whatever pose the exporter happened to leave in the file, which is frequently the wrong one: landing gear retracted, canopies open, weapons bays hanging.

Do not ship the animation and hope. Sample the track, pick the time index that shows the pose you want, write those values into the nodes' TRS, then delete the animation:

1. List channels and their target nodes (`@gltf-transform/core`, already a devDependency).
2. Sample each channel across the timeline and identify which plateau is the pose you want — check a node's local translation against a known-up reference in the same space (a tail rotor's +Y) rather than guessing which end of the track is "deployed".
3. Write the sampled values back with `node.setTranslation/setRotation/setScale`, then `anim.dispose()`.
4. Re-run `verify-models` — the bounding box changes when gear drops, so height and ground contact both move.

Rotors freeze wherever the rest pose leaves them, which is what we want; blades must not read as motion-blurred or mid-spin.

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

## Level of detail

`npm run generate-lods` writes `model.lod1.glb` / `model.lod2.glb` beside every
`public/models/{id}/model.glb` (and the ground plates), plus the generated
manifest `src/data/modelLods.ts`. **Commit all of it** — same rule as the GLB
itself. `build` / `build:static` run the script and no-op when the source hash
in the manifest still matches, so a normal build costs nothing.

The far level exists so a zoomed-out stage can carry hundreds of objects: a
Venator goes from 402k triangles / 22.5 MB to 8k / 675 KB, joined into one
primitive per material. It is not meant to survive close inspection — it is
meant to keep the silhouette at 50 px.

Levels are fetched lazily, per model, the first time the camera pulls back far
enough to want one, and the switch is by apparent size in pixels rather than raw
distance (`src/babylon/modelLod.ts`). `window.__mmLodPin = 0 | 1 | 2` pins every
model to one level for eyeballing a threshold; `null` restores automatic. Level
counts show up in `window.__mmPerf.lodLevels`, finest first.

**Skinned and animated GLBs get no LODs.** A skinned level would arrive with its
own skeleton, and the viewer poses skeletons per placement (rest pose, T-pose
relaxation, the clip it plays on focus); an animated one would have LOD2's
flatten/join bake whatever rest pose the exporter left, which is routinely the
wrong one (`poseAtClipEnd` exists because of this). Both are the obvious next
step if people models start dominating a scene. Models under ~4k triangles are
skipped too — there is nothing to win.

The generator re-implements the viewer's helper crop (`cropHelpers` in
`scripts/generate-lods.mjs`). It has to: LOD2 joins everything into one
primitive, so a sim "teleport to y=-8192" dummy that is still present at that
point is welded into the silhouette permanently. Keep it in lockstep with
`cropMeshBoxes` in `src/modelVerify.ts` and `ComparisonScene.cropImportedModel`.
