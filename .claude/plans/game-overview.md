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
| **stats.js** | already installed; setup in `scene.ts` | Live FPS / ms-per-frame counter — instantly shows performance regressions |
| **Three.js DevTools** | Chrome extension | Inspect scene graph, toggle mesh visibility, check camera position |
| **Vite HMR** | Edit a file → browser auto-reloads | Tight feedback loop — no manual refresh needed |

Add `stats.js` in Phase 0 and leave it in permanently during development.

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

Main terrain: 500×700 unit mesh shifted south so Z spans [-450, +250]. Terrain amplitude flattens gradually south of z=-180 — full hills at z=-180, ~8% amplitude at z=-260 and beyond. No separate city ground plane; buildings use `getHeightAt`. Road: gravel from north to z=-248, then wider black asphalt through city to z=-440. Gem in the forest at (-52, y, 108), surrounded by 4 large purple pyramid crystals 12 units out in each cardinal direction. Player spawns at (-52, y, 130) facing south into the crystal formation.

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
- Project was already scaffolded with Yarn 4 — all commands use `yarn` not `npm`
- Mountains: groups of 2–3 overlapping cones per position in `terrain.ts`; bases buried 35% underground so peaks emerge naturally from terrain
- Arrow keys preventDefault'd in `input.ts` to stop page scrolling
- Mountains moved inside terrain boundary (radius 160–220) after initial placement outside it (380–440) made them invisible

✅ Visually validated — 120fps, dramatic rolling hills, mountains grounded in terrain, horizon haze, no WebGL errors.

---

## Phase 1 — Trees + Forward Movement ✅ COMPLETE (commits 915d2a5, 6511d99)

**Goal:** Walk through a forest. Arrow Up/Down moves forward/back. Trees fill the world. Player can't walk through trees.

**New files:** `src/trees.ts`  
**Modified files:** `src/player.ts` (add movement + tree collision), `src/main.ts` (wire trees)

**Implementation notes:**
- Seeded LCG RNG in `trees.ts` — deterministic tree placement survives hot-reloads
- Tree scale 2.0–3.5x — gives ~30–50 ft pines that dwarf the player (1.7 unit eye height ≈ 5.5 ft)
- **Collision is trunk-only** — player can walk underneath canopy freely. Pine trunk radius = `0.25 * scale`; deciduous = `0.28 * scale`. Earlier values of 2.5× / 2.2× were canopy-edge sized and blocked the player incorrectly.
- **480 pines**: trunk + 3 stacked ConeGeometry tiers. **120 deciduous**: IcosahedronGeometry canopy wider than tall — reads as broadleaf crown, clearly distinct from pines. An earlier ConeGeometry canopy was too similar to pines and was replaced.
- Night sky and moonlight applied directly in `scene.ts` (not a separate atmosphere module). Dusk blue sky — lightened from original deep navy per user feedback (too dark).
- **Mountain collision**: 24 per-peak `CircleObstacle`s (`PEAK_RADIUS = 37`). Tuning history: 80 (per-group, too wide) → 56 (per-peak, still wide) → 37 (stops player at the cone surface). Passed to player, trees, and props to exclude all three from mountain bases.
- `computeMovementDelta` uses `-sin/-cos` — camera looks down -Z, so `+sin/+cos` was backwards.

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
- **200 small/medium rocks + 45 large boulders**: dome-based — center below groundY so only the upper dome is visible
- **250 main bushes + 400 small ground-cover shrubs**: dome-based with varied XZ/Y ratios per instance for natural irregular shape. Replaced earlier crossed-plane grass tufts.

### `src/scene.ts` — Nighttime lighting ✅ DONE
Night sky and moonlight applied directly in `scene.ts` rather than a separate `atmosphere.ts` — simpler, no reason to separate it. Dusk blue sky, lightened from original deep navy per user feedback (was too dark).

**Still pending for full atmosphere:**
- Increase fog density so trees fade to silhouettes at ~80 units
- Swap sky + fog to deep purple-black for mystery/dusk feel
- Add low warm-orange light from west for ambient glow (replaces moon)
- Darken terrain color to near-black forest floor

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
- Road runs full map length: north end at `[20, 238]` (crystal formation), south end at `[4, -248]` (city entrance)
- 14 waypoints, gentle S-curve through the forest passing ~18 units east of spawn. Final 2 points `[4,-216]→[4,-248]` approach the city straight south — no sharp dog-leg.
- Road width: 12 units. Gravel surface (not asphalt). No yellow centerline.
- **Terrain conformance**: `buildRibbon()` uses 7 columns across the road width — each vertex independently samples `getHeightAt`. Prevents both grass poking through and road floating; road banks naturally with terrain cross-slope. Spine sampled every 1 unit for dense longitudinal conformance.
- `getRoadObstacles()` exports spine-sampled `CircleObstacle[]` (radius 10) — called before trees/props in `main.ts` to keep vegetation clear of the road corridor.
- **Crystal formation** at north end: 11 light white-pink square-pyramid spikes (`ConeGeometry` 4-sided with `rotateY(PI/4)` for flat faces, not diamond-edged). Heights 14–24 units, buried 20% underground, varied tilts. Block the road end; each crystal returns a `CircleObstacle` wired into player collision.
- City asphalt road (width 18, 1.5×) starts at `[4, -248]` where gravel ends — straight junction. Asphalt sits 0.03 units above gravel to prevent z-fighting. Yellow dashed center line + white shoulder lines on asphalt.

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

### Terrain extension
Terrain mesh extended from 500×500 to 500×700 via `geometry.translate(0, 100, 0)` before `rotateX(-Math.PI/2)`, shifting the mesh south so Z spans [-450, +250]. Amplitude flattens using `flattenT = min(1, (-z-180)/80)` south of z=-180. `getHeightAt` uses a single Raycaster against the one mesh — no changes needed there.

### `src/city.ts`
City center around `(4, terrain, -330)`. Road center x=4, spans x:[-5, 13]. All buildings set back from road with clearance.

**Buildings (all have windows + doors on all 4 faces):**

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
- Parking lot in front of grocery; stop signs at city entrance; tumbleweed slowly spinning at `(8, y, -300)`
- Streetlights: 8 poles at x=±11/−8, z=−282/−310/−380/−420; warm yellow PointLight
- Door color `0x7a6655` (warm gray-brown) — distinct from near-black windows and building walls, reads as a closed door

### `src/gem.ts`
- Spinning, bobbing purple diamond gem at `(-52, y, 108)` — hidden in the forest west of the road
- Two PointLights: area glow + low ground pool for purple atmosphere on nearby trees and terrain
- 4 surrounding pyramid crystals (height ~12, same purple material), placed 12 units N/S/E/W. Player can walk between them but not through them.
- Returns 5 `CircleObstacle`s (gem + 4 crystals) to wire into player collision

### `src/audio.ts`
Forest ambient CC0 sound (`/assets/forest-ambient.mp3`). Autoplay on first keydown/click.

### `src/player.ts` additions
- Building collision: AABB check via `isBlockedByBuilding`
- Sprint: hold Shift + arrow keys for 3× speed
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

---

## Phase 5 — Birds ✅ COMPLETE

**Goal:** Crows rest in groups of 3–4 throughout the forest. Walk within 5 units of any bird and the whole group startles — caw sound plays, all birds panic-flap, lift off, and scatter. Adds life and atmosphere without detailed art.

**New files:** `src/birds.ts`  
**Modified files:** `src/main.ts` (wire birds update)

**Placement:** 4 groups (sizes 4, 4, 3, 4 = 15 birds), seeded RNG (seed 55). Each group has a random center in [-170, 170] XZ; birds scattered within 5 units of center. 25-unit clearance around player spawn.

**State machine:**

| State | Trigger | Behavior |
|---|---|---|
| `resting` | — | wings folded; checks proximity each frame |
| `startled` | player within **5 units** of any bird in group | entire group fires at once; plays `crow-caw.wav` 3× sequential; 6 Hz panic flap; lifts 3 units over 0.5 s |
| `flying` | after 0.5 s | 4 Hz rhythmic flap; 10 u/s horizontal; climbs 5 u/s for 2 s; disposed when 150 units from spawn |

**Group scatter:** Birds get evenly-spread flight angles so they radiate outward, not clump together.

**Audio:** `public/assets/crow-caw.wav` (CC0, OpenGameArt). Three caws play sequentially via the `ended` event.

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

---

## Phase 6 — Treasure Chests ✅ DONE

**Goal:** Scatter 8 battered pirate-style treasure chests throughout the forest. Walk close, press Space, and the lid swings open.

**New files:** `src/chests.ts`  
**Modified files:** `src/main.ts` (must wire before `createPlayer` so chest obstacles are available for collision)

**Design notes:**
- Chest top (H=1.60) sits just below player eye level (1.70) — player looks slightly down into an open chest
- Body uses a transparent +Y face so the interior is visible from above without clipping (Three.js multi-material per face on a single BoxGeometry)
- Lid pivots from the back-top hinge — swings UP and backward away from the player
- Gold armor plate hovers and spins above the chest when open; permanently disappears on second Space press (one-time loot — chest remains openable but shows empty interior)
- Hitbox: `CircleObstacle` radius 0.95 per chest; player stops at chest surface, still within 3-unit interaction range

**State machine:** `closed → opening → open → looted → closing → closed`. Space bar edge-triggered. Nearest chest within 3 units is targeted.

**Placement (seeded LCG seed 77, 8 chests):** Forest only — excludes spawn area, city zone, road corridor, mountain bases.

### Phase 6 Visual Checklist

- [ ] ~8 chests visible in the world, varied orientations
- [ ] Chests look distinctly pirate — dark wood, metal bands, visible lock hasp
- [ ] Lid is flat closed when resting
- [ ] Walking within 3 units + pressing Space swings the lid open
- [ ] Lid animates smoothly (~0.6 s) — not an instant snap
- [ ] Lid swings UP and backward (away from player)
- [ ] Gold chest plate appears floating/spinning above the open chest
- [ ] Second Space press picks up the armor (plate disappears, light dims)
- [ ] Third Space press closes the chest (lid swings back, light fades)
- [ ] No fps drop with 8 chests in the scene
- [ ] Chests do not spawn inside trees or mountain bases

### Phase 6 Tests (add after visual validation)

```
src/chests.test.ts — isNearChest radius math; opening animation clamp
```

---

## Phase 7 — Monsters

**Goal:** Populate the forest and city with three distinct enemy creatures. Visual-only for now (no AI or combat) — define their look so we can iterate before committing to implementation.

**New files:** `src/monsters.ts`  
**Modified files:** `src/main.ts` (wire monster update)

### Design (from pencil sketches in `docs/`)

All three monsters share a **medium blue indigo palette** — `iBody=0x2050a0`, `iMid=0x2e68cc`, `iDark=0x0c1e44`, `iCloth=0x183870`.

All limbs use `CapsuleGeometry` + `SphereGeometry` for joints — avoids the blocky Minecraft look of `BoxGeometry`. **CapsuleGeometry API note:** `CapsuleGeometry(radius, length, capSubdivisions, radialSegments)` — `length` is the *cylinder section only*, not total height. Total height = `length + 2 * radius`.

**Reference implementation:** `src/temp/monster-preview.html` — standalone HTML showing all three monsters with all y-coordinates, x-offsets, and arm angles visually validated. Read this before writing troll/winged geometry in `src/monsters.ts`.

---

### Crystal Troll (`docs/crystal-troll.png`)

Stocky humanoid, ~2.2 units tall. Arms raised with clawed hands.

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
| Eyes | `ShapeGeometry` pointed-oval | inner corner DOWN, outer corner UP = angry scowl; left `tiltZ=-0.32`, right `+0.32` |
| Brow ridge | `BoxGeometry(0.36, 0.07, 0.09)` | `iDark` |
| Nose | `ConeGeometry(0.065, 0.16, 4)`, `rotation.x = -π/2` | pointy, forward |
| Ears | `ConeGeometry(0.055, 0.19, 4)`, `rotation.z = ±π/2` | |
| Crystal spikes ×3 | `ConeGeometry(0.07, 0.37, 5)` steel-blue `iCrystal=0x4a85b5`, emissive `0x1e4d88` | 4-sided pyramid `rotation.y=π/4`; crown of head, varied tilt |
| Upper arms | `CapsuleGeometry(0.09, 0.26)` total h=0.44 | `rz = atan2(-dx, dy)` from direction vector |
| Elbow joints | `SphereGeometry(0.095)` | |
| Forearms | `CapsuleGeometry(0.085, 0.23)` total h=0.40 | |
| Fists | `SphereGeometry(0.095)` | |
| Claws ×3/hand | `ConeGeometry(0.06, 0.26, 4)` `iDark` | splayed ±0.24 rad in forearm direction |

**Arm computation:** Arms go OUTWARD from shoulders. Upper arm direction `(side*0.94, 0.34)`; forearm bends up `(side*0.50, 0.87)`. `rz = atan2(-dx, dy)` for capsule rotation from a direction vector. Joint world positions computed analytically from θ and capsule length.

---

### Flying Eye (`docs/flying-eye-monster.png`) ✅ DONE (in city)

Abstract floating creature at `(0, groundY + 5.0, -310)` — city main intersection, above player eye height.

- Bobs vertically and drifts side-to-side with doubled amplitude
- Tracks player: iris smoothly slerps toward player via quaternion. The eye's local +Z faces the player — iris always looks at them.
- Purple PointLight glow

Side cones orient outward via quaternion (hardcoded `rotation.z = ±π/2` produced pointing-up/down artifacts).

---

### Winged Monster (`docs/winged-monster.png`)

Narrow humanoid, similar height to Crystal Troll but more elegant. Bat wings from upper back. T-pose arms. Spiky hair, no mouth. Narrower proportions throughout (chest `CapsuleGeometry(0.17, …)` vs troll's `0.24`).

**Wings** (per side):
- Arm spar goes outward to wrist; then 3 finger spars SYMMETRICALLY: F1 (up, +spread), F2 (horizontal, furthest out), F3 (down, −spread) — F1/F3 exact mirrors around wrist height
- Membrane: `PlaneGeometry`, `DoubleSide`, dark indigo; scallop control points pulled inward for concave bat-wing edge
- `sparBone(x1,y1, x2,y2)` helper computes capsule midpoint + `rz = atan2(-dx/len, dy/len)`

**Arms:** horizontal T-pose via `CapsuleGeometry` with `rotation.z = ±π/2`.

---

### `src/monsters.ts` — Flying Eye ✅ DONE

**Remaining for full Phase 7:**
- Add Crystal Troll at `(35, terrain, 55)` — copy geometry from preview
- Add Winged Monster at `(−50, terrain, 80)` — copy geometry from preview
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

## Phase 8 — Capybaras ✅ DONE

**Goal:** Add ~10 capybaras grazing in the forest, grouped in clusters of 3–4. Visual-only. Each slowly bobs its head as if eating from the ground.

**New files:** `src/capybaras.ts`  
**Modified files:** `src/main.ts` (import + wire `updateCapybaras`)

**Design:** Boxy rectangular body + black stick legs with an oval ellipsoid head that bobs down toward the ground. Large and small sizes. 3 groups (sizes 3, 3, 4 = 10 total), seeded LCG seed 88.

**Head animation:** `headGroup.rotation.x` oscillates 0 ↔ 0.35 rad at 0.8–1.4 rad/s with randomized phase — animals in the same group don't nod in sync.

**Placement:** group centers in x:[-150,150], z:[-130,130]; 30 u clearance from player spawn; avoids road corridor, city zone, mountain bases.

**Phase 6 armor one-time-loot fix (also in this commit):** `armorLooted: boolean` flag added. Once armor is picked up it stays gone permanently — chest remains openable but shows empty interior.

### Phase 8 Visual Checklist

- [ ] ~10 capybaras visible in the forest in clusters of 3–4
- [ ] Large and small sizes clearly distinct
- [ ] Black stick legs, brown rectangular body, oval brown head
- [ ] Head bobs smoothly (grazing motion) — not snappy, staggered between animals
- [ ] Small square ears on top-back of oval head
- [ ] Black square eyes on TOP of head, set back from snout
- [ ] Black square nose at snout tip
- [ ] No fps drop with 10 capybaras active

---

## Phase 9 — City Ghosts

**Goal:** 3 white translucent ghosts slowly float between buildings in the city. Each waits inside a building, then drifts to another. Adds life to the empty city streets.

**New files:** `src/ghosts.ts`  
**Modified files:** `src/city.ts` (door colors), `src/main.ts` (wire `updateGhosts`)

**Design:** Classic ghost silhouette — rounded head, slightly wider-based tapered body, two dark eyes. Total ~6.3 units tall (slightly less than a large deciduous tree), floating 1 unit above terrain. Dark oval shadow on ground below; opacity fades with height.

**Building waypoints:** All 11 city building centers hardcoded in `ghosts.ts` as `[x, z]` pairs.

**State machine:**

| State | Trigger | Behavior |
|---|---|---|
| `'dormant'` | — | hidden; countdown timer 12–28 s (staggered +9 s per ghost at startup) |
| `'floating'` | countdown hits 0 | visible; moves toward dst at 3.5 u/s; vertical bob ±0.3 u at 1.8 Hz; shadow tracks below |
| → arrival | remaining dist ≤ move step | hides; picks new random dst ≠ src; returns to `'dormant'` |

**Door colors:** Changed from near-black to warm gray-brown `0x7a6655` — reads as a closed door panel, distinct from window darkness and building walls.

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

---

## Key Architecture Decisions

| Decision | Reason |
|---|---|
| Phased delivery | See something working at each step; validate visually before adding complexity |
| `stats.js` from Phase 0 | Permanent dev tool — catches performance regressions as features are added |
| `FogExp2` not `Fog` | Exponential fog feels physically natural; linear fog has a hard cutoff that looks artificial |
| `MeshLambertMaterial` not `MeshStandardMaterial` | Lambert's flat shading complements stylized geometry; PBR looks "real" in a way that clashes with procedural shapes |
| InstancedMesh for trees | Without it: ~1600+ draw calls. With it: ~10. Pattern established now scales if tree count grows. |
| `camera.rotation.order = 'YXZ'` | FPS cameras need yaw-first. Default `'XYZ'` causes roll when looking up/down. Set correctly in Phase 0 so adding pitch later works without breaking anything. |
| Pure math functions exported | Lets Vitest test movement/collision logic in Node without a WebGL context |
| Tests added after visual validation | A phase that looks wrong visually tells you more than a failing unit test at this stage of development |
