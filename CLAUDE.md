# Gemble

A browser-based 3D game built with Three.js, TypeScript, and Vite.

## Project status

This project is in active development. Check `.claude/plans/` for design documents and feature plans before starting new work — plans there describe intended architecture and scope. If no plan exists for a feature, write one in `.claude/plans/` before implementing.

## Tech stack

- **Runtime**: Browser (no Node.js server)
- **3D engine**: Three.js
- **Language**: TypeScript (strict mode)
- **Bundler**: Vite
- **Package manager**: Yarn Berry (v4, `nodeLinker: node-modules`)
- **Testing**: Vitest (unit tests; colocate test files as `*.test.ts` next to source)
- **Linting**: ESLint with TypeScript rules
- **Formatting**: Prettier (enforced via ESLint plugin)

## Temporary files

**Always** write temporary files to `src/temp/`. This is a hard rule — never write scratch output to the project root, `src/`, or anywhere else.

`src/temp/` is gitignored (the folder is committed via `.gitkeep`; its contents are not).

This includes, without exception:
- **Playwright screenshots** — when using `browser_take_screenshot`, always save to `src/temp/<name>.png`
- **Temporary scripts** — one-off debug or test scripts go in `src/temp/<name>.ts` and are deleted when done
- **Any other scratch output** — logs, JSON dumps, generated test fixtures that are not meant to be committed

After using a temporary file, delete it with `rm src/temp/<filename>` unless the user asks to keep it.

## Image tooling

`magick` (ImageMagick 7) is available in the terminal for image manipulation. Use it to convert, resize, or process assets in `docs/` and `public/assets/`.

```bash
# Convert HEIC to PNG (lossless — preferred for pencil drawing references)
magick input.HEIC output.png

# Resize while keeping aspect ratio
magick input.png -resize 1024x1024\> output.png

# Batch convert all HEIC in a folder
for f in docs/*.HEIC; do magick "$f" "${f%.HEIC}.png"; done
```

Use PNG for pencil drawings and line art (lossless, no artifacts). Use WebP for photos and large textures where file size matters.

## Development commands

```bash
yarn install         # install dependencies
yarn dev             # start Vite dev server (hot reload)
yarn build           # production build to dist/
yarn preview         # preview production build locally
yarn typecheck       # tsc --noEmit
yarn lint            # eslint src/
yarn format          # prettier --write src/
yarn test            # vitest (watch mode)
yarn test:run        # vitest run (single pass, used in CI)
```

Run `yarn typecheck && yarn lint && yarn test:run` before committing.

## Project structure (target)

```
src/
  main.ts           # entry point — creates renderer, scene, game loop
  scene.ts          # renderer, camera, lights, fog, clouds
  terrain.ts        # mesh + getHeightAt() + mountain obstacles
  terrain.test.ts   # unit tests for pure terrain helpers
  trees.ts          # instanced pines + deciduous trees
  props.ts          # rocks, boulders, bushes, ground cover
  player.ts         # camera movement + collision
  player.test.ts    # unit tests for pure player helpers
  input.ts          # keyboard state
  temp/             # gitignored scratch output (screenshots, debug scripts)
public/
  assets/           # static assets (textures, models, audio files)
.claude/
  plans/            # feature design docs — read before implementing
```

## Coding conventions

- No `any` — use proper types or generics.
- Prefer composition over inheritance for game entities.
- Keep Three.js objects inside `scene/` and `entities/` — game logic in `game/` must not import Three.js directly.
- One class or logical group per file; file names match the exported name in kebab-case.
- Clean up Three.js resources explicitly (`geometry.dispose()`, `material.dispose()`, `texture.dispose()`) when removing objects from the scene.

## Game loop pattern

Use a single `requestAnimationFrame` loop owned by `main.ts`. Pass a `delta` (seconds) to every system's `update(delta)` method. Do not use `setInterval` for game logic.

## Plans workflow

`game-overview.md` is a **living document** — it must always reflect the current state of the game. Read it before starting any work, and update it after any significant change.

Before implementing any non-trivial feature:
1. Read `game-overview.md` in full to understand current state, prior decisions, and what's next.
2. Implement the feature.
3. **Update `game-overview.md` immediately after** — before committing. This includes:
   - Marking a phase or sub-item ✅ COMPLETE with a commit hash
   - Correcting any implementation notes that diverged from the plan (geometry, colors, collision, file structure)
   - Removing or striking through anything that's no longer accurate
   - Adding a brief note explaining *why* something changed if it wasn't obvious from the plan

The plan is the source of truth for what's in the game. A stale plan is worse than no plan — if the plan says "sky is blue" but the sky is now navy, fix the plan.

For one-off feature plan files (not `game-overview.md`), mark them complete with `## Status: complete` at the top and keep them for reference.

## What to build next

If no explicit task is given, check `.claude/plans/` for the highest-priority incomplete plan and continue from there. If plans are empty, start by scaffolding the Vite + TypeScript + Three.js project:

1. Run `yarn set version stable` then `yarn install` to bootstrap Yarn Berry and install dependencies.
2. Create `src/main.ts` with a minimal Three.js scene (renderer, camera, a rotating cube) to prove the stack works.
3. Add an `eslint.config.js`, `prettier.config.js`, and `vitest.config.ts` matching the project conventions.
4. Commit with message `chore: scaffold Vite + Three.js + TypeScript`.
