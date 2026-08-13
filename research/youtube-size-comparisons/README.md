# YouTube size-comparison research (for MagnitudeMap catalog planning)

**Captured:** 2026-08-11  
**Method:** `yt-dlp` YouTube search sample across queries like `size comparison 3d animation`, `animal size comparison`, `dinosaur size comparison`, `universe size comparison`, `MetaBallStudios`, tanks, nuclear, monsters, aircraft, ships.  
**Scope:** Not an exhaustive ranking of all YouTube — ordered **within this research sample**. View counts change over time.

## Files

| File | Contents |
|------|----------|
| `README.md` | This analysis + recommendations |
| `curated-top30.json` | Hand-curated top table (category + objects + URLs) |
| `recommendations.json` | Suggested MagnitudeMap categories / objects |
| `yt-dlp-sample-top50.json` | Raw-ish scrape of top ~50 by views from the sample |

## Headline findings

- Highest raw views are **cosmic** ladders (planets → stars → galaxies), e.g. Alex Evett ~162M.
- Best **earth-ground** demand (fits MagnitudeMap’s neighborhood slab): **animals**, **giant statues**, **nuclear**, **movie monsters / kaiju**, **tanks**, **dinosaurs**, **ships / aircraft**.
- MagnitudeMap already covers: nukes/bombs, rockets, fighters, partial landmarks, street vehicles, Stargate fiction.
- Biggest unmet earth-scale gaps: **animals**, **dinosaurs**, **more statues**, **large ships/airliners**, **kaiju**.

## Category demand (approx. sample view sums, millions)

Sums of tabulated videos assigned to each category (approximate):

| Category | ~Sample views (M) |
|----------|-------------------|
| Cosmic (planets/stars/asteroids) | 262 |
| Fiction / monsters / mecha | 87 |
| Animals (living + fish) | 87 |
| Nuclear / explosions | 60 |
| Statues / landmarks | 58 |
| Military vehicles (tanks) | 18 |
| Dinosaurs | 14 |
| Disasters (tsunami/tornado) | 19 |
| Sci-fi ships | 5 |
| Aircraft | 4 |

## Top videos (curated table, by views)

| # | Views | Category | Video | Channel | Objects shown |
|---|------:|----------|-------|---------|---------------|
| 1 | 162M | Cosmic | Universe Size Comparison 3D | Alex Evett | Moons, planets, stars (UY Scuti), black holes, galaxies |
| 2 | 58M | Statues / landmarks | Tallest statue size comparison | Real Data | Statue of Unity, Guishan Guanyin, Buddhas, Motherland Calls, Statue of Liberty |
| 3 | 49M | Cosmic | Universe Size Comparison \| Stars Real Scale | Global Data | Planets, stars, cosmic scale ladder |
| 4 | 32M | Cosmic | ASTEROIDS Size Comparison | MetaBallStudios | Near-Earth asteroids through Ceres vs NYC |
| 5 | 26M | Nuclear / explosions | The True Scale Of Modern Nuclear Weapons | Science Time | B83, RS-28 Sarmat, modern warheads vs WWII |
| 6 | 23M | Animals | Animal, Dinosaur, and Sea Monster Eyeballs | Data Brain | Eyeballs of animals, dinosaurs, sea monsters |
| 7 | 21M | Animals | ANIMAL size in perspective | MetaBallStudios | Living animals, insects → whale / elephants |
| 8 | 18M | Fiction / monsters | Eye Size Comparison \| Monster Eyes | Data Ball | Monster / creature eye scales |
| 9 | 18M | Military vehicles | Crazy German Tanks Size Comparison 3D | AmazingViz | German WWII / prototype tanks |
| 10 | 18M | Animals | Animal Size Comparison \| Real Scale | Global Data | Animals true-scale 3D |
| 11 | 17M | Nuclear / explosions | Most DESTRUCTIVE EXPLOSIONS comparison | MetaBallStudios | Historic / cinematic explosion yields |
| 12 | 17M | Nuclear / explosions | The Terrifying True Scale of Nuclear Weapons | RealLifeLore | Modern nuclear arsenal visualization |
| 13 | 16M | Animals | Animal Size Comparison 3D | Reigarw Comparisons | Animals true-scale lineup |
| 14 | 16M | Fiction / monsters | (Movie) MONSTERS Size COMPARISON | MetaBallStudios | Godzilla, Kong, movie kaiju |
| 15 | 14M | Fiction / monsters | MONSTER SIZES — First person view | MetaBallStudios | Movie/TV monsters, street-scale FP |
| 16 | 13M | Disasters | TSUNAMI Height Comparison (3D) | RED SIDE | Tsunami heights vs buildings / people |
| 17 | 12M | Cosmic | Universe Size in Perspective 2024 | Global Data | Atom → planets → stars → cosmos |
| 18 | 10M | Fiction / monsters | Legendary Sea Monsters Size Comparison | MetaVine Labs | Bloop, sea eater, marine cryptids |
| 19 | 9.4M | Fiction / mecha | MECHAS (piloted robots) SIZE COMPARISON | MetaBallStudios | Gundam / anime / game mechs |
| 20 | 9.2M | Dinosaurs | Dinosaur Size Comparison (60FPS) | Global Data | Dinosaurs → sauropods |
| 21 | 8.7M | Animals | FISH Size Comparison 3D | Global Data | Fish species ladder |
| 22 | 8.4M | Fiction / monsters | Attack on Titan Size Comparison 2024 | Global Data | AoT Titans vs humans / walls |
| 23 | 7.4M | Fiction / monsters | (Video game) MONSTERS Size COMPARISON | MetaBallStudios | Game bosses / monsters |
| 24 | 7.0M | Micro / biology | MICROORGANISMS Size Comparison | MetaBallStudios | Microbes, cells |
| 25 | 6.9M | Cosmic | Solar System Size In Perspective | Global Data | Solar system bodies |
| 26 | 6.4M | Disasters | Tornado Size Comparison | InfoGeek | Tornado EF-scale sizes |
| 27 | 5.4M | Fiction / monsters | SEA MONSTERS Size Comparison | MetaBallStudios | Sea monsters / cryptids |
| 28 | 5.2M | Dinosaurs | DINOSAURS \| 3D Comparison | MetaBallStudios | Dinosaur species lineup |
| 29 | 5.0M | Sci-fi ships | Biggest STARSHIPS 3D Comparison | MetaBallStudios | Movie/TV/game starships |
| 30 | 4.4M | Aircraft | Aircraft Size Comparison 3D | Reigarw Comparisons | Civil / military aircraft |

Exact IDs/URLs/view integers: see `curated-top30.json` and `yt-dlp-sample-top50.json`.

## Recommendations for MagnitudeMap

Prioritized by **demand × fit** for an earth-slab true-scale viewer.

### P0 — Living giants (animals)

- **Why:** Multiple 16–21M+ videos; largest unmet earth-scale gap.
- **Lineup:** Living giants  
- **Add:** Blue whale, African elephant, giraffe, polar bear, great white, horse, dog, house cat, ant (+ person)  
- **Fit:** Excellent

### P0 — Dinosaurs

- **Why:** ~14M combined in sample; evergreen educational demand.
- **Lineup:** Dinosaurs  
- **Add:** Compsognathus, Velociraptor, Stegosaurus, T. rex, Brachiosaurus, Argentinosaurus  
- **Fit:** Excellent

### P1 — Giant statues

- **Why:** Single statue video ~58M; catalog mostly has Liberty among statues.
- **Lineup:** Giant statues  
- **Add:** Statue of Unity, Spring Temple Buddha, Motherland Calls, Christ the Redeemer  
- **Fit:** Excellent (extends Landmark heights)

### P1 — Kaiju / movie monsters

- **Why:** MetaBall monster videos 13–16M; fiction already converts (Stargate).
- **Lineup:** Movie monsters  
- **Add:** Godzilla (era variants), King Kong, Cloverfield, Xenomorph (small→huge fiction ladder)  
- **Fit:** Good — fan-scale; watch CC licenses

### P1 — Large ships & airliners

- **Why:** Aircraft comparisons + classic tanker/ship tropes; carrier already works.
- **Lineup:** Ships & airliners  
- **Add:** Seawise Giant / TI-class tanker, Titanic, Oasis-class, A380, 747, C-5 Galaxy  
- **Fit:** Excellent

### P2 — Expand tanks / nukes

- **Why:** German-tank video ~18M; nuke explainers 16–26M.
- **Add:** Tiger I, Panther, Maus; optional yield markers (Ivy Mike / Castle Bravo) while keeping physical bomb casings  
- **Fit:** Good — Abrams/Sherman/Little Boy/Fat Man/Tsar already present

### P3 — Cosmic (optional later)

- **Why:** Highest raw views, but breaks neighborhood-ground metaphor.
- **Add (near-Earth only):** Moon, ISS, city-scale asteroid; skip full star ladder until a separate space mode  
- **Fit:** Stretch

## Suggested build order

1. **Living giants (animals)** — person → dog → horse → bear → giraffe → elephant → blue whale  
2. **Dinosaurs** — raptor → Stegosaurus → T. rex → Brachiosaurus → Argentinosaurus  
3. **Giant statues + ships/airliners** — Unity / Redeemer; Titanic or A380 beside Ford carrier  
4. Defer full cosmic mode; asteroid-vs-city is the only cosmic beat that fits the current ground slab

## Notes / caveats

- Object lists for some videos are inferred from titles, tags, and channel descriptions — not a frame-accurate shot list.
- Sketchfab additions still require CC0 / CC-BY / CC-BY-SA + downloadable (no Standard / Editorial / Store-only).
- Re-run research later with `yt-dlp` if view ranks need refreshing.
