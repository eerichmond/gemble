# Gemble

A first-person mystery built entirely in the browser. Explore a fog-lit pine forest and an abandoned city — somewhere in it is a hidden gem.

![The hidden gem glowing in the forest, surrounded by purple crystal pillars](docs/gemble-screenshot-purple-diamond.webp)

---

## About

Gemble is a personal project to push the limits of what's possible in a browser with no game engine. Every piece of geometry — the trees, the buildings, the capybaras, the crystal-crowned troll — is hand-built using [Three.js](https://threejs.org) primitives. No Unity. No Godot. Just WebGL, TypeScript, and math.

The world is small but dense: a rolling dusk forest gives way to a gravel road that eventually opens into a flat, eerie city. The atmosphere is the point — heavy fog, moonlight through the pines, the distant glow of a creature's eye.

**Status:** Active development. The gem is in the world; a win condition isn't implemented yet.

---

## World

```
         N
    ┌─────────────────────────────┐
    │  Dense pine forest          │  ← fog, rolling hills, crystals
    │  Gravel road winds south    │
    │  Asphalt begins             │  ← city entrance
    │  Abandoned city             │  ← buildings, flying eye, the gem
    └─────────────────────────────┘
         S
```

The terrain is a single 500×700 unit mesh. Hills flatten gradually as you head south into the city. Fog thickens in the valleys.

---

## Creatures & Things

| Entity | Description |
|---|---|
| **Flying Eye** | Hovers in the city, slowly turns to watch you |
| **Crystal Troll** | Stocky dark-blue figure with crystal spikes, sways in the forest |
| **Winged Monster** | Bat-winged silhouette, wings slowly beating |
| **Capybaras** | Wander in small groups, oval-bodied and unhurried |
| **Crows** | Startle and scatter when you walk too close |

---

## Systems

- **Compass** — HUD compass locked to camera heading
- **Minimap** — Small canvas overlay (bottom-left) with a directional arrow for the player and colored dots for every entity
- **Treasure chests** — 4 unique loot items; open with Space, pick up loot, close again
- **Inventory** — Picked-up item follows the camera; press Shift+Space to hold it up in first-person view

---

## Tech Stack

| | |
|---|---|
| **Renderer** | [Three.js](https://threejs.org) r176 |
| **Language** | TypeScript (strict) |
| **Bundler** | Vite 6 |
| **Package manager** | Yarn Berry v4 |
| **Testing** | Vitest |

---

## Running Locally

```bash
yarn install
yarn dev      # → http://localhost:5173
```

**Controls**

| Key | Action |
|---|---|
| `↑ / ↓` | Move forward / back |
| `← / →` | Turn left / right |
| `Shift` + `↑` | Sprint |
| `Space` | Interact with chests |
| `Shift` + `Space` | Show held item |
