
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

- How do we deal with a changing number of arbitrary stats? This means how do we display them and give feedback when they change and describe them in text? We may need to add another html element over description for visible actor stats to avoid taking up canvas space. We want to always avoid hard coding and specificity as much as possible to allow for things to be defined by the data files- prototypes, actors, items, personalities, behaviors, etc. Strive towards readability and flexibility in those files.

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

## Combat System

Combat occurs when actors collide. The system uses RNG-based hit rolls and supports both melee and equipped weapon attacks.

### Hit Calculation

When an actor with an `accuracy` attribute attacks a target:

```
hit_chance = clamp(attacker_accuracy - target_defense, 5, 95)
```

- Roll uses `ROT.RNG.getPercentage()` (1-100)
- If roll ≤ hit_chance, the attack hits
- Minimum 5% hit chance, maximum 95%
- Actors without `accuracy` always hit (deterministic combat)
- Incapacitated targets (sleeping, paralyzed) are always hit

### Damage Sources

The combat system determines damage from multiple sources in priority order:

1. **Equipped Weapon**: If the attacker has a weapon in their `equipment.weapon` slot, its `collision_effect` is used, replacing a same-atrribute-effecting actor collision effect
2. **Actor's Collision Effect**: Falls back to the attacker's own `collision_effect` attribute

Damage values can reference stats using `"{stat}"` syntax (e.g., `"-{strength}"` deals damage equal to the attacker's strength).

### Equipment Slots

Actors have equipment slots for wearable items and weapons:

- **weapon**: Equipped weapon (replaces unarmed `collision_effect`)
- **top**: Head/hat slot
- **middle**: Body/torso slot
- **lower**: Legs/feet slot

Items with `"weapon": true` equip to the weapon slot. Items with `"wearable": "top|middle|lower"` equip to armor slots and render visually on the actor.

### Combat Attributes

**Actor attributes:**
- `accuracy`: Base hit chance percentage (e.g., 75)
- `defense`: Reduces attacker's hit chance (e.g., 5)
- `collision_effect`: Damage/effects applied on unarmed collision
- `collision_sound`: Sound played when hitting
- `collision_description`: Template for attack messages

**Item attributes (weapons):**
- `weapon`: Boolean flag marking item as a weapon
- `collision_effect`: Damage dealt when equipped weapon hits
- `collision_sound`: Sound played on weapon hit
- `collision_description`: Template for weapon attack messages

### Attack Messages

Attack descriptions use template substitution:

```json
"collision_description": "[actor_name] [attacks.melee_verbs] the [attacked_actor_name] with [a-an] [weapon_name]!"
```

**Template variables:**
- `[actor_name]`: The attacker's name
- `[attacked_actor_name]`: The target's name
- `[weapon_name]`: Equipped weapon's name (if any)
- `[attacks.melee_verbs]`: Random verb from `attacks.json` melee_verbs array
- `[attacks.miss_verbs]`: Random verb from miss_verbs array
- `[a-an]`: Automatically selects "a" or "an" based on following word

Miss messages are shown when attacks fail the hit roll.

### Example Configuration

**Actor with accuracy (actors.json):**
```json
"player": {
  "collision_effect": { "health": -2 },
  "collision_description": "You [attacks.melee_verbs] the [attacked_actor_name]!",
  "attributes": {
    "accuracy": 75
  }
}
```

**Weapon item (items.json):**
```json
"sword": {
  "name": "Sword",
  "attributes": {
    "weapon": true,
    "collision_effect": { "health": -10 },
    "collision_description": "[actor_name] [attacks.melee_verbs] the [attacked_actor_name] with [a-an] [weapon_name]!"
  }
}
```

**Enemy with defense (actors.json):**
```json
"skeleton": {
  "collision_effect": { "health": -5 },
  "collision_description": "The [actor_name] [attacks.melee_verbs] the [attacked_actor_name]!",
  "attributes": {
    "hostile": true,
    "accuracy": 60,
    "defense": 5
  }
}
```

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
