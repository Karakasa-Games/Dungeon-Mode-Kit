# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Pie in the sky

- First-person view pane (experimental)
- Verbose text description of turns (experimental)

### Planned

- Item drops on death
- Mouse Input
- Aiming UI
- Treasure rooms with locked doors, color paired keys and doors
- Test and build out fully generated levels
- Brogue style deep sewage that floats items
- Fire and smoke actors should dissipate

### In Progress

- Multi-level state stack
- Wildcard item/actor spawning (stubs exist)

## [0.5a] 2026-01-05

### Added

- UI tweaks including thermometer UI for health and nutrition stats

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
- `liquid` attribute for actors (used by incineration logic)
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

### Changed

- Animation frame loading now calculates frame count from texture width rather than hardcoding to 7

### Fixed

- Animated sprites no longer error when spritesheet has fewer than 7 frames
- Light sources no longer block their own light emission
