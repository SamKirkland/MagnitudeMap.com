# MagnitudeMap

Compare the real-world sizes of almost anything — bombs, guns, tanks, starships, everyday objects, or your own models — side by side in the browser.

## What this is

MagnitudeMap is a **static, client-side** size-comparison viewer. Users place objects next to each other at true scale so “how big is X compared to Y?” is something you can see, not guess.

Ship a curated library of default 3D models (OBJ and similar formats). Also let people drag in their own models and compare those against the library or against each other.

## Goals

1. **True-scale comparison** — Put any objects in the same scene at accurate relative size so differences are obvious at a glance.
2. **Preset library** — Include a starter set of models people actually want to compare (weapons, vehicles, spacecraft, munitions, reference objects, etc.).
3. **Custom uploads** — Support dragging in custom OBJ / similar model files and comparing them with presets or other customs.
4. **Client-side first** — Do as much as possible in the browser (loading, rendering, interaction). No required backend.
5. **Static hosting only** — Build output must be plain static files. Hostable on GitHub Pages, Cloudflare Pages, Netlify, S3, or any static file host.
6. **Cheap to run** — Prefer self-hosted tilemaps / map data and static assets over services that bill per request or per user.
7. **Simple to use** — Pick from a list, drop a file, move things around, and understand scale without a learning curve.

## Hard constraints

| Constraint | Meaning |
| --- | --- |
| **No Next.js** | Do not use Next.js, SSR, ISR, or server components. |
| **Static build only** | `npm run build` produces a fully static `dist/` (HTML/CSS/JS/assets). |
| **No paid usage APIs** | Avoid Mapbox, paid geocoders, or anything that charges per user/request for core features. |
| **Self-host maps & assets** | Host tilemaps, textures, and model files yourself (or use free/static alternatives). |
| **No required server** | Core compare flows must work with zero API routes / serverless functions. |
| **Permissive model licenses only** | See [Asset licensing](#asset-licensing) below. |

## Asset licensing

**Only ship 3D models under a redistributable permissive license**, for example:

- **CC0** / public domain
- **CC-BY** (3.0 / 4.0) — attribution required
- **CC-BY-SA** — attribution + share-alike
- **MIT**, **Apache-2.0**, **BSD**
- **NASA media** (and similar government works) when redistribution is allowed — follow the agency guidelines and credit the source

**Do not** add models that are:

- Sketchfab **Editorial** (news/public-interest only — not OK to redistribute on a general site)
- Sketchfab **Standard** / non-downloadable store licenses
- **CC-BY-NC** / NonCommercial licenses (site redistributes assets publicly)
- “Free to use” but **non-redistributable** / personal-use only
- Royalty-free store assets without an explicit redistributable license
- All-rights-reserved Sketchfab uploads (even if viewable in the viewer)
- Scraped / cracked packs

### Attribution workflow

1. Every model folder needs `public/models/{id}/license.json` with at least `author`, `license`, `source`, and `sourceAsset`.
2. Run `npm run sync-attributions` to refresh `src/data/attributions.ts`.
3. In the Library, the info icon toggles author/license under each model.

## Target comparisons

Examples of what users will want to line up:

- Bomb / munition sizes
- Gun and small-arms sizes
- Tank and armored vehicle sizes
- Starship / spacecraft sizes
- Everyday reference objects (person, car, building, etc.) for scale context

## Planned features

### MVP (focus now)

- [x] 3D scene for placing and viewing models at real scale (Babylon.js, stand-in meshes)
- [x] Curated preset list with known real-world dimensions + sample comparisons
- [x] Sidebar to add / remove / select presets
- [x] Static `public/models/` hosting + GLB load/scale-to-meters pipeline
- [ ] Drag-and-drop (or file picker) for custom OBJ / similar models
- [x] Basic camera controls (orbit, pan, zoom)
- [x] More CC landmark GLBs (Eiffel, Burj, Big Ben, Colosseum, Giza, Golden Gate, …)
- [ ] Landmark stage packs (NYC / Dubai / Paris) with real meshes
- [ ] Cheap, self-hosted map / ground reference if a map plane is used (no paid tile APIs)

### Later

- [ ] Save / share comparison layouts (URL hash/query state or client-side export)
- [ ] Categories and search over the preset library
- [ ] Measurement overlays (length, height, distance between objects)
- [ ] Better materials / LOD for large models
- [ ] Mobile-friendly layout and touch controls

## Tech stack

- **Vite** + **React** + **TypeScript** → static SPA
- **Babylon.js** for the 3D comparison viewer (React UI shells the canvas; scene is non-reactive)
- **Tailwind CSS** + custom panel styles for UI
- Colored GLB models live under `public/models/{id}/` (committed + static-hosted; see `public/models/README.md`)
- `npm run compress-models` Draco-compresses those GLBs in place; already-compressed files are skipped. `build` / `build:static` run this first.

## Architecture notes

- Prefer loading models and map tiles as static assets the client fetches directly.
- Store real-world scale metadata with each preset (e.g. length/height in meters) so imports can be normalized to true size.
- Custom uploads stay in-memory / local to the session (File / Object URL); no upload server.
- Deploy the contents of `dist/` anywhere that serves static files.

## Getting started

```bash
npm install
npm run dev
```

Open the local Vite URL (usually [http://localhost:5173](http://localhost:5173)).

### Production build

```bash
npm run build
npm run preview
```

`dist/` is the deployable static site. Point GitHub Pages, Cloudflare Pages, or any static host at that folder (or the build output of your CI).

## Project status

Early prototype. Vite static SPA + Babylon.js viewer with sample true-scale comparisons (stand-in primitives). Next: real GLB/OBJ assets, custom uploads, and landmark stage packs.
