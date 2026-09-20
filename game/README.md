# The House Across the Street

A first-person stealth-horror vertical slice built with **Three.js**, **cannon-es**,
TypeScript and Vite. Fully original setting, character and story — not affiliated
with or copied from any existing "sneak into the neighbor's house" game.

## Story

You just moved into a quiet town. Across the street lives a man named **Elias
Voss** — nervous, meticulous, rarely seen outside after dark. Some nights his
windows glow in rooms that should be empty. One night you watch him drag a
heavy metal container down into his basement. The door locks behind him with
more than one lock.

You want to know what's down there.

## Running it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build to dist/
npm run preview   # serve the production build
```

No external art/audio assets are required — every sound is generated at
runtime with the Web Audio API, and every model is primitive geometry
(boxes, capsules, ramps) with simple materials, per the project's "gameplay
first" brief.

## Controls

| Action | Key |
| --- | --- |
| Move | `W A S D` |
| Sprint | `Shift` |
| Crouch | `Ctrl` / `C` |
| Jump | `Space` |
| Interact / pick up / open / hide | `E` |
| Drop carried item | `G` |
| Throw carried item | `Left Mouse Button` |
| Use active inventory item (e.g. flashlight) | `F` |
| Inventory slot select | `1` `2` `3` `4` / mouse wheel |
| Pause | `Esc` |

## Architecture

Each gameplay concern is its own module with a single responsibility —
nothing is a god-object:

```
src/
  core/            GameManager (orchestrator), InputManager, EventBus, GameEvents
  physics/         PhysicsWorld (cannon-es wrapper)
  player/          PlayerController (first-person movement/camera)
  systems/         InteractionSystem, InventorySystem, DoorSystem, LockSystem,
                    HidingSystem, NoiseSystem, ObjectiveSystem, CaptureSystem
  items/           ItemSystem (physical pickup/throw/carry), item definitions
  ai/              EnemyAI (state machine), VisionSystem, MemorySystem,
                    ScheduleSystem, NavGraph (waypoint pathfinding)
  puzzle/          PuzzleSystem (objective sequencing), PowerSystem (breaker/fuse)
  world/           Level (map assembly), StructureBuilder (walls/floors/ramps),
                    DayNightCycle, BreakableWindow
  save/            SaveSystem (localStorage persistence)
  audio/           AudioManager (procedural Web Audio)
  ui/              HUD, MainMenu
```

Every cross-system interaction (a noise happening, a door opening, the power
going out, the player getting spotted) flows through one typed `EventBus`,
so e.g. `EnemyAI` never needs a direct reference to `NoiseSystem` — it just
listens for `"noise"` events and decides for itself whether that was close
enough to hear.

### Elias Voss's AI

`EnemyAI` is a real state machine — `IDLE / PATROL / WORK / EAT / SLEEP /
INVESTIGATE / SEARCH / CHASE / CHECK_HIDING_PLACE / RETURN_TO_ROUTINE` — driven
by three independent senses:

- **Vision** (`VisionSystem`): a cone + raycast check. Range shrinks in the
  dark and while the player is crouched; a wall or closed door blocks it
  completely. It only ever asks "can I currently see the player", never
  reads the player's position directly.
- **Hearing**: subscribes to `NoiseSystem` events (crouch/walk/run/jump/door/
  throw/break-window all have different loudness radii) and decides
  probabilistically whether a given noise was in earshot, weighted by
  distance and whether Elias is asleep.
- **Memory** (`MemorySystem`): tracks only things Elias could plausibly have
  witnessed (used the window, cut the power, etc.) and lets his patrol
  occasionally lean toward watching that spot — never a live player-tracking
  cheat.

Movement between rooms uses a small hand-authored waypoint graph
(`NavGraph`, Dijkstra shortest path) rather than a full navmesh — enough for
one house, and it degrades safely: a target in a room with no modeled
doorway (the garage, entered only through its window) never causes Elias to
clip through a wall — he just walks to the nearest room he can actually
reach.

### The puzzle chain

Front door: permanently locked. The only ways in are the back door or
breaking the garage window (loud, and flags Elias's memory). From there:

```
garage window → fuse (garage floor) → breaker box → power on
  → workshop's electronic lock opens → workshop key
  → locked room's door opens → basement key + lore notes
  → basement's metal door opens → secret room → "get out" phase
```

`ObjectiveSystem` only ever shows the vague, current-phase objective
(`PuzzleSystem` decides the wording) — never a step-by-step walkthrough.

### Capture, not game over

Getting caught doesn't end the run: `CaptureSystem` freezes the player,
fades out, and drops them back in their own bed. Unlocked doors, found keys
and solved puzzles all persist — only position resets, matching the
"new attempt" loop from the design brief.

## What's in this vertical slice

Player house, street, and Elias's house (full ground floor, a partial
second floor — bedroom/landing/workshop/locked room — full basement plus
the secret room behind the metal door) with:

- First-person controller (walk/sprint/crouch/jump/head-bob, all with
  cannon-es physics)
- Universal `E`-prompt interaction system
- Physical pickup/drop/throw props (boxes, chairs, stones) separate from a
  4-slot key/tool inventory
- Doors with hinge-swing animation + kinematic colliders, keyed and
  power-dependent electronic locks
- A noise system with per-action loudness feeding directly into AI hearing
- The full Elias Voss AI state machine, schedule, vision, hearing, memory
- One hiding spot (bedroom closet) that can be "seen into" if Elias
  witnessed you duck in
- One secret room (a bookshelf panel in the locked room, off to a hidden
  nook)
- Day/night cycle tied to Elias's schedule and to vision range
- Save/continue (localStorage) covering doors, locks, inventory, memory,
  power state, puzzle phase and the day/night clock
- Procedural ambient/chase audio with no external sound assets

**Deliberately left as a next pass** (per the brief's "vertical slice first"
priority): the attic, library and balcony, a roof/vent entry path, and the
house "adapting" its defenses across multiple playthroughs beyond the light
memory-based patrol bias already in place.
