
# Dungeon Mode Kit - Design Document

```
         ______                                     ___  ___          _        _   ___ _       
         |  _  \                                    |  \/  |         | |      | | / (_) |      
         | | | |_   _ _ __   __ _  ___  ___  _ __   | .  . | ___   __| | ___  | |/ / _| |_     
         | | | | | | | '_ \ / _` |/ _ \/ _ \| '_ \  | |\/| |/ _ \ / _` |/ _ \ |    \| | __|    
         | |/ /| |_| | | | | (_| |  __/ (_) | | | | | |  | | (_) | (_| |  __/ | |\  \ | |_     
         |___/  \__,_|_| |_|\__, |\___|\___/|_| |_| \_|  |_/\___/ \__,_|\___| \_| \_/_|\__|    
                             __/ |                                                             
                            |___/                                                              
```

## Project Overview

**Dungeon Mode Kit** is a modular web-based roguelike framework designed to create multiple small game prototypes with different mechanics, all sharing common assets and core systems. This would allow me to make small embeddable games that correspond to the different topic in *The Dungeon Mode*
Based on previous expiments— [grotto roguelike](https://github.com/wysiwyggins/grotto_roguelike), [didaktik gama](https://github.com/wysiwyggins/Didaktik-Gama)

### Core Philosophy

- **Modular**: Mix authored and procedural content seamlessly
- **Semantic**: Clear, attribute-based entity system inspired by *Baba Is You*
- **Embeddable**: Canvas games integrated into web pages
- **Rapid Prototyping**: Quick iteration on different game mechanics

## Technical Architecture

### Rendering System

- **Technology**: PIXI.js (or performance-equivalent alternative)
- **Resolution**: Tiles displayed at half-size for hi-DPI displays
- **Height System**: Floor + 2-tile height (floor, base, top)
- **Layers**: Background shadows, floor, entities (1-2 tiles), UI. Tiles have transparent backgrounds so we need to manually hide occluded tiles on locations behind actors.
- - **Effects**: Sprite tinting, animation frames

## Core Architecture

### Entity System Hierarchy

#### Entity (Base Class)

**Purpose**: Any object with sprites and semantic attributes

```javascript
class Entity {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.attributes = new Map(); 
    this.sprite = null;
    this.tint = 0xFFFFFF;
  }
  
  // Helper methods for attribute management
  setAttribute(key, value) { this.attributes.set(key, value); }
  getAttribute(key) { return this.attributes.get(key) || false; }
  hasAttribute(key) { return this.attributes.has(key) && this.attributes.get(key); }
}
```

**Base Attributes**:

- **Physical**: `pushable`, `flammable`, `breakable`, `solid`
- **Visual**: `animated`, `visible`

#### Item (extends Entity)

**Purpose**: Single-tile pickupable objects

- **Height**: 1 tile
- **Behavior**: Passive, inventory integration
- **Examples**: Keys, potions, weapons, food

#### Actor (extends Entity)

**Purpose**: Interactive 2-tile entities with behavior

- **Height**: 2 tiles (base + top)
- **Behavior**: Active, personality-driven, turn-based
- **Examples**: Players, monsters, doors, walls, NPCs, Fire

### Personality System

**Data-Driven AI**: JSON files defining behavioral attributes

```json
// personalities/guard.json
{
  "controlled": false,
  "mutiply_chance": 0.2,
  "hostile": true,
  "tactical": true,
  "patrol_range": 5,
  "vision_range": 8,
  "memory_duration": 10,
  "preferred_positions": ["doorway", "corner", "chokepoint"],
  "behaviors": ["patrol", "guard_area", "pursue_intruders"]
  etc
}
```

**Switchable**: Personalities can change during gameplay (charm effects, mind control, etc.)

**Shared Behaviors**: Common AI routines (pathfinding, line-of-sight, etc.) used across personalities

## Map System

### Tiled Integration

**Layers**:

- **Floor Layer**: Defines playable area (engine auto-generates shadow background)
- **Item Layer**: 1-tile item placement
- **Actor Layer**: 2-tile actor placement

### Wildcard System

**Procedural Zones**: Special tiles painted in Tiled that trigger generation

- **Floor Wildcards**: Generate maze hallways, room layouts
- **Item Wildcards**: Randomize item drops (validates walkable floor)
- **Actor Wildcards**: Place procedural enemies, walls

### Processing Pipeline

1. **Load prototype**: Check for `map.tmj` in prototype folder
2. **Map handling**:
   - If `map.tmj` exists → load authored map
   - If no `map.tmj` → generate fully procedural level using ROT.js
3. **Process wildcard tiles** → replace with ROT.js generated content:

   ```javascript
   // Wildcard maze generation
   if (tileType === WILDCARD_MAZE) {
     const maze = new ROT.Map.Uniform(width, height);
     maze.create((x, y, value) => {
       floorMap[x][y] = value === 0 ? FLOOR_TILE : null;
       if (value === 1) spawnWallActor(x, y);
     });
   }
   ```

4. **Auto-generate wall actors** around floor perimeters (procgen areas)
5. **Load entities**:
   - Start with global actors/items
   - Override with prototype-specific variants
6. **Validate item placements** (must be on walkable floor)
7. **Instantiate entities** from tile IDs using lookup tables

## Prototype System

### Game Definition

Each prototype is a JSON file defining complete game rules:

```json
// prototypes/puzzle_cave/prototype.json
{
  "name": "Strength Puzzle Cave",
  "mechanics": {
    "fog_of_war": false,
    "darkness": false,
    "turn_based": true,
    "line_of_sight": false
  },
  "stats": {
    "strength": {
      "max": 10,
      "current": 10,
      "depletes_on": ["push_wall"],
      "restore_items": ["strength_potion"]
    },
    "health": { "max": 100, "current": 100 },
    "hunger": { "max": 100, "current": 100, "depletes_per_turn": 1 }
  },
  "inventory": { "max_items": 5 },
  "available_items": ["key", "strength_potion", "lever", "food"],
  "available_actors": ["wall", "pushable_wall", "door", "switch"],
  "win_conditions": ["reach_exit", "activate_all_switches"],
  "transitions": {
    "stairs_down": "dungeon_level2",
    "stairs_up": "previous_prototype"
  }
}
```

### State Management

**Multi-Prototype Navigation**:

- Stairways trigger prototype transitions
- Current state saved when entering stairs
- New prototype loaded with fresh/inherited stats
- Return to saved state when going back up

**Flexible Stats**: Each prototype defines its own character attributes

- Simple games: Just health
- Complex games: Health, hunger, strength, mana, etc.
- Stat interactions: Strength depletes when pushing walls, hunger affects health

## Game Systems

### Hybrid ROT.js Integration

**ROT.js Components (Kept)**:

- **Maze Generation**: Uniform, Cellular, Maze, Digger algorithms
- **Random Number Generation**: Seeded RNG for reproducible results

**Custom Components**:

- **Pathfinding**: A* optimized for attribute-based entities
- **Field of View**: Respects entity `darkness` and vision-blocking attributes
- **Turn Management**: Integrated with personality system
- **Entity Systems**: Semantic attribute-based architecture

### Turn Engine

- **Custom Scheduler**: Turn-based actor management with personality integration
- **Input Handling**: Keyboard, mouse, touch
- **AI Processing**: Personality-driven behaviors per turn

### Collision & Physics

- **Custom Pathfinding**: A* algorithm respecting entity attributes (`solid`, `pushable`)
- **Collision**: Check actor attributes instead of separate wall maps
- **Interactions**: Attribute-based object interactions

### Rendering Pipeline

1. **Background**: Auto-generated shadows behind floor
2. **Floor**: Walkable terrain tiles
3. **Entities**: Items (1 tile) and actors (2 tiles)
4. **Effects**: Fire, smoke, tinting, animations
5. **UI**: Inventory, stats, messages

## Development Workflow

### Creating New Prototypes

1. **Create folder**: Make new directory in `prototypes/`
2. **Define game**: Create `prototype.json` with mechanics and stats
3. **Choose content approach**:
   - **Authored**: Create `map.tmj` with floor/item/actor layers + wildcards
   - **Procedural**: Omit `map.tmj` for fully generated levels
   - **Mixed**: Use wildcard tiles in authored maps
4. **Customize entities**: Add prototype-specific actors/items in local folders
5. **Test**: Embed canvas in explanatory web page

### Asset Loading Priority

1. **Global First**: Load global actors/items as defaults
2. **Local Overrides**: Prototype-specific actors/items override globals
3. **Auto-Detection**: Engine automatically detects and loads `map.tmj` if present

### Content Authoring

- **Mixed Content**: Hand-authored areas + procedural zones in same map
- **Rapid Iteration**: JSON-driven mechanics allow quick rule changes
- **Asset Reuse**: Same sprites/audio across all prototypes

## Technical Considerations

### Performance

- **Efficient Rendering**: Minimize draw calls, sprite batching
- **Memory Management**: Prototype state saves, asset sharing
- **Turn-Based**: No real-time performance requirements

### Modularity

- **Hybrid Architecture**: ROT.js for maze generation and rng, custom systems for entities
- **Plugin Architecture**: Mechanics as optional modules
- **Data-Driven**: Minimize hard-coded game rules
- **Backwards Compatibility**: Preserve spritesheet and audio sprite format
- **Lightweight**: Only include ROT.js features actually used (maze generation, RNG)

### Web Integration

- **Embeddable**: Canvas games integrated into explanatory pages
- **Responsive**: Adapt to different screen sizes
- **Accessibility**: Keyboard navigation, screen reader support
