# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- Pathfinding (A*)
- Combat system
- Item use/effects
- UI (inventory, stats, messages)
- Item drops on death
- First-person view pane (experimental)
- Verbose text description of turns (experimental)

### In Progress

- Multi-level state stack
- AI behaviors (structure exists, random_walk works, others are stubs)
- Wildcard item/actor spawning (stubs exist)

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
