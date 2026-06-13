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
         N (spawn)
    [dense forest]
    [forest + road winding south]
    [city entrance]
    [abandoned city — gem here]
         S
```

500×500 unit world. The road winds from the forest into the city. No trees in city zone. Gem is at the apartment building.

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
    ├── road.ts              # asphalt road  [Phase 3 — not yet built]
    ├── city.ts              # buildings, parking, props  [Phase 4 — not yet built]
    ├── gem.ts               # gem geometry + animation  [Phase 4 — not yet built]
    ├── birds.ts             # crows that startle on approach  [Phase 5 — not yet built]
    └── chests.ts            # treasure chests, Space to open  [Phase 6 — not yet built]
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

### Files to create in Phase 0

**`src/input.ts`**
```ts
const keys = new Set<string>();
export const initInput = () => {
  window.addEventListener('keydown', e => keys.add(e.code));
  window.addEventListener('keyup',  e => keys.delete(e.code));
};
export const isKeyDown = (code: string): boolean => keys.has(code);
// FUTURE: add 'Space' for interact, 'Escape' for pause
```

**`src/scene.ts`** — exports `initScene(canvas)` → `{ scene, renderer, camera }` and `onResize()`
- `WebGLRenderer({ antialias: true })`, shadows enabled
- `PerspectiveCamera(70, aspect, 0.1, 800)`
- Clear color: `0x87CEEB` (plain daylight sky for Phase 0 — replaced in Phase 2)
- `AmbientLight(0xffffff, 0.6)`, `DirectionalLight(0xfff4e0, 1.0)` position `(80, 120, 50)`
- No fog yet (Phase 2)
- stats.js: `import Stats from 'stats.js'` — attach to DOM, call `stats.begin()/end()` in game loop

**`src/terrain.ts`** — exports `createTerrain(scene)` → `{ mesh, getHeightAt }`
- `PlaneGeometry(500, 500, 100, 100)` rotated to XZ
- Height formula (pure, exported separately for testing later):
  ```ts
  export function computeTerrainHeight(x: number, z: number): number {
    return Math.sin(x * 0.015) * 8 + Math.cos(z * 0.018) * 7
      + Math.sin(x * 0.05 + z * 0.04) * 3
      + Math.cos(x * 0.09) * Math.sin(z * 0.08) * 2;
  }
  ```
- `MeshLambertMaterial({ color: 0x4a7c3f })` — mid green (darkened in Phase 2)
- `mesh.receiveShadow = true`
- `getHeightAt(x, z)`: downward Raycaster from `(x, 200, z)` → returns Y hit or 0
- Mountains: 6–8 `ConeGeometry(60, 120, 5)` cones placed at radius 380–440, color `0x8a9a9a`. These are visual-only — no collision ever needed.

**`src/player.ts`** — Phase 0 version: rotation only, no movement
- State: `yaw = 0`
- `TURN_SPEED = 1.8` rad/s
- `update(dt)`: Left arrow → `yaw += TURN_SPEED * dt`, Right → subtract
- Camera: position fixed at `(0, getHeightAt(0,0) + 1.7, 0)`, rotation `(0, yaw, 0, 'YXZ')`
- `'YXZ'` rotation order is critical — set it now so adding pitch later doesn't break anything
  ```ts
  // FUTURE: add Up/Down arrow pitch here (Phase 1 adds forward movement instead)
  // FUTURE: posX/posZ will be player world position when movement is added in Phase 1
  ```

**`src/main.ts`**
```ts
import * as THREE from 'three';
import Stats from 'stats.js';
import { initScene, onResize } from './scene';
import { createTerrain } from './terrain';
import { createPlayer } from './player';
import { initInput } from './input';
// FUTURE Phase 1: import { createTrees } from './trees';
// FUTURE Phase 2: import { createAtmosphere } from './atmosphere';
// FUTURE Phase 2: import { createProps } from './props';
// FUTURE Phase 3: import { createRoad } from './road';
// FUTURE Phase 4: import { createCity } from './city';
// FUTURE Phase 4: import { createGem } from './gem';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const { scene, renderer, camera } = initScene(canvas);
const stats = new Stats(); document.body.appendChild(stats.dom);
initInput();
const { getHeightAt } = createTerrain(scene);
const { update: updatePlayer } = createPlayer(camera, getHeightAt);

const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  stats.begin();
  const dt = clock.getDelta();
  updatePlayer(dt);
  // FUTURE Phase 1: updatePlayer gains movement; add updateTrees(dt) here
  // FUTURE Phase 4: updateGem(dt); checkGemPickup(); updateCity(dt);
  renderer.render(scene, camera);
  stats.end();
}
loop();
window.addEventListener('resize', onResize);
```

### Phase 0 Scaffold Steps

1. ~~`yarn create vite . --template vanilla-ts`~~ — already done
2. ~~Delete Vite boilerplate; replace `index.html` with canvas-only page~~ — done
3. ~~`yarn add three stats.js`~~ — done (`stats.js` in `package.json`)
4. ~~`yarn add -D vitest`~~ — done
5. Create `src/` files as above
6. `yarn dev` → open `localhost:5173`

### Phase 0 Visual Checklist (validate before moving to Phase 1)

- [ ] Page loads, no console errors
- [ ] Terrain visible as a green undulating plane with gentle hills
- [ ] Distant mountain silhouettes visible (6+ peaks)
- [ ] Sky is blue (not black)
- [ ] Left arrow rotates view left, right arrow rotates right
- [ ] Camera stays at correct ground height (doesn't float above or clip into terrain)
- [ ] `stats.js` FPS counter visible in top-left corner, showing 60fps
- [ ] No WebGL errors in console

### Phase 0 Commit
```
git add . && git commit -m "Phase 0: terrain, mountains, sky, camera rotation"
```

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
- `scene.background = new THREE.Color(0x1a2a4a)` — dark navy night sky
- `scene.fog = new THREE.FogExp2(0x1a2a4a, 0.004)` — matching fog color
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
- [ ] Dense forest visible — trees fill the world
- [ ] Arrow Up walks forward, Down walks backward, Left/Right still rotate
- [ ] Camera follows terrain height over hills (no floating or clipping)
- [ ] Can't walk through trees (pushback works)
- [ ] Can't walk off world edge
- [ ] 60fps in dense forest sections

### Phase 1 Tests (add after visual validation)
```
src/__tests__/terrain.test.ts   — computeTerrainHeight range check
src/__tests__/player.test.ts    — movement delta math, tree collision, world clamp
```

### Phase 1 Commit
```
git add . && git commit -m "Phase 1: trees, forward/back movement, tree collision"
```

---

## Phase 2 — Atmosphere (Dusk + Rocks + Grass) — Props ✅ Done, Atmosphere Pending

**Goal:** Transform the neutral daytime scene into the dusk mystery atmosphere. Add ground detail props.

**New files:** `src/atmosphere.ts` (pending), `src/props.ts` ✅ done  
**Modified files:** `src/scene.ts` (update light/fog colors), `src/terrain.ts` (darker ground color)

### `src/props.ts` ✅ COMPLETE
All props use InstancedMesh. Accepts `mountainObstacles` to keep props out of mountain bases.
- **200 small/medium rocks** (scale 0.3–1.4) + **45 large boulders** (scale 1.5–3.5): `DodecahedronGeometry(0.7, 0)`, dome-based — center positioned below groundY so only the upper dome is visible
- **250 main bushes** (scale 0.6–1.4) + **400 small ground-cover shrubs** (scale 0.2–0.55): `IcosahedronGeometry(1.0, 1)`, dome-based with varied XZ/Y ratios per instance for natural irregular shape. Grass tufts (crossed planes) removed — replaced by these ground-cover shrubs.

### `src/atmosphere.ts` — PENDING
- Encapsulates all dusk-specific settings as named constants (easy to tweak)
- Exports `applyDuskAtmosphere(scene, renderer)`:
  - `renderer.setClearColor(0x1a1228)` — deep purple-black sky
  - `scene.fog = new THREE.FogExp2(0x1a1228, 0.018)` — heavy purple fog, trees fade ~80 units out
  - Updates `AmbientLight` to `0x2a1a4a` (blue-purple, dim)
  - Updates `DirectionalLight` to `0xc4601a` (warm orange-amber), repositioned to `(-300, 40, -200)` — very low dusk sun from west, casts long shadows
  - Adds secondary `DirectionalLight(0x3a2060, 0.3)` from east — cool purple fill, no shadows
- Terrain material color updated to `0x1a2e12` (near-black dark green)

### Phase 2 Visual Checklist
- [x] Rocks scattered on terrain (done)
- [x] Grass tufts visible near player (done)
- [x] Bushes visible as low dome shapes (done)
- [ ] Sky is deep purple-black
- [ ] Heavy fog — trees beyond ~80 units fade to silhouettes
- [ ] Orange dusk sun casts long shadows from low angle
- [ ] Terrain is near-black dark green
- [ ] Still 60fps

### Phase 2 Tests
```
src/__tests__/atmosphere.test.ts  — fog density constant in expected range
src/__tests__/props.test.ts       — prop positions stay within world bounds
```

### Phase 2 Commit
```
git add . && git commit -m "Phase 2: dusk atmosphere, rocks, grass"
```

---

## Phase 3 — Road

**Goal:** A two-lane asphalt road with a yellow centerline winds from the forest southward. Following it feels like discovering a path.

**New files:** `src/road.ts`

### `src/road.ts`
- Hand-placed waypoints defining the road centerline (south from `z=-60` to `z=-230`, gently curving)
- Road surface: series of `PlaneGeometry` quads ~8 units wide, laid along waypoints, color `0x1a1a1a`
- Yellow centerline: dashed `PlaneGeometry` strips, color `0xc8a800`, offset slightly above road to prevent Z-fighting
- Road follows terrain naturally (no special flattening needed with gentle hills)
- Exports `{}` — no collision needed (road is open, player walks freely on/off it)
```ts
// FUTURE: flatten terrain under road when upgrading terrain generator
// FUTURE: add cracked pavement texture when asset pipeline is added
// FUTURE: add road shoulder gravel strip
```

### Phase 3 Visual Checklist
- [ ] Road visible from above, dark asphalt surface
- [ ] Yellow centerline dashes visible
- [ ] Road winds naturally through hills, not floating
- [ ] Road visually connects forest zone to where city will be

### Phase 3 Commit
```
git add . && git commit -m "Phase 3: two-lane road through forest"
```

---

## Phase 4 — Abandoned City + Gem

**Goal:** Follow the road south and arrive in a small abandoned city. Find the glowing gem near the apartment building.

**New files:** `src/city.ts`, `src/gem.ts`  
**Modified files:** `src/trees.ts` (exclude city zone), `src/player.ts` (add building collision), `src/main.ts`

### `src/city.ts`
City center around `(0, y, -300)`. No trees inside `[-60, 60] × [-260, -380]`.

**Buildings:**

| Building | Geometry | Position | Color |
|---|---|---|---|
| Gas station | Flat body + canopy + pump boxes | `(-22, y, -285)` | `0x8a7a5a` weathered beige |
| Grocery store | Wide flat storefront | `(20, y, -285)` | `0x6a6a5a` |
| Parking lot | Dark asphalt plane + faded space lines | In front of grocery | `0x252525` |
| Apartment building | Tall 10-floor block | `(25, y, -330)` | `0x5a5a6a` grey-blue |
| House 1 | Body + triangular prism roof + yard | `(-18, y, -335)` | `0x6a5a4a` faded brown |
| House 2 | Same, slightly larger | `(-14, y, -360)` | `0x5a6a5a` faded grey-green |

- Windows: near-black `PlaneGeometry` planes (offset 0.01 to prevent Z-fighting) — darkness signals abandonment
- Stop signs: red octagon + grey post at 2–3 intersections
- Sidewalks: grey `PlaneGeometry` strips
- Tumbleweed: wireframe `SphereGeometry(0.4, 6, 4)`, color `0x7a6a40`, slowly spinning in place
- Streetlights: dim `PointLight(0x4a3010, 0.4, 20)` on cylinder poles — barely working

Exports `{ collisionBoxes: BuildingBox[], update(dt: number) }` — `update` spins the tumbleweed

### `src/gem.ts`
- `OctahedronGeometry(0.5, 0)` — orange-sized, diamond-like facets
- `MeshPhongMaterial({ color: 0x6040ff, emissive: 0x300090, specular: 0xffffff, shininess: 150, transparent: true, opacity: 0.85 })`
- Position: base of apartment building `(25, y, -330)`
- `PointLight(0x8060ff, 3, 10)` — purple glow visible from down the street
- `update(dt)`: spin Y + bob vertically
```ts
// FUTURE: detect proximity < 2 units → trigger collection
// FUTURE: play sound + show victory screen on pickup
```

### `src/player.ts` additions
- Building collision: reject candidate position if inside any `BuildingBox` (expanded by `COLLISION_RADIUS`)
- Pure helper: `export function isBlockedByBuilding(x, z, boxes, radius): boolean`

### Phase 4 Visual Checklist
- [ ] Road leads into city (no gap)
- [ ] No trees in city area
- [ ] Gas station and grocery store face each other across main street
- [ ] Empty parking lot in front of grocery store
- [ ] Apartment building is tallest structure
- [ ] All windows near-black — abandoned feel
- [ ] Stop signs at intersections
- [ ] Tumbleweed slowly spinning
- [ ] Dim streetlight glow at corners
- [ ] Player cannot walk through buildings
- [ ] Gem visible as purple glow from down the street
- [ ] Gem spins and bobs at apartment base
- [ ] Gem NOT visible from forest spawn

### Phase 4 Tests
```
src/__tests__/city.test.ts  — building collision boxes correct dimensions; AABB rejection
src/__tests__/player.test.ts — add building collision tests
```

### Phase 4 Commit
```
git add . && git commit -m "Phase 4: abandoned city, gem"
```

---

## Phase 5 — Birds

**Goal:** A handful of black crows rest on the ground throughout the forest. Walk within ~15 units of one and it startles — wings flap, it lifts off, and flies away. Adds life and atmosphere without requiring detailed art.

**New files:** `src/birds.ts`  
**Modified files:** `src/main.ts` (wire birds update)

### `src/birds.ts`

**Geometry (per bird — 5 mesh parts, grouped under a `THREE.Group`):**

| Part | Geometry | Material | Notes |
|---|---|---|---|
| Body | `SphereGeometry(0.25, 6, 4)` scaled `(1, 0.6, 1.5)` | black | elongated ellipsoid |
| Head | `SphereGeometry(0.12, 6, 4)` | black | positioned at front-top of body |
| Beak | `ConeGeometry(0.04, 0.12, 4)` | `0xf0c020` yellow | rotated to point forward from head |
| Wing L | `BoxGeometry(0.4, 0.04, 0.18)` | black | pivots at body left side |
| Wing R | `BoxGeometry(0.4, 0.04, 0.18)` | black | pivots at body right side |

Wings are child `Group` nodes so rotation around their root (attachment point) folds/flaps correctly.

**Placement:**
- 15 birds placed randomly in the forest zone (`[-200, 200]` XZ), same clearance rules as trees
- Exclude city zone `[-60, 60] × [-260, -380]`
- Each placed at `getHeightAt(x, z)` — sitting on terrain surface

**Per-bird state machine:**

```ts
type BirdState = 'resting' | 'startled' | 'flying';
```

| State | Trigger | Behavior |
|---|---|---|
| `resting` | — | wings folded (rotation ≈ 0); optional slow head-bob |
| `startled` | player within 15 units | rapid wing flap begins; bird lifts vertically ~3 units over 0.5 s |
| `flying` | after 0.5 s startled | moves in random horizontal direction at 10 units/s; climbs 5 units/s for 2 s then levels off; wing flap continues |

Birds do not return or land — once airborne they fly until ~150 units from spawn, then dispose themselves from the scene.

**Wing flap animation:**
- Resting: left wing `rotation.z = +0.15`, right `rotation.z = -0.15` (folded in)
- Flying: sine-wave flap at 4 Hz → `rotation.z = ±(0.6 * sin(time * 4 * 2π))`
- Startled: same as flying but 6 Hz for the first 0.5 s (panic flap)

**Exports:**

```ts
export interface Bird {
  group: THREE.Group;
  state: BirdState;
  flightDir: { x: number; z: number };  // normalized, set on startle
  flightTimer: number;
  distanceFromSpawn: number;
}

export function createBirds(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
): { update: (dt: number, playerX: number, playerZ: number) => void }
```

**Pure helper (testable):**

```ts
export function shouldStartle(
  birdX: number, birdZ: number,
  playerX: number, playerZ: number,
  radius: number,
): boolean
```

### Phase 5 Visual Checklist

- [ ] ~15 black birds visible resting on terrain throughout the forest
- [ ] Birds have visible yellow beak
- [ ] Wings visibly folded when resting
- [ ] Walking within ~15 units triggers flight
- [ ] Bird lifts off with rapid wing flap (panic flutter)
- [ ] Bird flies away in a consistent direction, gaining altitude then leveling
- [ ] Wing flap continues during flight (slower, rhythmic)
- [ ] Birds dispose cleanly — no ghost meshes after flying away
- [ ] No fps drop with 15 birds active (well under draw call budget)
- [ ] Birds do not spawn inside trees or city zone

### Phase 5 Tests (add after visual validation)

```
src/birds.test.ts — shouldStartle radius math; state transitions
```

### Phase 5 Commit

```
feat(birds): resting crows that startle and fly away on approach
```

---

## Phase 6 — Treasure Chests

**Goal:** Scatter a handful of battered pirate-style treasure chests throughout the forest and city. Walk close to one, press Space, and the lid swings open so the player can peer inside. Chests are currently empty — a hook for future loot.

**New files:** `src/chests.ts`  
**Modified files:** `src/main.ts` (wire chests update + pass player position), `src/input.ts` (add Space key to `initInput` listener, already stubbed as `// FUTURE: add 'Space' for interact`)

### `src/chests.ts`

**Geometry (per chest — assembled under a `THREE.Group`):**

| Part | Geometry | Material | Notes |
|---|---|---|---|
| Body | `BoxGeometry(0.8, 0.5, 0.5)` | dark wood `0x3d1f08` | main lower box |
| Lid | `BoxGeometry(0.8, 0.3, 0.5)` | dark wood `0x3d1f08` | pivots open from back edge |
| Interior floor | `BoxGeometry(0.72, 0.01, 0.44)` | dark velvet `0x1a0a0a` | visible when lid open |
| Metal bands (×2) | `BoxGeometry(0.82, 0.08, 0.08)` | aged iron `0x3a3a3a` | horizontal strips on body front and back |
| Lock hasp | `BoxGeometry(0.1, 0.12, 0.06)` | `0x5a5a5a` | centred on body front face |

Lid's pivot is at the **back top edge** of the body. Achieve this by placing the lid's local origin at its bottom-back edge: shift geometry by `(0, 0.15, 0.25)` so the back-bottom edge is at local `(0,0,0)`, then rotate on the parent `Group`.

**Placement:**
- 8 chests placed randomly in the world (use same seeded RNG approach as `trees.ts`, seed 77)
- Same clearance rules as trees: `SPAWN_CLEAR = 8` units from origin, exclude mountain zones
- Each placed at `getHeightAt(x, z)`, rotated randomly on Y so they face varied directions
- Exports `ChestPosition[]` for potential future collision or minimap use

**State machine (per chest):**

```ts
type ChestState = 'closed' | 'opening' | 'open';
```

| State | Trigger | Behavior |
|---|---|---|
| `closed` | — | lid rotation.x = 0 (flat) |
| `opening` | player ≤ 3 units + Space pressed | lid animates from 0 → −2.1 rad (~120°) over 0.6 s |
| `open` | animation complete | lid stays at −2.1 rad; can see inside |

Once open, a chest stays open (no close mechanic needed yet).

**Interaction:**
- Each frame in `update(dt, playerX, playerZ)`: for each `closed` chest, check `isNearChest` — if true, show a small text prompt (optional, skip if complex)
- On Space key down (`isKeyDown('Space')`): if player is within 3 units of any closed chest → transition to `opening`
- Only one chest can start opening per keypress (the nearest one)

**Opening animation:**
- Track `openTimer` per chest (0 → 0.6)
- `lidGroup.rotation.x = lerp(0, -2.1, openTimer / 0.6)` — ease-in-out naturally from linear lerp
- When `openTimer >= 0.6`, clamp to `−2.1` and set state to `open`

**Pure helper (testable):**

```ts
export function isNearChest(
  playerX: number, playerZ: number,
  chestX: number, chestZ: number,
  radius: number,
): boolean
```

**Exports:**

```ts
export interface ChestPosition { x: number; z: number }

export function createChests(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
  mountainObstacles?: CircleObstacle[],
): { update: (dt: number, playerX: number, playerZ: number) => void }
```

### Phase 6 Visual Checklist

- [ ] ~8 chests visible in the world, varied orientations
- [ ] Chests look distinctly pirate — dark wood, metal bands, visible lock hasp
- [ ] Lid is flat closed when resting
- [ ] Walking within 3 units + pressing Space swings the lid open
- [ ] Lid animates smoothly (~0.6 s) — not an instant snap
- [ ] Lid opens backward (away from player), revealing the interior
- [ ] Interior is visible at an angle through the open lid — dark and empty
- [ ] Chest stays open once triggered
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
