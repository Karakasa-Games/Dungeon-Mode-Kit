
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
- **Rapid Prototyping**: Quick iteration on different game mechanics, don't bother with persistence between levels

## Design Questions

- How do we deal with a changing number of arbitrary stats? This means how do we display them and give feedback when they change and describe them in text? We may need to add another html element over description for visible actor stats to avoid taking up canvas space.
- Need a clearer design for combat. The initial design was meant to be simple and flexible: actors and items can have collision effects, which can modify any attribute or stat. This lets us do things beyond just combat, allowing for more experimentation on a per-prototype basis. Where this design needs clarity is how actor collision effects and item collision effects stack or supercede one another. Also- what about rng? A weapon attribute could add rng's to collision effects and additional attributes could modify those. A weapon attribute could also serve as an equip slot the way wearable items are equipped, saving confusion about stacking collision effecting items, but we wouldn't want to prevent the function of other items like keys. We could have an equipped weapon's collision effect replace any same quality collision effect on the actor or other items. This means that an actor with a collision effect to open any door would still open doors while equipping a sword that reduces health stats on collision. We could use weapon_type instead of just a weapon bool if we want to both flag an item as a weapon and have attack styles like in Brogue, which has spears, flails etc. Because Actors don't have any inherent attributes like accuracy and denfense in Brogue, maybe we can assume no modification of rolls when these attributes are absent, but bring them into the rng when they are. Brogue's hit formula is: hit probability = (accuracy) * 0.987 ^ (defense). Negative numbers and numbers over 100 are permitted. What is the formula in DCSS or Moria? Our code should also have allowances for 100% hits of actors with attributes to be determined later, like sleeping or paralyzed. We currently have three slots for wearable items which can modify any attribute, so these can be used to add a defense attribute to an actor. rot.js rng documentation is [here](https://ondras.github.io/rot.js/manual/#rng)

## Technical Architecture

### Rendering System

- **Technology**: PIXI.js (or performance-equivalent alternative)
- **Resolution**: Tiles displayed at half-size for hi-DPI displays
- **Height System**: Floor + 2-tile height (floor, base, top, ((ok and also maybe hats))
- **Layers**: Background shadows, floor, entities (1-2 tiles), UI. Most tiles have transparent backgrounds so we need to manually hide occluded tiles on locations behind actors.
- - **Effects**: Sprite tinting, animation frames

## Entity System

The engine uses a simple class hierarchy: **Entity** → **Item** and **Actor**. All behavior is driven by attributes defined in JSON data files.

### Entity (Base Class)

Entities have a position, type identifier, sprite, tint, and a map of attributes. Attributes can be any value type—boolean flags, numbers, strings, or objects. The `hasAttribute(key)` method returns true only if the attribute exists and is truthy, while `getAttribute(key)` returns the raw value.

### Item

Items are single-tile entities defined in `data/items.json` or prototype-specific `items.json` files. They sit on the floor and can be picked up by actors with an `inventory` attribute.

Key item attributes include `pickupable`, `visible`, `stackable`, `consumable`, and `flammable`. Items can have a `wearable` slot (`top`, `middle`, or `lower`) to auto-equip when picked up. Wearable items render above the actor at their slot position.

**Effects:** Items use attribute-based effects rather than hardcoded types:

- `collision_effect` modifies attributes on actors the holder collides with (e.g., `{"health": -10}` for damage, `{"locked": false}` for keys)
- `wear_effect` modifies the wearer's attributes while equipped (e.g., `{"strength": 5}`)
- Effect values can be numbers (add/subtract), booleans (set), or `"toggle"`

Items with `use_verb` can be activated through UI (e.g., "Drink", "Dig"). The `use_effect` attribute specifies the effect type.

### Actor

Actors are two-tile entities (base + top) defined in `data/actors.json`. They include creatures, the player, doors, walls, fire, and other interactive objects. Actors participate in the turn-based scheduler if they have a `personality` attribute.

Actor qualities are organized into two categories:

- **Attributes**: Boolean flags and configuration values stored in a Map. Examples: `solid`, `visible`, `hostile`, `controlled` (player), `sighted`, `flammable`, `openable`, `locked`, `open`, `light_source`, `stairway`, `inventory` (max size).
- **Stats**: Numeric values with `{ max, current }` structure that change during gameplay. Examples: `health`, `strength`. Stats can be referenced in collision effects using `"{stat}"` or `"-{stat}"` syntax.

Actors can have their own `collision_effect` for unarmed attacks or special interactions. The `default_items` array spawns items in the actor's inventory on creation. The `paint_tile` attribute lets you place actors in Tiled using a specific tile on the wildcards layer.

### Personalities and AI

Actor behavior is controlled by the `personality` attribute (e.g., `"aggressive_melee"`, `"random_walk"`). Personalities map to behavior functions that execute each turn. Hostile actors with `sighted` avoid walking into pits; those without may fall.

## Map System

### Tiled Integration

**Layers**:

- **Floor Layer**: Defines playable area (engine auto-generates shadow background)
- **Item Layer**: 1-tile item placement
- **Actor Layer**: 2-tile actor placement

### Wildcard System

**Procedural Zones**: Special tiles painted in Tiled that spawn actors on prototype load

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

A prototype is a self-contained level or game variant. Each prototype folder contains a `prototype.json` config and optionally a `map.tmj` (Tiled map), plus local `actors.json` and `items.json` overrides.

### Prototype Config

```json
{
  "name": "Cretan Labyrinth",
  "loaded_sound": "levelout",
  "depth": 2,
  "turn_speed": 50,
  "next_level": "deeper_labyrinth",
  "previous_level": "default",
  "mechanics": {
    "fog_of_war": true,
    "darkness": true,
    "ambient_light": 0.1,
    "player_light_radius": 6
  }
}
```

The `next_level` and `previous_level` fields link prototypes via stairway actors. The `mechanics` object controls lighting and visibility systems. The `loaded_sound` plays when the level finishes loading.

### Entity Overrides

Actor and item stats are defined in actor/item JSON files, not the prototype config. Prototypes can override global definitions by including local `actors.json` or `items.json` files. The engine loads global definitions first, then merges prototype-specific overrides.

### Creating a Prototype

Create a folder in `prototypes/` with a `prototype.json`. For authored content, add a `map.tmj` with floor, actors, items, and wildcards layers. Without a map file, the engine generates a procedural level. Add local `actors.json` or `items.json` to customize entities for this prototype.
