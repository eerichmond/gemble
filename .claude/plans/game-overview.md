# Gemble — Implementation Plan

## Context

Building a 3D first-person exploration game called "Gemble". The player starts in a dense dusk-lit pine forest and must explore to find a blue-indigo gem hidden in a small abandoned city. Built incrementally — each phase produces something visually playable before moving on. Testing and acceptance criteria are added *after* visual validation of each phase, not before.

---

## Tech Stack

- **Three.js r176** — WebGL rendering (`three` + `@types/three` both installed as devDeps)
- **Vite 6 + Yarn** — dev server with hot-reload (`yarn dev` → localhost:5173)
- **TypeScript** — strict mode
- **Vitest** — unit testing (added after Phase 0 is visually validated)

---

## Tools for Visual Verification

Before adding tests, use these to validate each phase visually:

| Tool | How to use | What it tells you |
|---|---|---|
| **Browser console** | F12 → Console tab | WebGL errors, missing textures, uncaught exceptions |
| **stats.js** | already installed (`yarn add stats.js` done); 2-line setup in `scene.ts` | Live FPS / ms-per-frame counter in corner of screen — instantly shows performance regressions |
| **Three.js DevTools** | [Chrome extension](https://chrome.google.com/webstore/detail/threejs-devtools) | Inspect scene graph, toggle mesh visibility, check camera position in real time |
| **Vite HMR** | Edit a file → browser auto-reloads | Tight feedback loop — no manual refresh needed |
| **URL hash debug** | Add `?debug=1` to URL, read in `main.ts` to show a dev overlay with player position / yaw | Useful for checking terrain height and movement math |

Add `stats.js` in Phase 0 and leave it in permanently during development. Remove before any "release" if desired.

---

## World Layout (Final Vision — Build toward this)

```
         N (crystals z≈+238)
    [dense forest — player spawns here at z=0]
    [forest + road winding south, passes z=+18 east of spawn]
    [road reaches z=-248 — gravel ends, asphalt begins]
    [city zone z=-248 to z=-440 — terrain gradually flattens south of z=-180]
    [abandoned city — buildings, gem here around z=-330]
         S
```

Main terrain: 500×700 unit mesh (translated south via `geometry.translate(0,100,0)` before rotateX). Terrain amplitude flattens gradually south of z=-180 using `flattenT = min(1, (-z-180)/80)` — full hills at z=-180, ~8% amplitude at z=-260 and beyond. No separate city ground plane. Road: gravel from north to z=-248, then wider black asphalt through city to z=-440. Gem is in the forest at `(-52, y, 108)`, surrounded by 4 large purple pyramid crystals 12 units out in each cardinal direction. Player spawns at `(-52, y, 130)` facing south into the crystal formation.

---

## Project Structure (Final)

```
gemble/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.ts              # entry: wires modules, game loop
    ├── scene.ts             # renderer, camera, lights, fog, clouds  [Phase 0, updated P1+]
    ├── terrain.ts           # mesh + getHeightAt() + mountain obstacles  [Phase 0, updated P1]
    ├── terrain.test.ts      # unit tests — computeTerrainHeight  [Phase 1]
    ├── trees.ts             # 480 pines + 120 deciduous  [Phase 1]
    ├── props.ts             # rocks, boulders, bushes  [Phase 2]
    ├── player.ts            # camera movement + collision  [Phase 1]
    ├── player.test.ts       # unit tests — movement, collision, clamp  [Phase 1]
    ├── input.ts             # keyboard state  [Phase 0]
    ├── road.ts              # gravel road + crystals  [Phase 3 ✅]
    ├── city.ts              # buildings, parking, props  [Phase 4 ✅]
    ├── gem.ts               # gem + 4 pyramid crystals, forest  [Phase 4 ✅]
    ├── audio.ts             # forest ambient + caw sound  [Phase 4/5 ✅]
    ├── monsters.ts          # flying eye  [Phase 7 partial ✅]
    ├── compass.ts           # HUD compass  [Phase 4 ✅]
    ├── birds.ts             # crow groups that startle on approach  [Phase 5 ✅]
    ├── chests.ts            # treasure chests, armor loot, open/close  [Phase 6 ✅]
    ├── capybaras.ts         # 10 grazing capybaras in 3 groups  [Phase 8 ✅]
    └── ghosts.ts            # 3 city ghosts floating between buildings  [Phase 9]
```

---

## Phase 0 — Environment Skeleton ✅ COMPLETE (commit eab24c6)

**Goal:** Open `localhost:5173` and see terrain, hills, distant mountains, a sky, and be able to rotate the camera with arrow keys. No forward movement yet. No trees.

**What's in scope:**
- Vite + Three.js + TypeScript scaffold
- Flat-ish terrain with gentle hills (sine-wave)
- Distant mountain cone silhouettes (6–8)
- Sky color (renderer clear color + fog)
- Ambient + directional light (neutral daytime — atmosphere tuning is Phase 2)
- Left/Right arrow keys rotate camera in place
- `stats.js` FPS counter

**What's out of scope:** movement, trees, fog, dusk colors, buildings, gem

**Implementation notes:**
- Project was already scaffolded with Yarn 4 (not npm) — all commands use `yarn` instead of `npm`
- `@types/three` was already in devDependencies (Three.js r150+ ships its own types — both coexist fine)
- Mountains implemented as groups of 2–3 overlapping cones per position, placed in `terrain.ts`
- `canvas id="canvas"` added to `index.html`; renderer uses existing canvas element (not `document.body.appendChild`)
- Arrow keys preventDefault'd in `input.ts` to stop page scrolling
- **Polish (commit 341c3b1):** Mountains moved from radius 380–440 (outside terrain ±250 boundary) to 160–220 (inside terrain); bases buried 35% underground so peaks emerge naturally. Hill amplitude increased from ±20 to ±29 units. Light `FogExp2(0x87ceeb, 0.004)` added to soften horizon.
- stats.js is a JS library with `@types/stats.js` — usage in TypeScript is standard; no change needed
- Verified: 120fps, dramatic rolling hills, mountains grounded in terrain, horizon haze working

✅ Visually validated — 120fps, dramatic rolling hills, mountains grounded in terrain, horizon haze, no WebGL errors.

---

## Phase 1 — Trees + Forward Movement ✅ COMPLETE (commits 915d2a5, 6511d99)

**Goal:** Walk through a forest. Arrow Up/Down moves forward/back. Trees fill the world. Player can't walk through trees.

**New files:** `src/trees.ts`  
**Modified files:** `src/player.ts` (add movement + tree collision), `src/main.ts` (wire trees)

**Implementation notes:**
- Seeded LCG RNG in `trees.ts` gives deterministic tree placement across hot-reloads
- Tree scale adjusted to 2.0–3.5x after visual review — gives ~30–50 ft pines that dwarf the player (1.7 unit eye height ≈ 5.5 ft)
- Count increased from 400 to 600 for denser canopy coverage
- **Collision is trunk-only for both pines and deciduous** — player can walk underneath canopy freely
  - Pine: `radius = 0.25 * scale` (CylinderGeometry base r=0.25)
  - Deciduous: `radius = 0.28 * scale` (CylinderGeometry base r=0.28)
  - Previous value of `2.5*scale` / `2.2*scale` blocked at canopy edge — incorrect
- Pure helpers (`computeMovementDelta`, `isBlockedByTree`, `clampToWorld`) exported from `player.ts` for later Vitest unit tests
- Mountains pushed to radius 225–245, lightened to `0xb0c4cc` for atmospheric distance
- **Mountain collision**: `terrain.ts` exports `mountainObstacles: CircleObstacle[]` — **24 per-peak obstacles** (8 groups × 3 peaks, `PEAK_RADIUS = 37`). Cones are buried 40% underground, so visible cross-section at ground = `base_radius × 0.6 ≈ 31–43 units`; 37 is the average and stops the player right at the cone surface. Previous values: 80 (per-group, too wide) → 56 (per-peak, still wide) → 37 (correct).
- **Mountain tree exclusion**: trees and props use `excludeZones` in their placement loops so nothing spawns inside mountain bases
- `computeMovementDelta` uses `-sin/-cos` for forward direction (camera looks down -Z; `+sin/+cos` was backwards)

**Forest variety additions (commit 5992b2b, fixes in 12b036c+, continued):**
- **480 pines**: trunk `CylinderGeometry(0.15, 0.25, 2, 6)` + 3 stacked `ConeGeometry` tiers, scale 2.0–3.5x
- **120 deciduous trees**: lighter-brown trunk + `IcosahedronGeometry(1, 1)` canopy scaled `(2.2, 1.4, 2.2) * scale`. Wide spreading dome shape (wider XZ than Y, lumpy facets) reads as organic broadleaf crown, clearly distinct from sharp-pointed pines. Canopy center = `groundY + 3.4*scale` so bottom (3.4 − 1.4 = 2.0) meets trunk top.
  - Previously used a `ConeGeometry(2.0, 4.5, 12)` which looked too similar to pines.
- **`src/props.ts`** (seeded RNG 99):
  - 200 small/medium rocks + 45 large boulders: `DodecahedronGeometry(0.7, 0)`, dome-based (center positioned below groundY so only upper dome is visible). Large boulders scale 1.5–3.5x.
  - 250 main bushes + 400 small ground-cover shrubs: `IcosahedronGeometry(1.0, 1)`, dome-based (center near groundY, varied XZ/Y ratios for natural look). Replaced crossed-plane grass tufts.

**Nighttime scene (applied ahead of Phase 2 atmosphere — partial):**
- `scene.background = new THREE.Color(0x1e3564)` — dusk blue sky (lightened from original `0x1a2a4a` night navy per user feedback)
- `scene.fog = new THREE.FogExp2(0x1e3564, 0.004)` — matching fog color
- `AmbientLight(0x9aaec8, 0.5)` — cool blue-grey moonlight fill
- `DirectionalLight(0xd0ddf0, 0.85)` (named `moon`) — cool white directional light
- 4 cloud groups added via `addClouds()` in `scene.ts`: `IcosahedronGeometry(1,1)` blobs, flat-scaled wide, color `0xc8d4e8` (moonlit blue-grey), y=142–152

### `src/trees.ts`
- 480 pines + 120 deciduous using InstancedMesh (10 draw calls total)
- Both types: trunk-only collision radius (see above)
- Accepts `mountainObstacles: CircleObstacle[]` to exclude placement from mountain zones
- Exports `{ treePositions: TreePosition[] }` where `TreePosition = { x, z, radius }`

### `src/terrain.ts`
- Exports `CircleObstacle { x, z, radius }` interface
- `createTerrain` returns `mountainObstacles: CircleObstacle[]` — 24 circles (one per individual peak, `PEAK_RADIUS = 37`)
- Passed to `createTrees`, `createProps`, and `createPlayer` in `main.ts`
- Ground: procedural `CanvasTexture` (512×512, tiled 24×24) with grass blade strokes and 28 irregular green ellipse patches. No external image assets needed. Material `color: 0x6a9a58` tints texture toward forest green under cool moonlight.

### `src/player.ts` updates
- `createPlayer(camera, getHeightAt, treePositions, mountainObstacles)` — fourth param added
- Checks `isBlockedByTree` against both `treePositions` and `mountainObstacles`
- World boundary clamp: `±240`
```ts
// Pure exported helpers (testable without Three.js):
export function computeMovementDelta(yaw: number, speed: number, dt: number): { dx: number; dz: number }
export function isBlockedByTree(x: number, z: number, trees: TreePosition[], radius: number): boolean
export function clampToWorld(x: number, z: number, limit: number): { x: number; z: number }
```

### Phase 1 Visual Checklist

✅ Visually validated — dense forest, forward/backward movement, terrain height tracking, trunk-only collision, world boundary all working.

### Phase 1 Tests ✅ DONE (commit 7366500)

- `src/terrain.test.ts` — `computeTerrainHeight`: origin value, finite output, ±30 range, determinism
- `src/player.test.ts` — `computeMovementDelta`, `isBlockedByTree`, `clampToWorld`: happy path + edge cases

---

## Phase 2 — Atmosphere + Props — Props ✅ Done, Full Atmosphere Pending

**Goal:** Moody night/mystery atmosphere with heavy fog. Add ground detail props.

**New files:** `src/props.ts` ✅ done  
**Modified files:** `src/scene.ts` (lighting + sky), `src/terrain.ts` (ground texture)

### `src/props.ts` ✅ COMPLETE
All props use InstancedMesh. Accepts `mountainObstacles` to keep props out of mountain bases.
- **200 small/medium rocks** (scale 0.3–1.4) + **45 large boulders** (scale 1.5–3.5): `DodecahedronGeometry(0.7, 0)`, dome-based — center positioned below groundY so only the upper dome is visible
- **250 main bushes** (scale 0.6–1.4) + **400 small ground-cover shrubs** (scale 0.2–0.55): `IcosahedronGeometry(1.0, 1)`, dome-based with varied XZ/Y ratios per instance for natural irregular shape. Grass tufts (crossed planes) removed — replaced by these ground-cover shrubs.

### `src/scene.ts` — Nighttime lighting ✅ DONE (commit 7366500)
Night sky and moonlight were applied directly in `scene.ts` rather than a separate `atmosphere.ts` module — simpler and no reason to separate it. Current state:
- `scene.background = new THREE.Color(0x1e3564)` — dusk blue sky (lightened from `0x1a2a4a` per user feedback — deep night was too dark)
- `scene.fog = new THREE.FogExp2(0x1e3564, 0.004)` — light fog matching sky (density increase still pending)
- `AmbientLight(0x9aaec8, 0.5)` — cool blue-grey moonlight fill
- `DirectionalLight(0xd0ddf0, 0.85)` — cool white moon directional, casts shadows
- 4 cloud groups: `IcosahedronGeometry(1,1)` blobs at y=142–152, color `0xc8d4e8`

**Still pending for full atmosphere:**
- Increase fog density to `0.018` so trees fade to silhouettes at ~80 units
- Swap sky + fog color to deep purple-black `0x1a1228` for mystery/dusk feel
- Add low warm-orange light from west for ambient glow on scene (replaces moon)
- Darken terrain color to near-black `0x1a2e12`

### Phase 2 Visual Checklist
- [x] Rocks scattered on terrain ✅
- [x] Bushes and ground-cover shrubs visible ✅
- [x] Night sky (navy) + moonlit clouds ✅
- [ ] Heavy fog — trees beyond ~80 units fade to silhouettes
- [ ] Sky transitions to deep purple-black mystery tone
- [ ] Terrain darkened to near-black forest floor
- [ ] Still 60fps

### Phase 2 Tests
No pure functions to test in props or atmosphere. Skip.

---

## Phase 3 — Road ✅ COMPLETE

**Goal:** A gravel road winds from the forest northward to a crystal formation and southward toward the city entrance. Following it feels like discovering a path.

**New files:** `src/road.ts`

**Implementation notes:**
- Road runs full map length: north end at `[20, 238]` (crystal formation), south end at `[4, −248]` (city entrance)
- 14 waypoints, gentle S-curve through the forest passing ~18 units east of spawn — visible to the right when facing south. Final 2 points are `[4, -216]` → `[4, -248]` (straight south approach to city, no sharp dog-leg)
- Road width: 12 units. Gravel surface (not asphalt). No yellow centerline.
- **Terrain conformance approach** — `buildRibbon()` uses **7 columns** across the road width (`cols=7`), creating 1×2 unit quads. Each vertex independently calls `getHeightAt(vx, vz) + Y_ROAD` for its own terrain height. This prevents both grass poking through (fine quads catch all terrain peaks within 5-unit terrain mesh spacing) and road floating (no MAX across road width — road banks naturally with terrain cross-slope). Y_ROAD=0.18 for small clearance. Spine sampled every 1 unit for dense longitudinal conformance.
- **Dark gray edge lines** at ±(ROAD_HALF − LINE_HALF): `0.6` units wide, color `0x555555`, `Y_LINE = Y_ROAD + 0.04`. Use 2-column ribbon (fine enough for narrow strips).
- UV V accumulates arc length so the gravel texture tiles cleanly along curves without stretching
- Gravel canvas texture: `256×256`, warm brownish-gray `#8a7a68` base + 5000 aggregate speckles with warm-tone variation
- `getRoadObstacles()` exports `CircleObstacle[]` (spine sampled every 4 units, radius 10) — called in `main.ts` before trees/props so vegetation is kept clear of the road corridor
- **Crystal formation** at north end: 11 **light white-pink** `ConeGeometry(r, h, 4)` pyramids with `rotateY(PI/4)` so flat faces point outward (true square-pyramid silhouette, not diamond-edged). Heights 14–24 units, base radii 5–10 units, buried 20% underground, varied tilts. Colors `0xffe8f5` / `0xfff0fa` / `0xfce4f0` / `0xfff5fc`, `emissive: 0x100808` pale pink glow. Blocks the road end.
- **Crystal collision**: `addCrystals` returns `CircleObstacle[]` (one per crystal, radius = base radius). `createRoad` returns `{ crystalObstacles }`, wired into `createPlayer` in `main.ts` so player cannot walk through any crystal.
- No collision barrier on the road surface itself — player walks freely on and off it

### Phase 3 Visual Checklist
- [x] Road visible from spawn to the east (right of player view)
- [x] Gravel surface, dark gray edge lines, no centerline
- [x] Road follows terrain contours — no grass poking through, no road floating
- [x] Trees and props cleared from road corridor
- [x] Road runs full map length (north crystals → south city entrance)
- [x] Crystal formation at north end — light white-pink square-pyramid spikes block the road; player cannot walk through them

---

## Phase 4 — Abandoned City + Gem ✅ COMPLETE

**Goal:** Follow the road south and arrive in a small abandoned city. Find the glowing gem near the apartment building.

**New files:** `src/city.ts`, `src/gem.ts`, `src/audio.ts`  
**Modified files:** `src/terrain.ts` (extended mesh), `src/road.ts` (asphalt city extension), `src/player.ts` (building collision), `src/main.ts`

### Terrain extension (actual implementation)

The terrain mesh was extended from 500×500 to 500×700 using `geometry.translate(0, 100, 0)` before `rotateX(-Math.PI/2)`, shifting the mesh south so Z spans [-450, +250]. Terrain amplitude flattens gradually using `flattenT = min(1, (-z-180)/80)` south of z=-180, leaving ~8% amplitude in the city zone. No separate flat ground plane — buildings use `getHeightAt` for their own Y.

`getHeightAt(x, z)` uses a single `Raycaster` against the one terrain mesh — no changes needed.

### `src/road.ts` — City asphalt extension

Gravel road (width 12) ends at `[4, -248]`. Asphalt city road (width 18, 1.5×) starts at the same point and continues to `[4, -440]`. Gravel SPINE now approaches junction from `[4, -216]` → `[4, -248]` (straight south approach, no sharp dog-leg). Asphalt sits 0.03 units above gravel at the junction to prevent z-fighting. Yellow dashed center line + white shoulder lines on asphalt.

### `src/city.ts`
City center around `(4, terrain, -330)`. Road center is `x=4`, road spans `x:[-5, 13]`. All buildings are set back from road edges with clearance.

**Buildings (all have windows + doors on all 4 faces — 'wens'):**

| Building | Position | Dims (w×d×h) | Color |
|---|---|---|---|
| Gas station | `(-22, y, -285)` | 14×10×5 | `0x8a7a5a` weathered beige |
| Grocery store | `(28, y, -285)` | 24×16×7 | `0x6a6a5a` (moved from x=20 — was overlapping road) |
| Apartment | `(25, y, -330)` | 20×15×25 | `0x5a5a6a` grey-blue, 10 window rows |
| House 1 | `(-18, y, -335)` | 10×8×4.5 + roof 3.5 | `0x6a5a4a` faded brown |
| House 2 | `(-14, y, -360)` | 12×9×5.0 + roof 3.5 | `0x5a6a5a` faded grey-green |
| House 3 | `(-21, y, -385)` | 11×9×4.5 + roof 3.0 | `0x7a6040` warm brown |
| Commercial 1 | `(27, y, -385)` | 15×11×7 | `0x6a5a5a` |
| Commercial 2 | `(-22, y, -410)` | 16×11×7 | `0x606050` |
| House 4 | `(29, y, -410)` | 10×8×4.5 + roof 3.5 | `0x3a5040` |
| House 5 | `(-18, y, -430)` | 9×7×4.0 + roof 2.5 | `0x4a3830` |
| Tall building | `(28, y, -430)` | 14×12×14, 4 window rows | `0x4a506a` |

- E-W cross street removed (was overlapping building footprints)
- Parking lot: 26×16 asphalt, centered at `(28, y, -268)` in front of grocery
- Stop signs: 2 at city entrance intersections
- Tumbleweed: wireframe sphere slowly spinning at `(8, y, -300)`
- Streetlights: 8 poles at x=±11/−8, z=-282/−310/−380/−420; `PointLight(0xffe080, 3.0, 25)` warm yellow glow

### `src/gem.ts`
- Floating diamond gem: `OctahedronGeometry(0.5, 0)`, `MeshPhongMaterial({ color: 0x6040ff, emissive: 0x300090, specular: 0xffffff, shininess: 150, transparent, opacity: 0.85 })`
- Position: `(-52, y, 108)` — hidden in the forest west of the road
- `PointLight(0x8060ff, 8, 22)` area glow + `PointLight(0x6030cc, 4, 12)` ground pool
- `update(dt)`: spin Y + bob vertically
- **4 surrounding pyramid crystals**: `ConeGeometry(2.5, 12, 4)` (height ~12 = deciduous tree height), same purple material, placed 12 units N/S/E/W of gem center at `(-52, y, 120)`, `(-52, y, 96)`, `(-40, y, 108)`, `(-64, y, 108)`. Rotated `PI/4` so faces point cardinal directions.
- `obstacles: CircleObstacle[]` — gem radius 1.5, each pyramid radius 3.0 (5 total — player can walk between crystals but not through them)
- Player spawns at `(-52, y, 130)` facing south into the formation

### `src/audio.ts` (new)
Forest ambient CC0 sound (`/assets/forest-ambient.mp3`). Autoplay on first keydown/click. Volume 0.9.

### `src/player.ts` additions
- Building collision: `isBlockedByBuilding(x, z, boxes, radius)` — AABB check
- Sprint: hold `ShiftLeft`/`ShiftRight` + `↑`/`↓` for 3× speed (24 u/s vs normal 8)
- Player spawns at `(-52, y, 130)` — north of crystal formation, facing south

### Phase 4 Visual Checklist
- [x] Road leads into city (no gap — gravel ends, asphalt begins at same point)
- [x] No trees in city area
- [x] Gas station (west) and grocery store (east) flank the road entrance
- [x] Parking lot in front of grocery store
- [x] Apartment building is tallest structure (25 units)
- [x] All windows near-black, all 4 faces of every building
- [x] Stop signs at city entrance
- [x] Tumbleweed slowly spinning
- [x] Streetlight warm yellow glow (8 posts)
- [x] Player cannot walk through buildings
- [x] Gem in forest at (-52, y, 108) — purple glow, spins and bobs
- [x] 4 pyramid crystals surround gem (height ~12, same purple material, 12 units out each direction)
- [x] Player spawns facing crystal formation
- [x] 11 buildings total extending city south to z=-430

### Phase 4 Tests
```
src/city.test.ts    — building collision boxes correct dimensions; AABB rejection
src/player.test.ts  — add isBlockedByBuilding tests
```
(Tests not yet written — visual validation complete.)

---

## Phase 5 — Birds ✅ COMPLETE

**Goal:** Crows rest in groups of 3–4 throughout the forest. Walk within 5 units of any bird and the whole group startles together — caw sound plays, all birds panic-flap, lift off, and scatter in different directions. Adds life and atmosphere without detailed art.

**New files:** `src/birds.ts`  
**Modified files:** `src/main.ts` (wire birds update)

### `src/birds.ts`

**Geometry (per bird — 5 mesh parts under a `THREE.Group`, shared geometries/materials across all 15):**

| Part | Geometry | Material | Notes |
|---|---|---|---|
| Body | `SphereGeometry(0.25, 6, 4)` scaled `(1, 0.6, 1.5)` | `0x111111` black | elongated ellipsoid, Z = front-back axis |
| Head | `SphereGeometry(0.12, 6, 4)` | black | at `(0, 0.14, 0.28)` above and forward of body |
| Beak | `ConeGeometry(0.04, 0.12, 4)` | `0xf0c020` yellow | child of head; `rotation.x = -PI/2` points it forward (+Z) |
| Wing L | `BoxGeometry(0.4, 0.04, 0.18)` in a child Group | black | Group at shoulder `(-0.25, 0, 0)`; mesh offset `-0.2` so inner edge is pivot |
| Wing R | same in mirrored Group | black | Group at `(0.25, 0, 0)`; mesh offset `+0.2` |

**Placement — grouped:**
- 4 groups (sizes 4, 4, 3, 4 = 15 birds), seeded RNG (seed 55)
- Each group has a random center in `[-170, 170]` XZ; birds scattered within 5 units of center
- 25-unit clearance around player spawn `(-52, 130)`

**State machine:**

| State | Trigger | Behavior |
|---|---|---|
| `resting` | — | wings folded `±0.15`; checks `shouldStartle` each frame |
| `startled` | player within **5 units** of any bird in group | **entire group startles at once**; plays `crow-caw.wav`; birds scatter in evenly-spread directions; 6 Hz panic flap; lifts 3 units over 0.5 s |
| `flying` | after 0.5 s | 4 Hz rhythmic flap; 10 u/s horizontal; climbs 5 u/s for 2 s then levels; faces `flightDir` via `atan2`; disposed when 150 units from spawn |

**Audio:** `public/assets/crow-caw.wav` (CC0, OpenGameArt). Three caws play sequentially per group startle — `ended` event re-triggers the same `Audio` object twice after first play.

**Exports:**
- `shouldStartle(birdX, birdZ, playerX, playerZ, radius): boolean` — pure helper, testable
- `createBirds(scene, getHeightAt): { update(dt, playerX, playerZ) }`

### Phase 5 Visual Checklist

- [x] ~15 black birds in 4 groups, resting on terrain throughout the forest
- [x] Birds have visible yellow beak
- [x] Wings visibly folded when resting
- [x] Walking within 5 units triggers group flight — all birds in group scatter at once
- [x] Crow caw plays on group startle
- [x] Birds spread in different directions when scattering (not all same angle)
- [x] Bird lifts off with rapid wing flap (panic flutter)
- [x] Bird flies away gaining altitude then leveling
- [x] Wing flap continues during flight (slower, rhythmic)
- [x] Birds dispose cleanly — no ghost meshes after flying away
- [x] No fps drop with 15 birds active
- [x] Birds do not spawn near player start position

### Phase 5 Tests (add after visual validation)

```
src/birds.test.ts — shouldStartle radius math; state transitions
```


---

## Phase 6 — Treasure Chests ✅ DONE

**Goal:** Scatter 8 battered pirate-style treasure chests throughout the forest. Walk close, press Space, and the lid swings open so the player can peer inside.

**New files:** `src/chests.ts`  
**Modified files:** `src/main.ts` (import + wire `updateChests`, move before `createPlayer`)  
**`src/input.ts` not touched** — `isKeyDown('Space')` already works since `keys.add(e.code)` captures all keys.

### `src/chests.ts` — actual implementation

**Geometry (2× scale, H=1.60 for deep interior — player eye=1.70, chest top=1.60):**

| Part | Geometry | Material | Notes |
|---|---|---|---|
| Body | `BoxGeometry(1.60, 1.60, 1.00)` | wood `0x3d1f08` DoubleSide + transparent top face | open top lets player see inside |
| Lid | `BoxGeometry(1.60, 0.60, 1.00)` | wood DoubleSide | pivots from back-top hinge |
| Interior floor | `BoxGeometry(1.44, 0.02, 0.84)` | velvet `0x2a0808` | visible through open top |
| Metal bands (×2) | `BoxGeometry(1.68, 0.12, 1.08)` | iron `0x3a3a3a` | at y=0.28 and y=1.22 |
| Lock hasp | `BoxGeometry(0.20, 0.24, 0.12)` | `0x5a5a5a` | front face (-Z), z=-(0.5+0.08) |
| Interior light | `PointLight(0xffa040, 0→4, 6)` | — | amber glow; dims to 1 after loot; fades to 0 on close |
| **Armor** | gold chest plate — see below | gold | `visible=false` until `'open'` state; floats above chest |

**Armor geometry (gold chest plate, hovers at H+0.45=2.05 u above terrain when open):**

| Part | Geometry | Material | Position (armor-local) |
|---|---|---|---|
| Main plate | `BoxGeometry(0.68, 0.78, 0.10)` | `0xd4a020` gold, emissive `0x3a2800` | origin |
| Shoulder guards ×2 | `BoxGeometry(0.26, 0.24, 0.12)` | `0xa07810` dark gold | `(±0.47, 0.33, 0)` |
| Neck guard | `BoxGeometry(0.28, 0.14, 0.10)` | dark gold | `(0, 0.46, 0)` |
| Waist band | `BoxGeometry(0.62, 0.12, 0.10)` | gold | `(0, -0.45, 0)` |
| Mid-chest rib | `BoxGeometry(0.58, 0.06, 0.11)` | dark gold | `(0, 0.05, 0.01)` |

The armor group is a child of each chest group. While `'open'`, it spins (Y-axis, 1.5 rad/s) and bobs (`±0.08 u` at 2 Hz). At 2.05 u above terrain vs player eye at 1.70 u — armor hovers ~0.35 u above eye level, visible without camera pitch.

**Open-top technique:** `BoxGeometry` material index 2 = +Y face. Pass `[_wood, _wood, _open, _wood, _wood, _wood]` to body Mesh; `_open` is `transparent:true, opacity:0, depthWrite:false`. `_wood` uses `side: THREE.DoubleSide` so inner walls render when looking through the opening.

**Lid hinge:** `lidGroup.position = (0, 1.60, 0.50)` — back-top edge of body. `lidMesh.position = (0, 0.30, -0.50)` inside lidGroup so its back-bottom edge sits at the hinge origin. Rotation `+2.1 rad` swings lid UP and backward (away from player).

**Hitbox:** `createChests` returns `obstacles: CircleObstacle[]` (radius 0.95 per chest). Called in `main.ts` BEFORE `createPlayer` so chest obstacles are passed to player collision: `[...mountainObstacles, ...gemObstacles, ...chestObstacles]`. Player stops at 1.45 u from chest center — at the surface, still within 3-unit interaction range.

**Placement (seeded LCG seed 77, 8 chests):** exclude spawn (<8 u), city zone, road corridor, mountain bases (+4 buffer). Each chest placed at `getHeightAt(x,z)`, random Y rotation.

**State machine:** `'closed' → 'opening' → 'open' → 'looted' → 'closing' → 'closed'`. Space bar edge-triggered (`spaceJustPressed = spaceDown && !spaceWasDown`). Nearest interactable chest within 3 u is targeted.
- Space (closed) → `'opening'`: lid 0→+2.1 rad, light 0→4, duration 0.6 s. On complete → `'open'`, `armor.visible = true`.
- Space (open) → `'looted'`: `armor.visible = false`, light snaps to 1 (empty chest dim glow).
- Space (looted) → `'closing'`: `animTimer` starts at 0.6 and counts down. Lid +2.1→0, light 1→0. On complete → `'closed'`.

### Phase 6 Visual Checklist

- [ ] ~8 chests visible in the world, varied orientations
- [ ] Chests look distinctly pirate — dark wood, metal bands, visible lock hasp
- [ ] Lid is flat closed when resting
- [ ] Walking within 3 units + pressing Space swings the lid open
- [ ] Lid animates smoothly (~0.6 s) — not an instant snap
- [ ] Lid swings UP and backward (away from player, +X rotation)
- [ ] Gold chest plate appears floating/spinning above the open chest
- [ ] Second Space press picks up the armor (plate disappears, light dims)
- [ ] Third Space press closes the chest (lid swings back, light fades)
- [ ] No fps drop with 8 chests in the scene
- [ ] Chests do not spawn inside trees or mountain bases

### Phase 6 Tests (add after visual validation)

```
src/chests.test.ts — isNearChest radius math; opening animation clamp
```

### Phase 6 Commit

```
feat(chests): interactive pirate treasure chests that open on approach + Space
```

---

## Phase 7 — Monsters

**Goal:** Populate the forest and city with three distinct enemy creatures that roam or float near the player. They are visual-only for now (no AI or combat) — just enough geometry to define their look so we can iterate before committing to implementation.

**New files:** `src/monsters.ts`  
**Modified files:** `src/main.ts` (wire monster update)

### Design (from pencil sketches in `docs/`)

All three monsters share a single **indigo palette** — the colour ties them together as inhabitants of the same dark world.

| Material | Hex | Role |
|---|---|---|
| `iBody` | `0x4a2090` | main body |
| `iMid` | `0x6030a8` | joints, face accents |
| `iLight` | `0x7a52c8` | crystal spikes (troll) |
| `iDark` | `0x1e0a48` | eye sockets, claws, hair |
| `iCloth` | `0x38156a` | torn clothing patches |
| `iGlow` (iris) | `0xaa66ee` + emissive `0x7733cc` | flying eye iris |

---

### Crystal Troll (`docs/crystal-troll.png`)

Stocky humanoid, ~2.2 units tall. Arms raised with clawed hands.

**Geometry approach — CapsuleGeometry for all limbs, SphereGeometry for head/joints:**

| Part | Geometry | Notes |
|---|---|---|
| Feet | `CapsuleGeometry(0.07, 0.14)`, `rotation.x = π/2` | horizontal, pointing forward |
| Calves | `CapsuleGeometry(0.09, 0.32)` total h=0.50 | |
| Knee joints | `SphereGeometry(0.105)` | |
| Thighs | `CapsuleGeometry(0.12, 0.24)` total h=0.48 | converge toward center |
| Hips | `SphereGeometry(0.19)` + `CapsuleGeometry(0.18, 0.02)` | `iCloth` pants |
| Chest | `CapsuleGeometry(0.24, 0.14)` total h=0.62 | stocky, wide |
| Shoulder joints | `SphereGeometry(0.135)` | |
| Neck | `CapsuleGeometry(0.10, 0.06)` total h=0.26 | short, thick |
| Head | `SphereGeometry(0.27)` | slightly oversized for troll |
| Eyes | `SphereGeometry(0.065)` `iDark` | on head surface at z≈+0.25 |
| Brow ridge | `BoxGeometry(0.36, 0.07, 0.09)` `iDark` | |
| Nose | `ConeGeometry(0.065, 0.16, 4)`, `rotation.x = -π/2` | pointy, forward |
| Ears | `ConeGeometry(0.055, 0.19, 4)`, `rotation.z = ±π/2` | side of head |
| Crystal spikes (×3) | `ConeGeometry(0.07, 0.37, 5)` `iLight` | crown of head, varied tilt |
| Upper arms | `CapsuleGeometry(0.09, 0.26)` total h=0.44 | `rotation.z` computed from joint angle |
| Elbow joints | `SphereGeometry(0.095)` | |
| Forearms | `CapsuleGeometry(0.085, 0.23)` total h=0.40 | |
| Fists | `SphereGeometry(0.095)` | |
| Claws (×3 per hand) | `ConeGeometry(0.06, 0.26, 4)` `iDark` | splayed from fist |

**Arm angle computation** — capsule default axis is +Y; `rotation.z = θ` tilts axis to `(-sin θ, cos θ)`. Upper arm: θ = `side * 0.87` (~50° outward). Forearm: θ = `side * 0.52` (~30° outward). Joint world positions are computed analytically from θ and total capsule length so elbow/hand land exactly right.

**Crystal spikes**: `iLight` (lighter indigo, same hue family) — no emissive glow. The spikes are the same indigo as the body, just a lighter shade. Previously tried cyan `0x88eeff` — rejected as too bright and wrong colour.

---

### Flying Eye (`docs/flying-eye-monster.png`)

Abstract floating creature — a glowing indigo sphere with an iris and two side cones. Minimal geometry, maximum read.

| Part | Geometry | Notes |
|---|---|---|
| Outer sphere | `SphereGeometry(0.55, 24, 20)` `iBody` | sclera / shell |
| Iris | `SphereGeometry(0.36, 20, 16)` `iGlow` | nested inside, z+0.30 |
| Pupil | `SphereGeometry(0.18, 16, 12)` `iPupil` | z+0.52 |
| Side cones (×2) | `ConeGeometry(0.10, 0.28, 5)`, `rotation.z = ±π/2` | float either side at x=±0.72 |

**Nothing below the sphere** — earlier iterations added a dangling teardrop and a laser beam, both removed per design review.

**Animation:** bobs vertically `±0.12` at 1.3 Hz; slow Y-rotation `±0.25 rad` at 0.4 Hz; iris tilts on X and Y axes for a "looking around" effect.

Float height: eye-level for a standing player (~2.85 units).

---

### Winged Monster (`docs/winged-monster.png`)

Narrow humanoid, similar height to Crystal Troll but more elegant. Bat wings from upper back. T-pose arms. Spiky hair, no mouth.

**Body uses same CapsuleGeometry/SphereGeometry approach, narrower proportions:**

- Calves: `CapsuleGeometry(0.08, …)` vs troll `0.09`
- Chest: `CapsuleGeometry(0.17, …)` vs troll `0.24` — narrower, more menacing
- Clothing: hips + lower torso in `iCloth`

**Wings** (built per side):
- Main spar: `CapsuleGeometry(0.055, …)` from upper back `(±0.22, 1.58)`, angled ~60° from vertical (`rotation.z = side * 1.05`)
- Secondary spar from main spar tip, less steep (`rotation.z = side * 0.36`)
- Upper membrane: `PlaneGeometry(1.08, 0.84)`, `DoubleSide`, ~85% opacity, dark indigo `0x2a1060`
- Lower membrane: `PlaneGeometry(0.88, 1.10)`, hangs down from spar

**Arms**: horizontal T-pose — `CapsuleGeometry` with `rotation.z = ±π/2` (makes capsule axis point ∓X). Upper arm → elbow sphere → forearm → hand sphere, computed from shoulder position.

---

### Geometry strategy note

Three.js `CapsuleGeometry` (available since r142, confirmed present in r176) produces significantly more organic-looking limbs than `BoxGeometry`. The previous box-based attempt looked like Minecraft characters. Switching to capsule+sphere for all limb and head geometry resolved this.

**Alternative considered**: loading GLTF models (e.g. from [Quaternius](https://quaternius.com) — free CC0 rigged character packs). This remains a valid upgrade path if more anatomical accuracy is needed once the game design is further along. `GLTFLoader` is already in Three.js r176 addons.

**Preview file**: `src/temp/monster-preview.html` — standalone HTML (Three.js via CDN, no build step) showing all three monsters side by side on a daylight background. **Read this file for the exact per-part world positions and rotations** — all y-coordinates, x-offsets, arm angles, and wing spar positions are already computed and visually validated there. Use it as the reference implementation when writing `src/monsters.ts`.

**CapsuleGeometry API note**: `new THREE.CapsuleGeometry(radius, length, capSubdivisions, radialSegments)` — `length` is the *cylinder section only* (not total height). Total height = `length + 2 * radius`. The preview uses a `cap(totalH, r, …)` helper that computes `len = Math.max(0, totalH - 2*r)` automatically.

---

### Monster design decisions (from visual refinement sessions)

**Palette** — medium blue (not dark navy): `iBody=0x2050a0`, `iMid=0x2e68cc`, `iDark=0x0c1e44`, `iCloth=0x183870`

**Crystal spikes** — 4-sided pyramid (`ConeGeometry(0.095, 0.40, 4)`, `rotation.y = π/4`), steel-blue `iCrystal=0x4a85b5` with emissive `0x1e4d88`. Darker than original baby-blue; not the same as the body.

**Eyes (both troll and winged monster)** — white pointed-oval `ShapeGeometry` (bezier lens). Inner corner DOWN, outer corner UP = angry scowl. Left eye `tiltZ = -0.32`, right eye `tiltZ = +0.32`. (Positive CCW rotation makes the right end go up; for left eye the right side is the inner corner.)

**Crystal Troll arms** — go OUTWARD from shoulders, not inward. Upper arm direction `(side*0.94, 0.34)`; forearm bends up `(side*0.50, 0.87)`. Use `rz = atan2(-dx, dy)` for capsule rotation from a unit direction vector. Three claws fan from the hand in the forearm direction, spread ±0.24 rad perpendicular.

**Dragon wings** — arm spar goes outward to wrist; then 3 finger spars spread SYMMETRICALLY: F1 (up, +spread), F2 (horizontal, furthest out), F3 (down, −spread). F1 and F3 are exact mirrors around the wrist height. Membrane outline: body→wrist→F1 (straight)→scallop→F2→scallop→F3→lower body→close. Scallop control pulled inward (toward body) for concave bat-wing edge.

**Wing membrane `sparBone` helper** — given (x1,y1)→(x2,y2), computes `rz = atan2(-dx/len, dy/len)` and draws a thin capsule at the midpoint. Cleaner than using direction vectors inline.

### `src/monsters.ts` — Flying Eye ✅ DONE (in city)

Flying Eye is implemented in `src/monsters.ts` and wired into `main.ts`. World position: `(0, groundY + 5.0, -310)` — city main intersection, ~5 units above ground (visibly above player). Behavior:
- Bobs vertically `±0.30` at 1.3 Hz (doubled); drifts side-to-side `±0.80` at 0.35 Hz (doubled)
- Iris scans (rotation.x, rotation.y) each frame; pupil also rotates
- **Player tracking**: smooth slerp toward player using `setFromUnitVectors(forward, dir)` at 1.2 rad/s. The eye's local +Z faces the player — iris always looks at them.
- Purple `PointLight(0x8060ff, 3, 14)` glow
- Side cones updated: `ConeGeometry(0.10, 0.32, 5)` with quaternion-computed outward orientation
- Takes `groundY` parameter (not `CITY_GROUND_Y` import — that constant was removed from terrain.ts)

Crystal Troll and Winged Monster: geometry defined in `src/temp/monster-preview.html` (visually validated), not yet added to `src/monsters.ts`.

**Remaining for full Phase 7:**
- Add Crystal Troll at (35, terrain, 55) — copy geometry from preview
- Add Winged Monster at (−50, terrain, 80) — copy geometry from preview
- Export unified `{ update(dt) }` for both

### Phase 7 Visual Checklist

- [x] Flying Eye in city — bobs, drifts, tracks player with iris
- [ ] Crystal Troll placed in forest
- [ ] Winged Monster placed in forest
- [ ] Medium-blue palette consistent across all three
- [ ] Crystal spikes (steel-blue 4-sided pyramids) on troll and winged monster
- [ ] Angry squinted eyes (inner down, outer up) on troll and winged monster
- [ ] Troll arms spread outward with fanned claws
- [ ] Dragon wings with 3 symmetric ridges on winged monster
- [ ] No fps drop with all three active

---

---

## Phase 8 — Capybaras ✅ DONE

**Goal:** Add ~10 capybaras grazing in the forest, grouped in clusters of 3–4. They are visual-only (no AI). Each slowly bobs its head as if eating from the ground, adding life and charm to the world.

**New files:** `src/capybaras.ts`  
**Modified files:** `src/main.ts` (import + wire `updateCapybaras`)

### `src/capybaras.ts` — actual implementation

**Groups:** 3 groups — `[true,true,false]`, `[true,true,false]`, `[true,true,false,false]` (true=large, false=small) = 10 total. Seeded LCG seed 88.

**Per-capybara geometry — body/legs are `BoxGeometry`; head is an oval `SphereGeometry`:**

| Part | Geometry | Material | Position in root/headGroup | Notes |
|---|---|---|---|---|
| Body | large: `BoxGeometry(1.00,0.55,1.80)`; small: `(0.65,0.38,1.20)` | brown `0x7a4a1e` | `(0, lH+bH/2, 0)` | |
| Legs (×4) | large: `BoxGeometry(0.10,0.40,0.10)`; small: `(0.08,0.28,0.08)` | **black** `0x111111` | corners at `(±bW/2-lW/2, lH/2, ±bL/2-lW/2)` | black stick legs |
| headGroup | pivot | — | `(0, lH+bH, bL/2)` in root | rotation.x bobs 0↔0.35 rad |
| Head | shared `SphereGeometry(1,8,6)` scaled per size | brown | center at `(0, hrY, hrZ)` | large: scale `(0.30,0.25,0.40)` → ellipsoid W=0.60, H=0.50, L=0.80; small: `(0.21,0.18,0.28)` |
| Ears (×2) | large: `BoxGeometry(0.13,0.16,0.08)`; small: `(0.10,0.12,0.06)` | brown | `(±hrX*0.72, 2*hrY+eH/2, hrZ*0.55)` | top of head, back portion |
| Eyes (×2) | large: `0.09` sq; small: `0.07` sq; depth `0.02` | **black** | `(±hrX*0.50, 2*hrY-eyeS*0.3, hrZ*1.35)` | **on TOP of head**, forward half — visible from above |
| Nose | large: `BoxGeometry(0.14,0.09,0.06)`; small: `(0.10,0.07,0.06)` | **black** | `(0, hrY*0.55, 2*hrZ)` | **black** square at snout tip |

**Eating animation:** `headGroup.rotation.x = (1 - cos(globalT * bobSpeed + phase)) * 0.175`. Oscillates 0 ↔ 0.35 rad. `bobSpeed` = 0.8–1.4 rad/s (one graze cycle every 4.5–7.8 s). Phase randomized so animals in a group don't nod in sync.

**Placement:** group centers in `x:[-150,150], z:[-130,130]`; 30 u clearance from player spawn `(-52, 130)`; avoid road corridor and city zone; 8 u buffer from excludeZones (mountains + road obstacles). Individuals offset ±5 u from group center.

### Phase 8 Visual Checklist

- [ ] ~10 capybaras visible in the forest in clusters of 3–4
- [ ] Large and small sizes clearly distinct
- [ ] Black stick legs, brown rectangular body, oval brown head
- [ ] Head bobs smoothly (grazing motion) — not snappy, staggered between animals
- [ ] Small square ears on top-back of oval head
- [ ] Black square eyes on TOP of head, set back from snout (not on front face)
- [ ] Black square nose at snout tip
- [ ] No fps drop with 10 capybaras active

### Phase 8 Tests (add after visual validation)

```
src/capybaras.test.ts — group placement clearance; head bob clamp
```

### Phase 6 armor one-time-loot fix (also in this commit)
`armorLooted: boolean` added to the `Chest` interface. Once armor is picked up, `armorLooted = true` permanently — reopening the same chest shows an empty interior (light still works, lid still animates). The `'open'` state only sets `armor.visible = !armorLooted` when the opening animation completes.

---

## Phase 9 — City Ghosts

**Goal:** 3 white translucent ghosts slowly float between buildings in the city. Each ghost waits inside a building for 12–28 seconds, then emerges and drifts to a neighboring building, triggering a door-close sound on arrival. Doors on buildings are changed from near-black to a visible gray-brown so they read as closed.

**New files:** `src/ghosts.ts`  
**Modified files:** `src/city.ts` (door colors), `src/main.ts` (wire `updateGhosts`)

### `src/ghosts.ts`

**Geometry (per ghost — shared across all 3, white translucent):**

| Part | Geometry | Material | Position (group-local) | Notes |
|---|---|---|---|---|
| Body | `CylinderGeometry(0.8, 1.1, 4.5, 10)` | white, opacity 0.82 | `(0, 2.25, 0)` | slightly wider at base, tapers up |
| Head | `SphereGeometry(0.9, 10, 8)` | white, opacity 0.82 | `(0, 5.4, 0)` | round top, flush with body |
| Eyes (×2) | `SphereGeometry(0.18, 6, 5)` | `0x1a1a33` dark | `(±0.3, 5.45, 0.82)` | face forward (+Z) |
| Shadow | `PlaneGeometry(2.6, 1.2)` | black, opacity ~0.25 | terrain below ghost | separate from group; opacity tied to height |

Total ghost height: ~6.3 units. Float height (group origin above terrain): 1.0 unit → top reaches ~7.3 units (slightly less than a large deciduous tree).

**Building waypoints** (city building centers, hardcoded in ghosts.ts):
```ts
const BUILDINGS: [number, number][] = [
  [-22, -285], [28, -285], [25, -330],  [-18, -335],
  [-14, -360], [-21, -385], [27, -385], [-22, -410],
  [29, -410],  [-18, -430], [28, -430],
];
```

**State machine per ghost:**

| State | Trigger | Behavior |
|---|---|---|
| `'dormant'` | — | hidden; countdown timer 12–28 s |
| `'floating'` | countdown hits 0 | visible; lerps toward dst at 3.5 u/s; vertical bob ±0.3 u at 1.8 Hz; shadow tracks below |
| → arrival | remaining dist ≤ move step | hides; picks new route; returns to `'dormant'` |

Ghost faces direction of travel each frame via `group.rotation.y = atan2(dx, dz)`.

**Door colors:** All building doors changed from near-black `0x1a0e08` / `0x2a1a0a` to warm gray-brown `0x7a6655` — clearly reads as a closed door panel without blending into window darkness or building walls.

### Phase 9 Visual Checklist

- [ ] 3 white translucent ghosts float between buildings in the city
- [ ] Ghost has rounded head, slightly wider-based body, two dark eyes
- [ ] Ghost floats 1 unit above terrain — clearly not walking
- [ ] Ghost bobs gently up/down while moving
- [ ] Ghost faces direction of travel
- [ ] Dark oval shadow on ground below each ghost
- [ ] Shadow opacity increases as ghost descends closer to ground level
- [ ] Ghost appears/disappears at buildings (not in open space)
- [ ] Ghosts stagger their wait times — not all active simultaneously
- [ ] Doors on buildings are visible gray-brown, not near-black
- [ ] No fps drop with 3 ghosts active

### Phase 9 Tests (add after visual validation)

```
src/ghosts.test.ts — ghost routing picks different src/dst; arrival detection
```

---

## TypeScript Interfaces (shared across modules)

```ts
// terrain.ts
export interface TerrainResult { mesh: THREE.Mesh; getHeightAt: (x: number, z: number) => number; }

// trees.ts
export interface TreePosition { x: number; z: number; radius: number; }

// city.ts
export interface BuildingBox { minX: number; maxX: number; minZ: number; maxZ: number; }
export interface CityResult { collisionBoxes: BuildingBox[]; update: (dt: number) => void; }

// birds.ts
type BirdState = 'resting' | 'startled' | 'flying';
export interface Bird {
  group: THREE.Group;
  state: BirdState;
  flightDir: { x: number; z: number };
  flightTimer: number;
  distanceFromSpawn: number;
}
```

---

## Key Architecture Decisions

| Decision | Reason |
|---|---|
| Phased delivery | See something working at each step; validate visually before adding complexity |
| `stats.js` from Phase 0 | Permanent dev tool — catches performance regressions as features are added |
| `FogExp2` not `Fog` | Exponential fog feels physically natural; linear fog has a hard cutoff that looks artificial |
| `MeshLambertMaterial` not `MeshStandardMaterial` | Lambert's flat shading complements stylized geometry; PBR looks "real" in a way that clashes with procedural shapes |
| InstancedMesh for 400 trees | Without it: ~1600 draw calls. With it: 4. Pattern established now scales if tree count grows. |
| `camera.rotation.order = 'YXZ'` | FPS cameras need yaw-first. Default `'XYZ'` causes roll when looking up/down. Set correctly in Phase 0 so adding pitch later works without breaking anything. |
| Pure math functions exported alongside Three.js constructors | Lets Vitest test movement/collision logic in Node without a WebGL context |
| Tests added after visual validation | A phase that looks wrong visually tells you more than a failing unit test at this stage of development |
