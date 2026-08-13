/**
 * Optional helper: download curated Sketchfab models into public/models/.
 * Runtime loads the committed GLBs — you do not need this script to build or
 * clone the site. Commit public/models/{id}/model.glb + license.json.
 *
 * Requires a Sketchfab API token:
 *   https://sketchfab.com/settings/password  → API → Password / API Token
 *
 * Token is read from repo-root .env (SKETCHFAB_API_TOKEN). To find models:
 *   npm run search-sketchfab -- "Eiffel Tower"
 *   https://sketchfab.com/search?features=downloadable&q=Eiffel+Tower&type=models
 *
 *   npm run fetch-sketchfab
 *   npm run fetch-sketchfab -- --only=eiffel --force
 *
 * Or drop a manually downloaded GLB at public/models/{id}/model.glb and re-run
 * with --licenses-only to refresh license.json from the Sketchfab API.
 */
import {
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const modelsDir = join(rootDir, 'public', 'models')
const licensesOnly = process.argv.includes('--licenses-only')
const force = process.argv.includes('--force')
const onlyArg = process.argv.find((a) => a.startsWith('--only='))
const onlyIds = onlyArg
  ? new Set(
      onlyArg
        .slice('--only='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
  : null

/** Load KEY=VALUE pairs from repo-root .env into process.env (no dependency). */
function loadDotEnv() {
  const envPath = join(rootDir, '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadDotEnv()

/** Catalog id → Sketchfab model UID (must be downloadable + redistributable: CC0 / CC-BY / CC-BY-SA). */
const MODELS = [
  {
    id: 'starship',
    uid: 'f76be07d358f454b8396d4e8f1cc5329',
    scaleAxis: 'height',
    notes: 'SpaceX Starship Ship S25 & Booster 9. Scaled to 121 m height in-app.',
  },
  {
    id: 'little-boy',
    uid: '9781b3622a4746baaf830039e4868a51',
    scaleAxis: 'length',
    notes: 'Little Boy (CC-BY-SA). Scaled to 3.0 m length in-app.',
  },
  {
    id: 'fat-man',
    uid: 'e02f187f4bf04802b8df02eb0175224e',
    scaleAxis: 'length',
    notes: 'Fat Man (CC-BY). Scaled to 3.25 m length in-app.',
  },
  {
    id: 'tsar-bomba',
    uid: '1a66b20985d74fd7adf01a694a2fa4bc',
    scaleAxis: 'length',
    notes: 'AN602 Tsar Bomba (CC-BY). Scaled to 8.0 m length in-app.',
  },
  {
    id: 'abrams',
    uid: '10a16c96ca8b4ebc855915f5d5202046',
    scaleAxis: 'length',
    notes: 'M1A2 Abrams (CC-BY). Scaled to 9.77 m length in-app.',
  },
  {
    // Linked Rescue3D Fire Truck is Sketchfab Store / Editorial / not downloadable — Chenzoss CC-BY ladder truck instead.
    id: 'firetruck',
    uid: '5c8d876d997f4eaa939a4778cedcfbfa',
    scaleAxis: 'length',
    notes:
      'Red fire truck with ladder (CC-BY, Chenzoss). Linked Rescue3D model is Store-only. Scaled to 12 m length in-app.',
  },
  {
    id: 'sherman',
    uid: 'e5252c21cd624182862514de993d21f3',
    scaleAxis: 'length',
    notes: 'M4 Sherman Tank Challenger (CC-BY). Scaled to 5.89 m length in-app.',
  },
  {
    id: 'f16',
    uid: '4bc2ff75dc584af2afd0aa6bd8b79015',
    scaleAxis: 'length',
    notes: 'F-16C Falcon (CC-BY). Scaled to 15.06 m length in-app.',
  },
  {
    // Linked F-22 is not downloadable — andertan CC-BY instead.
    id: 'f22',
    uid: '7e7b3c372e374dda98e70208d09cfdcf',
    scaleAxis: 'length',
    notes: 'F-22 Raptor (CC-BY). Scaled to 18.92 m length in-app.',
  },
  {
    // Linked F-35 is Editorial / not downloadable — AF267 F-35B CC-BY instead.
    id: 'f35',
    uid: '5d54a6af45974ad386ae74d42b33374a',
    scaleAxis: 'length',
    notes:
      'F-35B Lightning II (CC-BY). Tiny gear-animation helper meshes stripped from the GLB. Scaled to 15.61 m length in-app.',
  },
  {
    id: 'ford-carrier',
    uid: 'b9c4d0ca6c0c4fe684a8cae0f589a901',
    scaleAxis: 'length',
    notes: 'USS Enterprise CVN-80 (Ford-class) by nazidefenseforceofficial (CC-BY). Scaled to 337 m length in-app.',
  },
  {
    // Linked Acme Eiffel (7aa4aca8…) is Editorial / not downloadable.
    // Polskaball had a Google Earth ground plane that blew the AABB — SDC PERFORMANCE print-ready CC-BY instead.
    id: 'eiffel',
    uid: '8553f94d06e24cb4b0fde1080f281674',
    scaleAxis: 'height',
    notes: 'Tour Eiffel (CC-BY, SDC PERFORMANCE). No studio ground. Scaled to 330 m height in-app.',
  },
  {
    // Linked Zhang Shangbin Big Ben is Sketchfab Standard / not downloadable — ManySince910 CC-BY instead.
    id: 'big-ben',
    uid: '9a1c691fac774bcca4e2ba565c4c9d9b',
    scaleAxis: 'height',
    notes: 'Clock Tower / Big Ben (CC-BY). Scaled to 96 m height in-app.',
  },
  {
    // Linked Pikoandniki Colosseum is Editorial / not downloadable — Carlos.Maciel CC-BY instead.
    id: 'colosseum',
    uid: 'e749705838044be78ced42205f9f9dda',
    scaleAxis: 'length',
    notes: 'Colosseum reconstruction (CC-BY). Scaled to 189 m length in-app.',
  },
  {
    // Linked Zhang Shangbin Washington Monument is Standard / not downloadable — Takugava3DS CC-BY instead.
    id: 'washington-monument',
    uid: '8003b43ffd784caaab03b8b277f39b96',
    scaleAxis: 'height',
    notes: 'Washington Monument (CC-BY). Scaled to 169.3 m height in-app.',
  },
  {
    id: 'burj',
    uid: 'c1d6f5884c9c4a56b8d8f9c5555f1902',
    scaleAxis: 'height',
    notes: 'Burj Khalifa Dubai (CC-BY). Scaled to 828 m height in-app.',
  },
  {
    // Linked lewis_drummerr Stonehenge is Standard / not downloadable — Sereib CC-BY instead.
    id: 'stonehenge',
    uid: 'b43f5366560f48498a46812ebcabf3e6',
    scaleAxis: 'height',
    notes: 'Stonehenge (CC-BY). Scaled to 7.2 m lintel height in-app.',
  },
  {
    // Linked astistudio Sydney Opera House is Editorial / not downloadable — Nick Reinhardt CC-BY instead.
    id: 'sydney-opera-house',
    uid: '317b2d540f0a4f7e8d87dd3b0372712d',
    scaleAxis: 'length',
    notes: 'Sydney Opera House (CC-BY). Scaled to 183 m length in-app.',
  },
  {
    // Linked Zhang Shangbin Golden Gate is Standard / not downloadable.
    // JuanG3D was a paper-thin XY card; length scaled the 4 cm thickness to 1.9 km.
    // louis CC-BY is a real 3D span (length already on +Z).
    id: 'golden-gate',
    uid: '33f85548e51b474381f6c5991196b494',
    scaleAxis: 'length',
    notes: 'Golden Gate Bridge (CC-BY, louis). Scaled to 1,966 m anchorage-to-anchorage length in-app.',
  },
  {
    // hencui Giza scan is a rotated plateau photogrammetry (huge terrain AABB).
    // gfrez CC-BY is a single Khufu silhouette; studio ground plane stripped from the GLB.
    id: 'great-pyramids',
    uid: 'ea753397274d4e3f93db5a6a9810aa6f',
    scaleAxis: 'height',
    notes: 'Great Pyramid of Giza / Khufu (CC-BY, gfrez). Ground plane cropped. Scaled to 138.5 m current height in-app.',
  },
  {
    id: 'statue-liberty',
    uid: '84094e8d5e724b5c882cf576ca12e44e',
    scaleAxis: 'height',
    notes: 'Statue Of Liberty by Gravity Jack (CC-BY). Scaled to 93 m torch height in-app.',
  },
  {
    id: 'iphone',
    uid: 'ae46f6a92de042d8bc8082226f7d3489',
    scaleAxis: 'height',
    notes: 'Apple iPhone based mobile phone by Rescue3D (CC-BY). Scaled to 0.147 m height in-app.',
  },
  {
    id: 'tealc',
    uid: '857e5c8f8db1474c99508ed5e2f0c08e',
    scaleAxis: 'height',
    notes: "Teal'c (CC-BY). Scaled to 1.96 m height in-app.",
  },
  {
    id: 'alkesh',
    uid: '3f949ac3f658421db2b102ceb1f9e172',
    scaleAxis: 'length',
    notes: "Al'kesh (CC-BY). Scaled to 45 m length in-app.",
  },
  {
    id: 'daedalus',
    uid: '39c143f7c4634f05830b6896e6a395a0',
    scaleAxis: 'length',
    notes: 'BC-304 Daedalus (CC-BY). Scaled to 536 m length in-app.',
  },
  {
    id: 'puddle-jumper',
    uid: '1bcbde7bf7044592a5b444ffb7c0a658',
    scaleAxis: 'length',
    notes: 'Puddle Jumper (CC-BY). Scaled to 9 m length in-app.',
  },
  {
    // Linked Wraith Cruiser is not downloadable — tomkranis CC-BY instead.
    id: 'wraith-cruiser',
    uid: 'f8853716bf6f479da530eea8d2ed671e',
    scaleAxis: 'length',
    notes: 'Wraith cruiser (CC-BY). Scaled to 3200 m length in-app.',
  },
  {
    // Linked Atlantis is not downloadable — rossrobotics CC-BY instead.
    id: 'atlantis',
    uid: 'cc5e04fc277941b0b37ac7b066dcbb21',
    scaleAxis: 'max',
    notes: 'Atlantis city-ship (CC-BY). Scaled to ~3 km span in-app.',
  },
  {
    id: 'electron',
    uid: '0376dfab27574a909cb8714841379894',
    scaleAxis: 'height',
    notes: 'Rocket Lab Electron (CC-BY, ~53k tris). Scaled to 18 m height in-app.',
  },
  {
    id: 'falcon-9',
    uid: '61067a8b341c4b4b96053d5fa607f232',
    scaleAxis: 'height',
    notes: 'Falcon 9 Block 5 full stack (CC-BY, ~29k tris). Scaled to 70 m height in-app.',
  },
  {
    id: 'soyuz-2',
    uid: '1320bf0fd1b242cd8cfda77d381a147f',
    scaleAxis: 'height',
    notes: 'Soyuz-FG stand-in for Soyuz-2 (CC-BY, ~5k tris). Scaled to 46.1 m height in-app.',
  },
  {
    id: 'new-glenn',
    uid: '61de32fc7f8c4d2a8945662fcd51a172',
    scaleAxis: 'height',
    notes: 'Blue Origin New Glenn (CC-BY, ~19k tris). Scaled to 98 m height in-app.',
  },
  {
    id: 'sls',
    uid: '8f75f222418945058398a77d33625c27',
    scaleAxis: 'height',
    notes: 'Artemis II SLS low-poly (CC-BY, ~12k tris). Scaled to 98 m height in-app.',
  },
  {
    id: 'saturn-v',
    uid: '88f68de3b3e9435582560e02a52b325d',
    scaleAxis: 'height',
    notes: 'Saturn V (BoldlyBuilding CC-BY, ~1.3k verts). Scaled to 110.6 m height in-app.',
  },
  {
    id: 'n1',
    uid: '1ca15f15e01e41ea9a9ff3252d942c81',
    scaleAxis: 'height',
    notes:
      'Soviet N1 moon rocket (CC-BY, ~135k tris). Scaled to 105.3 m height in-app. Paint: olive lower stages + off-white upper.',
  },
  {
    id: 'person-male',
    uid: '8a1a34d7012d48639e42ee3763680392',
    scaleAxis: 'height',
    notes:
      'Ready Player Me male avatar (CC-BY-NC-SA, rigged). Scaled to 1.75 m height in-app. Non-commercial use only.',
  },
  {
    id: 'person-female',
    uid: '4b58e590e9fc422dbbf176c1848dc898',
    scaleAxis: 'height',
    notes:
      'Ready Player Me female avatar (CC-BY-NC-SA, rigged). Scaled to 1.65 m height in-app. Non-commercial use only.',
  },
  {
    id: 'minecraft-player',
    uid: '0cffc39bdab04551bde4f8cdfbc52eca',
    scaleAxis: 'height',
    notes:
      'The Perfect Steve Rigged (Blender3D CC-BY, ~3k tris, 1 clip). Scaled to 1.8 m height in-app.',
  },
  {
    id: 'money',
    uid: 'dc5ee4de0d1744e79d990cb4891b3a47',
    scaleAxis: 'height',
    notes:
      'Textured money cube (LeopardGepard CC-BY). One cube ≈ 7×3×20 × $100k bundles ($42M by volume). Piles are atlas-tiled mega-meshes snapped to whole cubes.',
  },
  {
    // Linked yakudami B-21 is Sketchfab Store / not downloadable — creadordemu CC-BY instead
    // (light gray “white ground” studio look matching the linked preview).
    id: 'b21',
    uid: '21a6984123814efc83a77f7c03977af8',
    scaleAxis: 'width',
    notes:
      'B-21 Raider (CC-BY, creadordemu). Linked yakudami model is Store-only/not downloadable. MSFS-style kit (interior + hide-to-infinity clips); runtime stops clips and crops helpers. Scaled to ~45 m wingspan estimate in-app.',
  },
  {
    id: 'b2',
    uid: '9cd6b00813c04401a5427ae71b7a0cdc',
    scaleAxis: 'width',
    notes: 'B-2 Spirit (CC-BY-NC-SA). Scaled to 52.4 m wingspan in-app. Non-commercial use only.',
  },
  {
    id: 'b1',
    uid: 'd32a5cbbd16f4521bdd37e8b4b1c79bc',
    scaleAxis: 'length',
    notes: 'B-1B Lancer by nazidefenseforceofficial (CC-BY). Scaled to 44.5 m length in-app.',
  },
  {
    id: 'a320',
    uid: 'f65582ef4c9d4055bf6117aeee35b5a4',
    scaleAxis: 'length',
    notes: 'Airbus A320 (CC-BY-NC-SA). Scaled to 37.57 m length in-app. Non-commercial use only.',
  },
  {
    id: 'boeing-737',
    uid: 'fa2d273dba0e45348284a6d6cd711218',
    scaleAxis: 'length',
    notes: 'Boeing 737-800 (CC-BY-NC-SA). Scaled to 39.47 m length in-app. Non-commercial use only.',
  },
  {
    id: 'boeing-747',
    uid: '327154ad78154f8f9c0ec7169fd4820c',
    scaleAxis: 'length',
    notes:
      'VC-25 Air Force One / Boeing 747 (CC-BY-NC-SA). Scaled to 70.66 m length in-app. Non-commercial use only.',
  },
  {
    id: 'cvn-65',
    uid: 'f1b46fa2de8f409cbbe693f7f10dc3b8',
    scaleAxis: 'length',
    notes: 'USS Enterprise CVN-65 by nazidefenseforceofficial (CC-BY). Scaled to 342 m length in-app.',
  },
  {
    id: 'nimitz',
    uid: '06cf0dba66874934a105b3fe2bfdb0f7',
    scaleAxis: 'length',
    notes: 'Nimitz-class carrier by nazidefenseforceofficial (CC-BY). Scaled to 332.8 m length in-app.',
  },
  {
    id: 'v22',
    uid: 'cf00a682505f479a903e9600cce051f7',
    scaleAxis: 'length',
    notes: 'V-22 Osprey by nazidefenseforceofficial (CC-BY). Scaled to 17.5 m length in-app.',
  },
  {
    id: 'apache',
    uid: 'c3b58008c46b45048fdd7dd283a3c8c8',
    scaleAxis: 'length',
    notes: 'AH-64D Apache by nazidefenseforceofficial (CC-BY). Scaled to 17.73 m length in-app.',
  },
  {
    id: 'chinook',
    uid: 'cdac73e931f6482e86960a326fef73bf',
    scaleAxis: 'length',
    notes: 'CH-47 Chinook by nazidefenseforceofficial (CC-BY). Scaled to 30.1 m rotor length in-app.',
  },
  {
    id: 'c18a',
    uid: '392a9149a8af42df95ac7f7e96eb0acf',
    scaleAxis: 'length',
    notes:
      'C-18A Skylord by nazidefenseforceofficial (CC-BY; C-17-based concept). Scaled to C-17 size 53 m length in-app.',
  },
  {
    id: 'blackhawk',
    uid: '12b4e525676a49678ac3006b360c8750',
    scaleAxis: 'length',
    notes: 'UH-60M Black Hawk by nazidefenseforceofficial (CC-BY). Scaled to 19.76 m length in-app.',
  },
  {
    id: 'f117',
    uid: '037698ed02624d45b5ba5cd774d54b68',
    scaleAxis: 'length',
    notes: 'F-117A Nighthawk by nazidefenseforceofficial (CC-BY). Scaled to 20.09 m length in-app.',
  },
  {
    id: 'tu22m3',
    uid: '0778970b6d82471c9431d29ba817a7a0',
    scaleAxis: 'length',
    notes: 'Tu-22M3 by nazidefenseforceofficial (CC-BY). Scaled to 42.46 m length in-app.',
  },
  {
    id: 'chieftain',
    uid: '1afc838ca30c4dac99c15e731d0d2ab8',
    scaleAxis: 'length',
    notes: 'Chieftain Mk 5 by nazidefenseforceofficial (CC-BY). Scaled to 10.77 m length in-app.',
  },
  {
    id: 'virginia',
    uid: '6b0b602041d145698ad44a6d00f35cb6',
    scaleAxis: 'length',
    notes:
      'Virginia-class SSN (USS San Francisco SSN-810) by nazidefenseforceofficial (CC-BY). Scaled to 115 m length in-app.',
  },
  {
    id: 'ohio',
    uid: '315be00711a24dce9f0fa6657df7521e',
    scaleAxis: 'length',
    notes: 'Ohio-class SSBN by yakudami (CC-BY). Scaled to 170.7 m length in-app.',
  },
  {
    id: 'independence',
    uid: '7db04398d9524a36a6e08bead0050b76',
    scaleAxis: 'length',
    notes: 'USS Independence LCS-2 by nazidefenseforceofficial (CC-BY). Scaled to 127.4 m length in-app.',
  },
  {
    id: 'kiev',
    uid: 'f854eda1eab54a40aae8628e6456ae78',
    scaleAxis: 'length',
    notes: 'Kiev-class carrier by nazidefenseforceofficial (CC-BY). Scaled to 273 m length in-app.',
  },
  {
    id: 'type45',
    uid: 'a471949e73d04c838416fca2f7813c8e',
    scaleAxis: 'length',
    notes: 'Type 45 destroyer by nazidefenseforceofficial (CC-BY). Scaled to 152.4 m length in-app.',
  },
  {
    id: 'zumwalt',
    uid: 'f521d9c702284768adeeddef199389a0',
    scaleAxis: 'length',
    notes: 'USS Zumwalt DDG-1000 by yakudami (CC-BY). Scaled to 186 m length in-app.',
  },
  {
    id: 'moskva',
    uid: '535adcf1560245e48e93b3759f0237ae',
    scaleAxis: 'length',
    notes: 'Moskva helicopter carrier by nazidefenseforceofficial (CC-BY). Scaled to 189 m length in-app.',
  },
  {
    id: 'wasp',
    uid: 'bf391bb56fbf44c4a924cb6a5bd8bf81',
    scaleAxis: 'length',
    notes: 'USS Wasp LHD-1 by nazidefenseforceofficial (CC-BY). Scaled to 257 m length in-app.',
  },
  {
    id: 't72',
    uid: 'dfe130dfce724c30958cec51f2bd86b7',
    scaleAxis: 'length',
    notes: 'T-72B3 by nazidefenseforceofficial (CC-BY). Scaled to 9.53 m length in-app.',
  },
  {
    // Linked alpen WW2 US Soldier is Sketchfab Standard / not downloadable — Tactical_Beard CC-BY instead.
    id: 'soldier-ww2',
    uid: 'dcbe89cd5de243af8e4677b769a831c6',
    scaleAxis: 'height',
    notes:
      'WW2 US Army Ranger (CC-BY). Linked alpen soldier is not downloadable. Scaled to 1.75 m height in-app.',
  },
  {
    // Kyle Li Poly Pizza bus stood on end (Y = length) and blew the AABB.
    id: 'school-bus',
    uid: 'a959ee8ce17d434f9fdbc93cad199a21',
    scaleAxis: 'length',
    notes: 'Low-poly school bus by Macaroni (CC-BY). Scaled to 12 m length in-app.',
  },
  {
    id: 'patriot',
    uid: '95e1e402426f4ddcb543af7a0455cf05',
    scaleAxis: 'length',
    notes:
      'MIM-104 Patriot launcher by nazidefenseforceofficial (CC-BY). Scaled to 10.4 m length in-app.',
  },
  {
    id: 'c-ram',
    uid: '10ea7349c7574ca7a43991eece92c9a9',
    scaleAxis: 'length',
    notes:
      'Centurion C-RAM / LPWS by nazidefenseforceofficial (CC-BY). Scaled to 4.26 m height in-app.',
  },
  {
    id: 'container-20',
    uid: '5c26a86ff20c4df689b5fbd760337845',
    scaleAxis: 'length',
    notes: 'ISO 40-foot shipping container by Evanz (CC-BY, photo-textured). Scaled to 12.19 m length in-app.',
  },
  {
    // Blender3D "Basic TNT" sat ~9 km off origin and was a long stick, not a cube.
    id: 'tnt',
    uid: '0572faca4ba44d19b9314f4e8c69a3df',
    scaleAxis: 'height',
    notes: 'Minecraft Block TNT by BlueWolf7777 (CC-BY). 1 m cube in-app.',
  },
  {
    id: 'jdam',
    uid: 'a9be1567030747859c3cbb73102630bd',
    scaleAxis: 'length',
    notes: 'GBU-31 JDAM / Mk 84 (CC-BY, War Thunder). Scaled to 3.88 m length in-app.',
  },
  {
    id: 'mushroom-cloud',
    uid: 'ad47887195224b76bdaad1a12b590e55',
    scaleAxis: 'width',
    notes:
      'Mushroom cloud nuclear explosion by 3dUVpro (CC-BY). Used for large-bomb ground detonations; scaled to blast radius.',
  },
  {
    // Linked tomparsons Nuclear Fireball is Sketchfab Standard / not downloadable — DaBoRi CC-BY instead.
    id: 'nuclear-fireball',
    uid: '4d8f95f28398453d8d5620fe301d39f8',
    scaleAxis: 'width',
    notes:
      'Fireball energy sphere by DaBoRi (CC-BY). Air-blast stand-in for linked tomparsons fireball. Random yaw; keep upright.',
  },
  {
    // Linked plaggy Nuclear Explosion is Sketchfab Standard / not downloadable — jungle_jim CC-BY instead.
    id: 'nuclear-explosion',
    uid: 'f833ea08a5cc4987afd1be23461c622d',
    scaleAxis: 'width',
    notes:
      'Explosion by jungle_jim (CC-BY). Ground-blast stand-in for linked plaggy nuclear explosion; scaled to blast radius.',
  },
  {
    id: 'eagle',
    uid: '30203bf39e5145f19c79e83c550139d3',
    scaleAxis: 'width',
    notes:
      'White eagle fast-fly (CC-BY, GremorySaiyan). Scaled to 2.3 m wingspan in-app. Clip plays on camera focus.',
  },
  {
    id: 'rhino',
    uid: 'a915d9179fe6422b9d669a3a0d726b8e',
    scaleAxis: 'length',
    notes:
      'Rhino walk (CC-BY, GremorySaiyan). Scaled to 3.8 m length in-app. Clip plays on camera focus.',
  },
  {
    id: 'leopard',
    uid: '5a36868106f843d4a24d87334f1550fe',
    scaleAxis: 'length',
    notes:
      'Leopard run (CC-BY, GremorySaiyan). Scaled to 1.5 m body length in-app. Clip plays on camera focus.',
  },
  {
    // Linked GremorySaiyan Elephant Walk is Sketchfab Standard / not downloadable — same creator Idle instead.
    id: 'elephant',
    uid: 'a8e7e10f005f4baab0a2f5079d759fcd',
    scaleAxis: 'height',
    notes:
      'Elephant idle (CC-BY, GremorySaiyan). Linked walk clip is Standard/not downloadable. Scaled to 3.2 m shoulder height in-app.',
  },
  {
    // Linked GremorySaiyan Carnotaurus Animations is Standard / not downloadable — Rexeoooo The Isle CC-BY instead.
    id: 'carnotaurus',
    uid: 'fdf4490bbbac4567a7eab60c22190835',
    scaleAxis: 'length',
    notes:
      'Carnotaurus (CC-BY, Rexeoooo / The Isle). Linked GremorySaiyan pack is Standard. Scaled to 8 m length in-app.',
  },
  {
    // Linked GremorySaiyan Ankylosaurus Animations is Standard / not downloadable — kenchoo CC-BY instead.
    id: 'ankylosaurus',
    uid: '9ba4629a871c4b0fa792fc1bb629881b',
    scaleAxis: 'length',
    notes:
      'Ankylosaurus (CC-BY, kenchoo). Linked GremorySaiyan pack is Standard. Scaled to 7.5 m length in-app.',
  },
  {
    // Linked GremorySaiyan Horse Run is Standard / not downloadable — Bazsi1986 Draft Horse Walk instead.
    id: 'horse',
    uid: '0541f4f11cb44383bf32b906aac5288e',
    scaleAxis: 'height',
    notes:
      'Draft horse walk (CC-BY, Bazsi1986). Linked GremorySaiyan run is Standard. Scaled to 1.73 m withers height in-app.',
  },
  {
    // Linked GremorySaiyan Owl Fly is Standard / not downloadable — pothedev Owl (9 clips) instead.
    id: 'owl',
    uid: 'd177e1fbcce940cba32e434cc5a62f1a',
    scaleAxis: 'width',
    notes:
      'Owl (CC-BY, pothedev, fly/walk/idle clips). Linked GremorySaiyan fly is Standard. Scaled to 1.4 m wingspan in-app.',
  },
  {
    // Linked GremorySaiyan Wolf Howl is Standard / not downloadable — dk_artist stylized wolf instead.
    id: 'wolf',
    uid: '4e8b14320253433ca5a063fce413b33a',
    scaleAxis: 'length',
    notes:
      'Stylized wolf (CC-BY, dk_artist). Linked GremorySaiyan howl is Standard. Scaled to 1.4 m length in-app.',
  },
  {
    // Linked GremorySaiyan Rabbit Animations is Standard / not downloadable — Pneshik low-poly rabbit instead.
    id: 'rabbit',
    uid: 'dcf4d25f535347b1bfb859c659314bde',
    scaleAxis: 'length',
    notes:
      'Low-poly rabbit (CC-BY, Pneshik, 5 clips). Linked GremorySaiyan pack is Standard. Scaled to 0.4 m length in-app.',
  },
  {
    // Linked GremorySaiyan Giganotosaurus Animations is Standard / not downloadable — PusztaiAndras walk instead.
    id: 'giganotosaurus',
    uid: 'a4eca4b015f5407e90120836ff77e661',
    scaleAxis: 'length',
    notes:
      'Giganotosaurus walk (CC-BY, PusztaiAndras). Linked GremorySaiyan pack is Standard. Scaled to 12.5 m length in-app.',
  },
  {
    // Linked GremorySaiyan Spinosaurus Animations is Standard / not downloadable — nobilishornet walking Maroccanus instead.
    id: 'spinosaurus',
    uid: '4705e521996a4e0ab9a9e24b5f0f2b51',
    scaleAxis: 'length',
    notes:
      'Walking Spinosaurus maroccanus (CC-BY, nobilishornet). Linked GremorySaiyan pack is Standard. Scaled to 14 m length in-app.',
  },
  {
    // Linked GremorySaiyan White Anaconda Idle is Standard / not downloadable — Imagigoo snake attack instead.
    id: 'anaconda',
    uid: '83c4290cd4b648fd942d4bbc2280a3f6',
    scaleAxis: 'length',
    notes:
      'Snake attack (CC-BY, Imagigoo). Linked GremorySaiyan white anaconda is Standard. Scaled to 5.5 m length in-app.',
  },
]

async function apiGet(path, token, { retries = 5 } = {}) {
  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Token ${token}`
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`https://api.sketchfab.com/v3${path}`, { headers })
    if (res.status === 429 && attempt < retries) {
      const waitMs = Math.min(60_000, 5_000 * 2 ** attempt)
      console.warn(`Rate limited on ${path}; waiting ${Math.round(waitMs / 1000)}s...`)
      await new Promise((r) => setTimeout(r, waitMs))
      continue
    }
    if (!res.ok) {
      const text = await res.text()
      lastErr = new Error(`Sketchfab API ${res.status} ${path}: ${text.slice(0, 200)}`)
      if (res.status >= 500 && attempt < retries) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
        continue
      }
      throw lastErr
    }
    return res.json()
  }
  throw lastErr
}

async function downloadTo(url, dest) {
  mkdirSync(dirname(dest), { recursive: true })
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
}

function findGlb(dir) {
  const stack = [dir]
  while (stack.length) {
    const cur = stack.pop()
    for (const name of readdirSync(cur)) {
      const full = join(cur, name)
      if (statSync(full).isDirectory()) stack.push(full)
      else if (name.toLowerCase().endsWith('.glb')) return full
    }
  }
  return null
}

function findSceneGltf(dir) {
  const stack = [dir]
  while (stack.length) {
    const cur = stack.pop()
    for (const name of readdirSync(cur)) {
      const full = join(cur, name)
      if (statSync(full).isDirectory()) stack.push(full)
      else if (name.toLowerCase() === 'scene.gltf') return full
    }
  }
  return null
}

async function fetchModel(entry, token) {
  const meta = await apiGet(`/models/${entry.uid}`, token)
  const licenseSlug = meta.license?.slug ?? 'by'
  const license =
    licenseSlug === 'by'
      ? 'CC-BY-4.0'
      : licenseSlug === 'by-sa'
        ? 'CC-BY-SA-4.0'
        : licenseSlug === 'by-nc-sa'
          ? 'CC-BY-NC-SA-4.0'
          : licenseSlug === 'by-nc'
            ? 'CC-BY-NC-4.0'
            : licenseSlug === 'cc0'
              ? 'CC0'
              : licenseSlug === 'free-st'
                ? 'Sketchfab-Standard'
                : licenseSlug
  const licenseLabel =
    license === 'CC-BY-4.0'
      ? 'CC BY'
      : license === 'CC-BY-SA-4.0'
        ? 'CC BY-SA'
        : license === 'CC-BY-NC-SA-4.0'
          ? 'CC BY-NC-SA'
          : license === 'CC-BY-NC-4.0'
            ? 'CC BY-NC'
            : license === 'CC0'
              ? 'CC0'
              : meta.license?.label ?? license
  const author = meta.user?.displayName || meta.user?.username || 'Unknown'
  const source = meta.viewerUrl || `https://sketchfab.com/3d-models/${entry.uid}`

  const outDir = join(modelsDir, entry.id)
  mkdirSync(outDir, { recursive: true })

  const licenseMeta = {
    id: entry.id,
    file: 'model.glb',
    license,
    licenseLabel,
    author,
    source,
    sourceAsset: meta.name,
    sketchfabUid: entry.uid,
    notes: entry.notes,
    attribution: `${meta.name} by ${author} on Sketchfab (${licenseLabel}) — ${source}`,
  }

  writeFileSync(join(outDir, 'license.json'), `${JSON.stringify(licenseMeta, null, 2)}\n`)

  if (licensesOnly) {
    console.log(`License only: ${entry.id}`)
    return
  }

  const destGlb = join(outDir, 'model.glb')
  if (!force && existsSync(destGlb) && statSync(destGlb).size > 0) {
    console.log(`Skip ${entry.id} (model.glb exists; use --force to re-download)`)
    return
  }

  if (!token) {
    throw new Error(
      'SKETCHFAB_API_TOKEN is required to download. Get one at https://sketchfab.com/settings/password',
    )
  }

  console.log(`Downloading ${entry.id} (${meta.name}, ~${meta.faceCount} tris)...`)
  const urls = await apiGet(`/models/${entry.uid}/download`, token)

  const glbInfo = urls.glb
  const gltfInfo = urls.gltf

  if (glbInfo?.url) {
    const dest = join(outDir, 'model.glb')
    await downloadTo(glbInfo.url, dest)
    console.log(`OK ${entry.id} → model.glb (${statSync(dest).size} bytes)`)
    return
  }

  if (gltfInfo?.url) {
    const tmp = mkdtempSync(join(tmpdir(), 'sketchfab-'))
    try {
      const zipPath = join(tmp, 'model.zip')
      await downloadTo(gltfInfo.url, zipPath)
      const extractDir = join(tmp, 'out')
      mkdirSync(extractDir, { recursive: true })
      try {
        execFileSync('tar', ['-xf', zipPath, '-C', extractDir], { stdio: 'inherit' })
      } catch {
        execFileSync(
          'powershell',
          ['-Command', `Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force`],
          { stdio: 'inherit' },
        )
      }

      const glb = findGlb(extractDir)
      if (glb) {
        copyFileSync(glb, join(outDir, 'model.glb'))
        console.log(`OK ${entry.id} → model.glb from zip`)
        return
      }

      // Keep glTF folder as-is if no GLB (Babylon can load scene.gltf + bins).
      const scene = findSceneGltf(extractDir)
      if (!scene) throw new Error('No GLB or scene.gltf in Sketchfab archive')
      // Copy archive contents beside model
      const gltfDir = join(outDir, 'gltf')
      mkdirSync(gltfDir, { recursive: true })
      execFileSync(
        'powershell',
        [
          '-Command',
          `Copy-Item -Path '${join(extractDir, '*')}' -Destination '${gltfDir}' -Recurse -Force`,
        ],
        { stdio: 'inherit' },
      )
      license.file = 'gltf/scene.gltf'
      writeFileSync(join(outDir, 'license.json'), `${JSON.stringify(license, null, 2)}\n`)
      console.log(`OK ${entry.id} → gltf/scene.gltf (no GLB in archive)`)
      return
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  }

  throw new Error(`No glb/gltf download URL for ${entry.uid}`)
}

async function main() {
  const token = process.env.SKETCHFAB_API_TOKEN || process.env.SKETCHFAB_TOKEN || ''
  if (!token && !licensesOnly) {
    console.error(`
Sketchfab downloads require an API token.

1. Log into Sketchfab → Settings → Password → API Token
2. Then run:
   $env:SKETCHFAB_API_TOKEN="your_token"
   npm run fetch-sketchfab

Or manually download GLB from the model page and put it at:
   public/models/starship/model.glb
`)
    process.exit(1)
  }

  for (const entry of MODELS) {
    if (onlyIds && !onlyIds.has(entry.id)) continue
    try {
      await fetchModel(entry, token)
    } catch (err) {
      console.error(`FAIL ${entry.id}:`, err.message)
      process.exitCode = 1
    }
  }

  // Historical olive / off-white paint for the N1 Sketchfab mesh.
  if (!licensesOnly && existsSync(join(modelsDir, 'n1', 'model.glb'))) {
    try {
      execFileSync(process.execPath, [join(__dirname, 'paint-n1.mjs')], {
        stdio: 'inherit',
        cwd: rootDir,
      })
    } catch (err) {
      console.error('FAIL paint-n1:', err.message)
      process.exitCode = 1
    }
  }
}

main()
