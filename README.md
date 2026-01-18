# Dungeon Mode Kit

A modular web-based roguelike framework built on rot.js and pixi.js

**[Original Design Notes](/DUNGEON_MODE_KIT_DESIGN.md)**

### Core Architecture

#### DungeonEngine

The main orchestrator that coordinates all subsystems:

- **Initialization**: Loads global assets (sprites, audio), sets up PIXI.js renderer with exact pixel dimensions for the current map
- **Prototype Loading**: Loads game configurations from `prototypes/{name}/`, checking for authored Tiled maps or falling back to procedural generation
- **State Management**: Maintains a `prototypeStack` for multi-level navigation (stairs), with save/restore capabilities for transitioning between levels. This is a stub that might not get used, since it's not actually important to me yet to have persistence between levels, rather they just load like totally new games.

Methods:

- `initialize()` - One-time setup of assets and animation ticker
- `loadPrototype(name)` - Loads a complete game definition
- `transitionToPrototype()` / `returnToPreviousPrototype()` - Level transitions

#### Entity System

A hierarchical, attribute-based system:

**Entity (Base)** - Any object with position, optional sprite, and semantic attributes

- Attributes stored in a Map: `solid`, `pushable`, `flammable`, `breakable`, `visible`, etc.
- Methods: `setAttribute()`, `getAttribute()`, `hasAttribute()`
- Sprites are optional (`this.sprite = null` by default) - useful for invisible triggers, shadows, etc.
- Floors are **not** entities - they're tile data in `MapManager.floorMap`

**Item (extends Entity)** - Single-tile pickupable objects (keys, potions, weapons)

- Height: 1 tile
- Default attribute: `pickupable: true`

Item JSON schema:

```json
{
  "item_id": {
    "name": "Display Name",
    "tileIndex": "TILE_NAME",       // or {x, y} coordinates
    "tint": "#RRGGBB",              // optional color tint
    "flipH": false,                 // optional horizontal flip
    "flipV": false,                 // optional vertical flip
    "attributes": {
      "pickupable": true,
      "visible": true,
      "stackable": false,
      "flammable": false,
      "consumable": false,
      "collision_effect": { "stat": value },  // applied when holder collides (supports "-{attr}" refs)
      "collision_sound": "sound_name",
      "use_verb": "Drink",                    // action menu label
      "use_effect": { "health": 20 },         // stat modification on use
      "use_sound": "sound_name",
      "wearable": "top|middle|lower",         // equipment slot
      "wear_effect": { "strength": 2 }        // stat bonus when worn
    }
  }
}
```

**[Items](/ITEMS.md)**

**Actor (extends Entity)** - Interactive 2-tile entities (player, monsters, doors, walls)

- Height: 2 tiles (base sprite + top sprite)
- Has `stats`, `inventory`, and `personality`
- **Attributes**: Boolean flags and configuration values (e.g., `solid`, `visible`, `hostile`, `open`, `locked`)
- **Stats**: Numeric values with `{ max, current }` structure that change during gameplay (e.g., `health`, `strength`)
- Methods: `die()`, `pickUpItem()`, `flash()`, `applyCollisionEffects()`

Actor JSON schema (organized by property type):

```json
{
  "actor_id": {
    // IDENTITY - display/rendering properties
    "name": "Display Name",
    "tileIndexBase": "TILE_NAME",    // or {x, y} coordinates
    "tileIndexTop": "TILE_NAME",
    "tint": "#RRGGBB",
    "animated": true,
    "animation_frames": "fire",
    "flipBaseH": false,
    "flipTopV": false,

    // BEHAVIOR - AI and interaction config
    "personality": "personality_name",
    "vision_range": 8,
    // Collision effects can use attribute references: "{attr}", "-{attr}", "+{attr}"
    // Example: "collision_effect": { "health": "-{strength}" } uses actor's strength as damage
    "collision_effect": { "health": -5 },
    "collision_sound": "hit",
    "death_sound": "ouch",
    "damage_per_turn": 10,                 // for hazards like fire
    "spread_chance": 0.3,
    "lifetime": 5,
    "default_items": ["item_id"],          // items actor spawns with

    // STATS - numeric values with max/current that change during gameplay
    "stats": {
      "health": 30,      // becomes { max: 30, current: 30 }
      "strength": 5
    },

    // ATTRIBUTES - boolean flags/capabilities
    "attributes": {
      "solid": true,           // blocks movement
      "visible": true,
      "controlled": false,     // player-controlled
      "hostile": false,
      "flammable": true,
      "pushable": false,       // can be pushed by player
      "breakable": false,
      "openable": false,       // doors, chests
      "lockable": false,
      "open": false,           // current open state (doors, chests)
      "locked": false,         // current locked state
      "sighted": false,        // AI avoids hazards
      "light_source": false,
      "inventory": 1,          // max inventory size
      "remains": "skull"       // entity spawned on death
    }
  }
}
```

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
- **Wildcard System**: Special tiles in the `wildcards` layer trigger procedural content generation. Wildcards detect contiguous regions and generate content sized to fit, preserving any authored content within gaps.
  - `maze` (tile 210) - Generates ROT.js EllerMaze, only filling wildcard tiles
  - `room` (tiles 143, 144) - Creates rectangular room with wall actors on perimeter
  - `item_spawn` / `actor_spawn` - Placeholder for random placement (not yet implemented)
- **Procedural Fallback**: Uses ROT.js Uniform algorithm if no `map.tmj` exists

Note: Tiled tile IDs are 1-indexed, so tile 210 in Tiled maps to ID 210 in `getWildcardType()`.

#### RenderSystem

PIXI.js rendering with layered containers:

1. `backgroundContainer` - Background tiles from Tiled `background` layer
2. `floorContainer` - Floor tiles from Tiled `floor` layer
3. `entityContainer` - Actors (2-tile) and items
4. `uiContainer` - UI elements

Actors render as two sprites stacked vertically (base at position, top one tile above).

**Tiled Layer Names:**

- `background` (tilelayer) - Walls, shadows, decoration behind floor
- `floor` (tilelayer) - Walkable floor tiles (tracked in `walkableTiles`)
- `wildcards` (tilelayer) - Special tiles that trigger procedural generation
- `actors` (objectgroup) - Objects with `type` or `class` matching actor definitions
- `items` (objectgroup) - Objects with `type` matching item definitions

**[Lighting](/LIGHTING.md)**

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
           ├─> MapManager.spawnPendingWalls()
           └─> RenderSystem.renderTestPattern() + renderActors()
```

---

See [CHANGELOG.md](CHANGELOG.md) for version history and implementation status.

### File Structure

```
.
├── assets
│   ├── audio
│   │   ├── sounds.ac3
│   │   ├── sounds.m4a
│   │   ├── sounds.mp3
│   │   └── sounds.ogg
│   ├── favicon.ico
│   ├── fonts
│   │   ├── cmunrm-webfont.woff
│   │   ├── cmunrm-webfont.woff2
│   │   ├── courier_prime_code-webfont.woff
│   │   └── courier_prime_code-webfont.woff2
│   ├── main.css
│   ├── main.css.map
│   ├── main.scss
│   ├── scss
│   │   ├── _base.scss
│   │   ├── _details.css
│   │   ├── _game.scss
│   │   └── _typography.scss
│   └── sprites
│       ├── fire-animation.png
│       ├── fluid-animation.png
│       ├── smoke-animation.png
│       └── static-tiles.png
├── CHANGELOG.md
├── data # Global entity definitions
│   ├── actors.json  # Actor templates (player, skeleton, wall, fire, etc.)
│   ├── adjectives.json #wordstuff
│   ├── attacks.json #wordstuff
│   ├── colors.json  #color names and hex values
│   ├── entities.json # decoration and description tiles
│   ├── items.json  # Item templates (key, bow, potions, etc.)
│   ├── personalities.json # AI behavior definitions
│   ├── reagents.json #unused magic potion ingredients
│   ├── sounds.json #named sounds in soundsprite
│   ├── static-tiles.json #main tileset
│   └── substances.json #wordstuff
├── deploy.sh
├── DESCRIPTIONS.md
├── DUNGEON_MODE_KIT_DESIGN.md
├── embed-example.html
├── engine.js # Core engine
├── globals.js # Global variables leftover from prototype
├── index.html
├── input.js
├── interface.js
├── ITEMS.md
├── lib
│   ├── howler.js
│   ├── pixi.min.js
│   ├── pixi.min.js.map
│   ├── rot.js
│   ├── rot.min.js
│   ├── tweenjs.js
│   └── tweenjs.min.js
├── LICENSE.txt
├── lighting.js
├── LIGHTING.md
├── prototypes # individual level definitions and overrides
│   ├── default #each level gets a folder with a map and json files to override or suppliment data
│   │   ├── actors.json
│   │   ├── items.json
│   │   ├── map.tmj
│   │   └── prototype.json # Level rules and mechanics
│   └── labyrinth
│       ├── actors.json
│       ├── map.tmj
│       └── prototype.json
├── README.md
├── sound.js
└── tiled
    ├── dungeonkit.tiled-project
    ├── dungeonkit.tiled-session
    └── static-tiles.tsj

See [LICENSE.txt](LICENSE.txt) for license info
