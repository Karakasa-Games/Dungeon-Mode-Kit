# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Pie in the sky

- falling between levels instead of instadeath
- tile flipbook animations
- music engine
- Continuity: start at any specified prototype as whatever that protos controllable actor is, OR enter from stairway as the previous player character, with inventory etc
- Alternative first-person view pane (for perspective dungeon style play)
- Extend the text discription area to optionally plug into parallel text environments for a paired room in Evennia or inform7 etc for text adventure or mud stuff?

### Planned

- stats that have per-turn operations, like "nutrition" that ticks down or "health" that ticks up. Not hard-coded, can be set in actor json when defining the stat. The amount-per-turn can be modified by item wear effects etc.
- put a counter by repeated description messages rather than let them add additional messages to list

### In Progress

- Mining (works but requires testing and refinement, Currently 3 hits always removes a breakable actor, which feels unnatural)
- FOV epistemology (currently messages aren't filtered by vision range, make sound alt, also some things like mining walls can still be seen out of range)
- Ball of thread item and entity trails (this is almost done, last tile of thread is hidden when walking down but still overlaps actor top tile when approaching from under on either side)

## [0.7b] 2025-01-22

### Added

- Optional HTML sidebar for actors and items:
  - `#actors` div displays visible actors with stats
  - `#items` div displays visible items with "Visible Items" header
  - `#description` existing area for action messages and hover inspection messages which clear.
  - Actors with stats are listed in actors, not doors walls lava etc.
  - Stats with current/max ratios displayed as thermometer bars (1/1 stats hidden)
  - Inventory attribute shown as current/max ratio numbers not thermometer
  - Sidebar updates automatically on visibility changes (needs testing), entity add/remove, and actor death
  - Sidebar elements optional - embedded prototypes work without them, could start simply and then add complexity over each level

### Fixed

- Equipment sprites no longer duplicated when actors have default_items equipped
- light_source actors no longer cast a shadow entity

## [0.7a] 2025-01-20

### Added

- Combat system improvements:
  - RNG-based hit rolls using accuracy vs defense (clamped 5-95%)
  - Weapon equipment slot - equipped weapons replace unarmed collision_effect
  - Equipment menu (E key) for managing wearables and weapons
  - Templated attack messages with `[actor_name]`, `[attacked_actor_name]`, `[weapon_name]`, `[attacks.melee_verbs]`
  - Miss messages when attacks fail hit roll
- Procedural dungeon generation:
  - PRISON_WINDOW (tile 16) and OPAQUE_PRISON_WINDOW (tile 152) wildcards for rooms + corridors (ROT.Map.Digger)
  - Existing maze wildcard (tile 210) uses ROT.Map.EllerMaze
  - Automatic up_stairway placement if none manually placed in generated levels
  - Locked up_stairway spawns if prototype has no previous_level
  - Fixed fully procedural maps (no map.tmj) to use correct tile format
- Random actor spawning via prototype config:
  - `random_actors` object in prototype.json
  - Per-actor `chance` (0-100%), `min`, and `max` spawn counts
  - 100% chance = exactly one guaranteed spawn
- Deep water current system:
  - Actors and items float and drift with configurable current direction
  - Items update sprite position when floating

## [0.6b] 2025-01-15

### Added

- Win conditions system for prototypes:
  - `wearing:item_type` - player must have item equipped
  - `holding:item_type` - player must have item in inventory
  - `killed:actor_type` - all actors of that type must be dead
  - Locked down stairways unlock when conditions are met
  - Visual tile change and message when stairway unlocks
- Generic `collision_description` attribute for solid actors
- Entity `walk_description` attribute for messages when walking over entities
- Actor shadows cast from colored light sources (sorta works)
- Mouse-based tile highlighting with color inversion on hover
- Throw action for all items:
  - Aiming mode with red line path preview
  - Path stops at solid actors
  - Projectile animation showing item moving along path
  - Items break on impact by default (Brogue-style), configurable via `breakable_on_throw: false`
  - Collision effects apply to hit targets
  - Worn items auto-unequip before throwing
- Click-to-walk with A* pathfinding:
  - Yellow path preview on hover
  - Auto-walk with configurable delay
  - Notable events interrupt auto-walk (hostile approaches, etc.)
  - Cannot target dark/unexplored tiles
- Collision effect attribute/stat references using `{attribute}` syntax (e.g., `"health": "-{strength}"`)

### Fixed

- Dead actors now stay hidden on dark levels
- White light sources no longer wash out colored light tints
- Floor-only colored light tinting (excludes void tiles)
- Fixed npc deaths on dark levels

## [0.6a] 2026-01-13

### Added

- Description html element shows verbose descriptions of actions and moused-over entities. List of three descriptions (Brogue style)
- Fog of war memory: "You remember seeing [entity]" for explored but not visible tiles
- Message stacking: multiple events in same turn display together (e.g., attack + death)
- Item identification system:
  - Items can have `random_color: true` for randomized appearance per prototype
  - Unidentified/identified name templates (e.g., "blue potion" → "Potion of Healing")
  - Using an item identifies it and all items of that type
- Color-paired keys and locked doors:
  - Keys and locked doors get matching random colors when spawned
  - "The blue key unlocks the blue door!" / "The red door requires a red key"
  - Keys consumed on successful unlock
- Description text templates with `[a-an]` for automatic article selection
- Template variables: `[adjectives.category]`, `[attacks.melee_verbs]`, `[item_name]`, `[actor_name]`
- `collision_description` attribute for actors (templated attack messages)
- `use_description` attribute for items (templated use messages)
- Player info box auto-updates after each turn to reflect stat changes
- Global data loading: colors.json, adjectives.json, attacks.json

### Changed

- Added some .json data for templated text (substances, reagents, adjectives, attacks)
- Default Keys now use color-based unlocking instead of universal unlock

### Fixed

- Item tiles in inventory now respect flipH/flipV properties
- player info window stops listening for item buttons when closed

## [0.5a] 2026-01-05

### Added

- UI tweaks including thermometer UI for health and nutrition stats
- Actors can have a non-item related collision_effect for melee attacks etc
- pushable actors work
- melee attacks use actor collision_effect

### Changed

- Pulled actor and item data from prototype.json, use actors.json and items.json in the prototype folders
- if there's no health for the player in prototype/actors.json, it's a one-hit death with no health bar
- changed effects.json to sounds.json as well as all supporting files and references

### Fixed

- Don't warn when walking into walls
- performance issue with fog of war related to multiple controlled actors

## [0.4a] 2026-01-03

### Added

- Basic UI (textboxes with selectable options)
- Player info window showing name, attributes, and inventory with letter-prefixed items (a, b, c...)
- Item action menu with Drop, Wear/Remove, and custom use_verb options
- Confirmation dialogs for hazardous movement (lava, void) with Y/N input
- A* pathfinding via ROT.js (`findPathAStar`, `findPathDijkstra`, `getNextPathStep`, `pathExists`)
- Bresenham line path algorithm (`getLinePath`, `hasLineOfSight`, `getFirstBlockingPoint`)
- Distance utility functions (`getManhattanDistance`, `getChebyshevDistance`, `getEuclideanDistance`)
- AI behaviors: `attack_adjacent`, `pursue_target` (with A* pathfinding), `flee_from_danger`, `incinerate_entities`
- `aggressive_melee` personality - enemies can chase and attack controlled actors
- `lava_behavior` personality - incinerates solid actors (spawns fire) and liquids (spawns smoke)
- `spawnActor` method for dynamically spawning actors at runtime
- `spawnEntity` method for spawning decorative entities from entities.json
- `remains` attribute for actors - spawns a decorative entity on death (blood, skull, rubble)
- `liquid` attribute for actors
- `fireproof` attribute check for lava hazard warnings

### Changed

- `canSeeTarget` now uses actual line-of-sight checking instead of just distance
- `moveToward` now uses A* pathfinding with fallback to simple directional movement
- `findNearestPlayer` properly calculates distance to find nearest controlled actor
- Equipment status now checked via `actor.isItemEquipped(item)` instead of `item.equipped`

## [0.3a] - 2025-12-30

### Added

- Item system documentation (ITEMS.md)
- Attribute-based item effects replacing hardcoded item types
- Collision effects: items can modify attributes on actors the holder collides with
  - Numeric values add/subtract (e.g., `"health": -10` for damage)
  - Boolean values set directly (e.g., `"locked": false` for keys)
  - `"toggle"` value toggles boolean attributes
- Wear effects: wearable items can modify wearer's attributes while equipped
  - Same value types as collision effects
  - Effects reversed on unequip
- Equipment system with three positional slots:
  - `top`: above actor's head (y-2) for crowns, horns, halos
  - `middle`: on actor's top tile (y-1) for helmets, masks
  - `lower`: on actor's base tile (y) for armor, cloaks
- Use verb system: items define custom UI verbs (e.g., "Drink", "Dig", "Fire")
- Custom pickup and use sounds per item with defaults
- Animated tiles now start on random frames for visual variety
- Sword item with collision damage
- Crown item with strength wear effect

### Changed

- Items auto-equip to appropriate slot when picked up
- Picking up item for occupied slot unequips previous item
- Removed weapon/attack_type attributes in favor of collision_effect
- Item properties (use_effect, restore_amount, etc.) moved into attributes

### Removed

- Hardcoded weapon boolean attribute
- Hardcoded attack_type attribute

## [0.2a] - 2025-12-29

### Added

- Up and down stairway actors for level transitions
- Level linking via next_level and previous_level prototype config attributes
- Player spawns at appropriate stairway when transitioning between levels
- Minotaur actor
- Wall wildcard tile (132) for manual wall placement in Tiled maps
- Tile flip support (flipBaseH, flipBaseV, flipTopH, flipTopV) for actor sprites
- Audio variation system with randomized volume and pitch

### Changed

- Lighting system now shows actor top tiles even when their base casts a shadow
- Footstep audio plays at lower volume with slight randomization for natural feel
- Refactored lighting logic into lighting.js helper methods
- Refactored audio code into separate sound.js module

### Fixed

- Turn engine no longer errors when unlocking an already-unlocked engine

## [0.1a] - 2025-12-18

### Added

- Core engine architecture with DungeonEngine orchestrating all subsystems
- Entity system with hierarchical Entity > Item/Actor classes
- Attribute-based entity properties (solid, pushable, flammable, breakable, visible, etc.)
- PIXI.js rendering pipeline with layered containers (background, floor, entity, darkness, UI)
- Tiled map loading with support for tilelayers and objectgroups
- Audio sprite support via Howler.js wrapper
- Prototype loading system for game configurations
- Wildcard system with contiguous region detection for procedural content
- ROT.js maze generation (EllerMaze) triggered by wildcard tiles
- Room generation with automatic wall actor placement on perimeters
- Maze-room passageway detection (walls omitted where maze paths meet room perimeters)
- Turn engine using ROT.js Scheduler.Simple
- Observer mode with auto-advance turns when no controlled actors
- Play/pause (space) and reload (escape) controls in observer mode
- Diagonal shadow rendering under floor tiles (addBaseAndShadows)
- Actor falling into void (removes from play, transitions to observer mode if player dies)
- Item pickup and per-actor inventory system (inventory attribute determines capacity)
- Sighted attribute for actors to check for floor before moving
- Input handling for keyboard (arrow keys, WASD)
- Animated sprites system with dynamic frame count detection from spritesheet width
- Tint flickering effect for fire animations using CreateJS Tween
- Wildcard tiles for spawning fire (tile 9) and sewage (tile 135) actors
- Darkness and lighting system using ROT.FOV.PreciseShadowcasting
- Light sources cast light that stops at walls and solid actors
- Fog of war with explored/unexplored tile tracking
- Textured darkness overlay using FULL_BLOCK tile with random flipping
- Solid fill for fully dark areas, textured fill for light gradations
- Door actors with open/close functionality
- Opening doors allows light to pass through
- Configurable ambient light and player light radius in prototype config
