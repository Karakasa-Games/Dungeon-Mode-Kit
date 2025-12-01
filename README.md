# Dungeon Mode Kit

A modular web-based roguelike framework built on rot.js and pixi.js

### Core Architecture

#### DungeonEngine (Lines 10- ~306)

The main orchestrator that coordinates all subsystems:

- **Initialization**: Loads global assets (sprites, audio), sets up PIXI.js renderer with exact pixel dimensions for the current map
- **Prototype Loading**: Loads game configurations from `prototypes/{name}/`, checking for authored Tiled maps or falling back to procedural generation
- **State Management**: Maintains a `prototypeStack` for multi-level navigation (stairs), with save/restore capabilities for transitioning between levels

Methods:

- `initialize()` - One-time setup of assets and animation ticker
- `loadPrototype(name)` - Loads a complete game definition
- `transitionToPrototype()` / `returnToPreviousPrototype()` - Level transitions with state preservation

#### Entity System

A hierarchical, attribute-based system:

**Entity (Base)** - Any object with position, a sprite, and semantic attributes

- Attributes stored in a Map: `solid`, `pushable`, `flammable`, `breakable`, `visible`, etc.
- Methods: `setAttribute()`, `getAttribute()`, `hasAttribute()`

**Item (extends Entity)** - Single-tile pickupable objects (keys, potions, weapons)

- Height: 1 tile
- Default attribute: `pickupable: true`
- In the future items will have a data file similar to actor's personality files that will add effects and verbs

**Actor (extends Entity)** - Interactive 2-tile entities (player, monsters, doors)

- Height: 2 tiles (base sprite + top sprite)
- Has `stats`, `inventory`, and `personality`
   stats are totally data driven and can be different for each prototype, could be anything.
- Methods: `modify()`, `die()`, `pickUpItem()`, `act()`

#### Personality System

Data-driven AI behaviors loaded from JSON:

```
Personality → behaviors[] → BehaviorLibrary
```

- Personalities define: `controlled`, `hostile`, `behaviors`, `vision_range`
- BehaviorLibrary contains pluggable routines: `patrol`, `pursue_target`, `random_walk`, `attack_adjacent`
- `execute(actor)` runs behaviors in order until one succeeds

#### MapManager

Handles map loading and procedural generation:

- **Tiled Integration**: Loads `.tmj` files with floor, background, and object layers for actors and items.
- **Wildcard System**: Special tiles trigger procedural content
  - `maze` - Generates ROT.js maze at location
  - `room` - Creates rectangular room
  - `item_spawn` / `actor_spawn` - Placeholder for random placement
- **Procedural Fallback**: Uses ROT.js Uniform algorithm if no `map.tmj` exists

#### RenderSystem

PIXI.js rendering with layered containers:

1. `backgroundContainer` - Auto-generated shadows
2. `floorContainer` - Floor tiles
3. `entityContainer` - Actors (2-tile) and items
4. `uiContainer` - UI elements

Actors render as two sprites stacked vertically (base at position, top one tile above).

#### EntityManager

Tracks and queries all game entities:

- Spawns entities from Tiled object layers
- Provides lookup methods: `getEntityAt()`, `getActorAt()`, `findNearestPlayer()`
- Handles serialization for state saves

#### AudioManager

Howler.js wrapper for audio sprite playback with multi-format support.

### Data Flow

```
1. initializeGame()
   └─> engine.initialize()
       ├─> loadGlobalAssets() [sprites, audio]
       └─> loadPrototype('default')
           ├─> loadPrototypeConfig()
           ├─> checkForAuthoredMap()
           ├─> MapManager.loadTiledMap() or generateProceduralMap()
           ├─> initializeRenderer()
           ├─> EntityManager.spawnEntities()
           ├─> MapManager.processWildcards()
           └─> RenderSystem.renderTestPattern() + renderActors()
```

### File Structure

```
engine.js          # Core engine (this file)
globals.js         # Global variables
data/              # Global entity definitions
  actors.json      # Actor templates (player, skeleton, wall, fire, etc.)
  items.json       # Item templates (key, bow, potions, etc.)
  personalities.json # AI behavior definitions
  effects.json     # Audio sprite configuration
prototypes/        # Game definitions
  default/
    prototype.json # Game rules (mechanics, stats, win conditions)
    actors.json    # Prototype-specific overrides
    map.tmj        # Tiled map (optional)
```

---

## Current Implementation Status (after these I'll 1.0 it and switch to a changelog)

**Completed:**

- Core engine architecture with major classes
- Entity system with attributes
- PIXI.js rendering pipeline
- Tiled map loading
- Audio sprite support
- Prototype loading system

**In Progress:**

- ROT.js maze generation
- Multi-level state stack
- Turn engine (framework exists, not fully wired)
- AI behaviors (structure exists, behaviors are stubs)
- Wildcard processing (detection works, spawn stubs empty)

**Not Yet Implemented:**

- Input handling (keyboard/mouse/touch) - our game loop doesn't require an active player and becomes an animation of actor behaviors without one
- Pathfinding (A*)
- Field of view
- Combat
- Item interactions
- Fog of war / darkness
- UI (inventory, stats, messages)

**Pie in the Sky**

- Dreaming of: once a minimal rogulike is achieved, adding optional panes for a pseudo3d first person view based on a playable actor position on the map and a verbose text description of turns, letting us experiment with different genre features

#### Tree

```
.
├── assets
│   ├── audio
│   │   ├── effects.ac3
│   │   ├── effects.m4a
│   │   ├── effects.mp3
│   │   └── effects.ogg
│   ├── favicon.ico
│   ├── fonts
│   │   ├── cmunrm-webfont.woff
│   │   ├── cmunrm-webfont.woff2
│   │   ├── courier_prime_code-webfont.woff
│   │   └── courier_prime_code-webfont.woff2
│   ├── main.css
│   ├── main.css.map
│   ├── scss
│   │   ├── _base.scss
│   │   ├──_game.scss
│   │   ├── _typography.scss
│   │   ├── main.css
│   │   ├── main.css.map
│   │   └── main.scss
│   └── sprites
│       ├── fire-animation.png
│       ├── smoke-animation.png
│       └── static-tiles.png
├── data
│   ├── actors.json
│   ├── effects.json
│   ├── items.json
│   ├── personalities.json
│   └── static-tiles.json
├── DUNGEON_MODE_KIT_DESIGN.md
├── engine.js
├── globals.js
├── index.html
├── lib
│   ├── howler.js
│   ├── pixi.min.js
│   ├── pixi.min.js.map
│   ├── rot.js
│   ├── rot.min.js
│   ├── tweenjs.js
│   └── tweenjs.min.js
├── LICENSE.txt
├── prototypes
│   └── default
│       ├── actors.json
│       ├── map.tmj
│       └── prototype.json
├── README.md
├── tiled
│   ├── dungeonkit.tiled-project
│   ├── dungeonkit.tiled-session
│   └── static-tiles.tsj
└── tree.txt
```

## License

Anti-Capitalist Software License (v1.4) - Free for individuals, non-profits, educational institutions, and co-ops.
