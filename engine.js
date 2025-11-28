/**
 * Dungeon Mode Kit - Core Engine
 * A modular roguelike engine supporting multiple prototypes with mixed authored/procedural content
 */

// ============================================================================
// SPRITE LIBRARY
// ============================================================================

class SpriteLibrary {
    constructor() {
        this.tiles = null;
        this.animations = null;
    }
    
    async load() {
        try {
            const response = await fetch('./data/static-tiles.json');
            const data = await response.json();
            this.tiles = data.tiles;
            
            // Store animation metadata
            this.animations = {
                'fire': 'fire',
                'smoke': 'smoke'
            };
            
            console.log('Sprite library loaded with', Object.keys(this.tiles).length, 'tiles');
        } catch (error) {
            console.error('Failed to load sprite library:', error);
            this.tiles = {};
        }
    }
    
    /**
     * Get tile coordinates by name
     * @param {string} name - Tile name from static-tiles.json (e.g. "WHITE_KEY", "SKULL")
     * @returns {{x: number, y: number}|null} Tile coordinates or null if not found
     */
    getTileByName(name) {
        if (!this.tiles) {
            console.error('Sprite library not loaded');
            return null;
        }
        
        const coords = this.tiles[name.toUpperCase()];
        if (!coords) {
            console.warn(`Tile '${name}' not found in sprite library`);
            return null;
        }
        
        return { x: coords[0], y: coords[1] };
    }
    
    /**
     * Check if a name refers to an animated sprite
     * @param {string} name - Animation name (e.g. "fire", "smoke")
     * @returns {boolean} True if this is an animated sprite
     */
    isAnimation(name) {
        return this.animations && this.animations.hasOwnProperty(name.toLowerCase());
    }
    
    /**
     * Resolve a tile reference - handles both direct coordinates and named tiles
     * @param {Object|string} tileRef - Either {x, y} coords or a string name
     * @returns {{x: number, y: number}|null} Resolved tile coordinates
     */
    resolveTile(tileRef) {
        if (!tileRef) return null;
        
        if (typeof tileRef === 'object' && tileRef.x !== undefined && tileRef.y !== undefined) {
            return tileRef;
        }
        
        if (typeof tileRef === 'string') {
            return this.getTileByName(tileRef);
        }
        
        console.warn('Invalid tile reference:', tileRef);
        return null;
    }
}

// ============================================================================
// CORE ENGINE CLASS
// ============================================================================

class DungeonEngine {
    constructor(config = {}) {
        // Core systems
        this.app = null;
        this.scheduler = null;
        this.turnEngine = null;
        this.renderer = null;
        this.mapManager = null;
        this.entityManager = null;
        this.spriteLibrary = new SpriteLibrary();
        
        // Game state
        this.currentPrototype = null;
        this.prototypeStack = []; // For multi-level navigation
        this.gameOver = false;
        
        // Configuration
        this.config = {
            containerId: 'game',
            tileWidth: 40,
            tileHeight: 30,
            backgroundColor: 0xf5f5ee,
            ...config
        };
        
        // Canvas dimensions will be set when map loads
        this.canvasWidth = null;
        this.canvasHeight = null;
    }
    
    async initialize() {
        await this.spriteLibrary.load();
        await this.loadGlobalAssets();
        this.setupEventListeners();
        
        console.log('Engine initialized (renderer will be created when map loads)');
    }
    
    async initializeRenderer() {
        const container = document.getElementById(this.config.containerId);
        if (!container) {
            throw new Error(`Container element #${this.config.containerId} not found`);
        }

        try {
            this.app = new PIXI.Application({
                width: this.canvasWidth,
                height: this.canvasHeight,
                backgroundColor: this.config.backgroundColor,
                autoDensity: false,
                resolution: 1
            });
            
            this.app.stage.sortableChildren = true;
            this.renderer = new RenderSystem(this.app, this.mapManager.width, this.mapManager.height);
            container.appendChild(this.app.view);
            this.app.view.style.width = `${this.canvasWidth / 2}px`;
            this.app.view.style.height = `${this.canvasHeight / 2}px`;
            this.app.view.style.imageRendering = 'pixelated';
            this.app.view.style.imageRendering = '-moz-crisp-edges';
            this.app.view.style.imageRendering = 'crisp-edges';
            
            console.log(`Renderer initialized: ${this.canvasWidth}x${this.canvasHeight}px canvas, scaled to ${this.canvasWidth/2}x${this.canvasHeight/2}px display`);
        } catch (error) {
            console.error('Failed to initialize PIXI renderer:', error);
            throw new Error(`Renderer initialization failed: ${error.message}`);
        }
    }
    
    async loadGlobalAssets() {
        try {
            await Promise.race([
                new Promise((resolve, reject) => {
                    PIXI.Loader.shared.onError.add((error) => {
                        console.error('Asset loading error:', error);
                        reject(error);
                    });
                    
                    PIXI.Loader.shared
                        .add('tiles', globalVars.SPRITESHEET_PATH)
                        .add('fire', './assets/sprites/fire-animation.png')
                        .add('smoke', './assets/sprites/smoke-animation.png')
                        .load(() => {
                            this.setupAnimationFrames();
                            resolve();
                        });
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Asset loading timeout')), 10000)
                )
            ]);
            
            console.log('Sprites loaded successfully');
        } catch (error) {
            console.error('Failed to load sprite assets:', error);
            throw error;
        }
        

        try {
            const audioData = await fetch("./data/effects.json").then(r => r.json());
            this.audioManager = new AudioManager(audioData);
            console.log('Audio loaded successfully');
        } catch (error) {
            console.warn('Failed to load audio effects:', error);
            this.audioManager = null;
        }
        
        console.log('Global assets loaded');
    }
    
    setupAnimationFrames() {
        this.animationFrames = {
            fire: [],
            smoke: []
        };
        
        for (let i = 0; i < 7; i++) {
            let rect = new PIXI.Rectangle(i * globalVars.TILE_WIDTH, 0, globalVars.TILE_WIDTH, globalVars.TILE_HEIGHT);
            this.animationFrames.fire.push(
                new PIXI.Texture(PIXI.Loader.shared.resources.fire.texture.baseTexture, rect)
            );
            this.animationFrames.smoke.push(
                new PIXI.Texture(PIXI.Loader.shared.resources.smoke.texture.baseTexture, rect)
            );
        }
    }
    
    setupEventListeners() {
        createjs.Ticker.framerate = 60;
        createjs.Ticker.addEventListener("tick", createjs.Tween);
        
        console.log('Event listeners initialized');
    }
    
    async loadPrototype(prototypeName) {
        console.log(`Loading prototype: ${prototypeName}`);
        const prototypeConfig = await this.loadPrototypeConfig(prototypeName);
        this.currentPrototype = new Prototype(prototypeName, prototypeConfig, this);
        await this.currentPrototype.loadAssets();
        this.mapManager = new MapManager(this);
        const hasAuthoredMap = await this.checkForAuthoredMap(prototypeName);
        
        if (hasAuthoredMap) {
            await this.mapManager.loadTiledMap(`prototypes/${prototypeName}/map.tmj`);
        } else {
            this.mapManager.generateProceduralMap();
        }
        
        this.canvasWidth = this.mapManager.width * this.config.tileWidth;
        this.canvasHeight = this.mapManager.height * this.config.tileHeight;
        
        await this.initializeRenderer();
        
        // Initialize entity manager
        this.entityManager = new EntityManager(this);
        
        // Spawn entities from Tiled object layers
        await this.entityManager.spawnEntities(this.currentPrototype.config);
        
        // Process wildcards
        await this.mapManager.processWildcards();
        
        // Render the map and entities
        this.renderer.renderTestPattern(this.mapManager);
        this.renderer.renderActors(this.entityManager);
        
        console.log(`Prototype ${prototypeName} loaded successfully`);
        console.log(`Map size: ${this.mapManager.width}x${this.mapManager.height} tiles`);
        console.log(`Canvas size: ${this.canvasWidth}x${this.canvasHeight}px`);
        console.log(`Walkable tiles: ${this.mapManager.walkableTiles.length}`);
        console.log(`Actors spawned: ${this.entityManager.actors.length}`);
    }
    
    async loadPrototypeConfig(prototypeName) {
        try {
            const response = await fetch(`prototypes/${prototypeName}/prototype.json`);
            return await response.json();
        } catch (error) {
            console.error(`Failed to load prototype config for ${prototypeName}:`, error);
            return this.getDefaultPrototypeConfig();
        }
    }
    
    async checkForAuthoredMap(prototypeName) {
        try {
            const response = await fetch(`prototypes/${prototypeName}/map.tmj`, { method: 'HEAD' });
            return response.ok;
        } catch {
            return false;
        }
    }
    
    getDefaultPrototypeConfig() {
        return {
            name: "Default Prototype",
            mechanics: {
                fog_of_war: false,
                darkness: false,
                turn_based: true,
                line_of_sight: false
            },
            stats: {
                health: { max: 100, current: 100 }
            },
            inventory: { max_items: 10 },
            available_items: ["key", "bow", "arrow"],
            available_actors: ["player", "monster", "wall"],
            win_conditions: ["reach_exit"]
        };
    }
    
    transitionToPrototype(prototypeName, saveState = true) {
        if (saveState) {
            this.prototypeStack.push({
                name: this.currentPrototype.name,
                state: this.saveGameState()
            });
        }
        
        this.cleanup();
        this.loadPrototype(prototypeName);
    }
    
    returnToPreviousPrototype() {
        if (this.prototypeStack.length === 0) {
            console.warn('No previous prototype to return to');
            return;
        }
        
        const previous = this.prototypeStack.pop();
        this.cleanup();
        this.loadPrototype(previous.name);
        this.restoreGameState(previous.state);
    }
    
    saveGameState() {
        return {
            player: this.entityManager.player.serialize(),
            entities: this.entityManager.serializeEntities(),
            map: this.mapManager.serializeMap()
        };
    }
    
    restoreGameState(state) {
        this.entityManager.player.deserialize(state.player);
        this.entityManager.deserializeEntities(state.entities);
        this.mapManager.deserializeMap(state.map);
    }
    
    cleanup() {

        if (this.turnEngine) {
            this.turnEngine.lock();
        }

        if (this.scheduler) {
            this.scheduler.clear();
        }
        
        if (this.entityManager) {
            this.entityManager.cleanup();
        }
        
        if (this.mapManager) {
            this.mapManager.cleanup();
        }
        if (this.renderer) {
            this.renderer.clear();
        }
    }
}

// ============================================================================
// PROTOTYPE CLASS
// ============================================================================

class Prototype {
    constructor(name, config, engine) {
        this.name = name;
        this.config = config;
        this.engine = engine;
        this.basePath = `prototypes/${name}/`;
    }
    
    async loadAssets() {
        this.actors = await this.loadJSON('actors.json', {});
        this.items = await this.loadJSON('items.json', {});
        this.personalities = await this.loadJSON('personalities.json', {});
        console.log(`Loaded assets for prototype: ${this.name}`);
    }
    
    async loadJSON(filename, defaultValue) {
        try {
            const response = await fetch(this.basePath + filename);
            return await response.json();
        } catch (error) {
            console.warn(`No ${filename} found for prototype ${this.name}, using defaults`);
            return defaultValue;
        }
    }
    
    getActorData(actorType) {
        return this.actors[actorType] || null;
    }
    
    getItemData(itemType) {
        return this.items[itemType] || null;
    }
    
    getPersonality(personalityName) {
        return this.personalities[personalityName] || null;
    }
}

// ============================================================================
// ENTITY SYSTEM
// ============================================================================

class Entity {
    constructor(x, y, type, engine) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.engine = engine;
        this.attributes = new Map();
        this.sprite = null;
        this.tint = 0xFFFFFF;
        this.zIndex = 1;
    }
    
    // Attribute management
    setAttribute(key, value) {
        this.attributes.set(key, value);
    }
    
    getAttribute(key) {
        return this.attributes.get(key) || false;
    }
    
    hasAttribute(key) {
        return this.attributes.has(key) && this.attributes.get(key);
    }
    
    // Position
    updatePosition(newX, newY) {
        this.x = newX;
        this.y = newY;
        if (this.sprite) {
            this.updateSpritePosition();
        }
    }
    
    updateSpritePosition() {
        // Override in subclasses
    }
    
    // Serialization
    serialize() {
        return {
            x: this.x,
            y: this.y,
            type: this.type,
            attributes: Array.from(this.attributes.entries()),
            tint: this.tint
        };
    }
    
    deserialize(data) {
        this.x = data.x;
        this.y = data.y;
        this.type = data.type;
        this.attributes = new Map(data.attributes);
        this.tint = data.tint;
    }
}

class Item extends Entity {
    constructor(x, y, type, data, engine) {
        super(x, y, type, engine);
        this.name = data.name || type;
        
        // Resolve tile index - support both {x, y} format and string names
        this.tileIndex = engine.spriteLibrary.resolveTile(data.tileIndex) || {x: 0, y: 0};
        this.height = 1;
        
        // Default item attributes
        this.setAttribute('pickupable', true);
        this.setAttribute('visible', true);
        
        // Apply data attributes
        if (data.attributes) {
            Object.entries(data.attributes).forEach(([key, value]) => {
                this.setAttribute(key, value);
            });
        }
    }
    
    use(actor) {
        // Override in item-specific logic
        console.log(`${actor.name} used ${this.name}`);
    }
}

class Actor extends Entity {
    constructor(x, y, type, data, engine) {
        super(x, y, type, engine);
        this.name = data.name || type;
        this.height = 2; // Actors are 2-tile (base + top)
        
        // Resolve tile indices - support both {x, y} format and string names
        this.tileIndexBase = engine.spriteLibrary.resolveTile(data.tileIndexBase) || {x: 0, y: 0};
        this.tileIndexTop = engine.spriteLibrary.resolveTile(data.tileIndexTop) || {x: 0, y: 0};
        
        // Sprite references (will be set by renderer)
        this.spriteBase = null;
        this.spriteTop = null;
        
        // Stats (from prototype config)
        this.stats = {};
        if (engine.currentPrototype && engine.currentPrototype.config.stats) {
            Object.entries(engine.currentPrototype.config.stats).forEach(([stat, config]) => {
                this.stats[stat] = { ...config };
            });
        }
        
        // Inventory
        this.inventory = [];
        this.maxInventory = engine.currentPrototype?.config.inventory?.max_items || 10;
        
        // Personality (for AI actors)
        this.personality = null;
        if (data.personality) {
            this.loadPersonality(data.personality);
        }
        
        // Default actor attributes
        this.setAttribute('solid', true);
        this.setAttribute('visible', true);
        
        // Apply data attributes
        if (data.attributes) {
            Object.entries(data.attributes).forEach(([key, value]) => {
                this.setAttribute(key, value);
            });
        }
        
        this.isDead = false;
    }
    
    loadPersonality(personalityName) {
        const personalityData = this.engine.currentPrototype.getPersonality(personalityName);
        if (personalityData) {
            this.personality = new Personality(personalityData, this);
        }
    }
    
    act() {
        // Turn-based action
        if (this.personality) {
            this.personality.execute(this);
        }
    }
    
    modify(stat, amount) {
        if (this.stats[stat]) {
            this.stats[stat].current -= amount;
            if (this.stats[stat].current <= 0) {
                this.die();
            }
        }
    }
    
    die() {
        this.isDead = true;
        this.setAttribute('solid', false);
        if (this.spriteBase) {
            this.spriteBase.visible = false;
        }
        if (this.spriteTop) {
            this.spriteTop.visible = false;
        }
        if (this.engine.scheduler) {
            this.engine.scheduler.remove(this);
        }
    }
    
    pickUpItem(item) {
        if (this.inventory.length >= this.maxInventory) {
            console.log(`${this.name}'s inventory is full`);
            return false;
        }
        
        this.inventory.push(item);
        this.engine.entityManager.removeEntity(item);
        console.log(`${this.name} picked up ${item.name}`);
        return true;
    }
    
    serialize() {
        return {
            ...super.serialize(),
            stats: this.stats,
            inventory: this.inventory.map(item => item.serialize()),
            personality: this.personality?.name
        };
    }
    
    deserialize(data) {
        super.deserialize(data);
        this.stats = data.stats;
        // Inventory would need to be reconstructed from IDs
        if (data.personality) {
            this.loadPersonality(data.personality);
        }
    }
}

// ============================================================================
// PERSONALITY SYSTEM
// ============================================================================

class Personality {
    constructor(data, actor) {
        this.name = data.name || 'default';
        this.controlled = data.controlled || false;
        this.hostile = data.hostile || false;
        this.behaviors = data.behaviors || [];
        this.data = data;
        this.actor = actor;
    }
    
    execute(actor) {
        // Execute behaviors in order
        for (const behaviorName of this.behaviors) {
            const behavior = BehaviorLibrary[behaviorName];
            if (behavior && behavior(actor, this.data)) {
                break; // Behavior succeeded, stop processing
            }
        }
    }
}

// Behavior Library - Common AI routines
const BehaviorLibrary = {
    patrol: (actor, data) => {
        // Patrol between waypoints
        return false;
    },
    
    pursue_target: (actor, data) => {
        // Find and move toward target
        const target = actor.engine.entityManager.findNearestPlayer(actor);
        if (target && actor.canSeeTarget(target)) {
            actor.moveToward(target.x, target.y);
            return true;
        }
        return false;
    },
    
    random_walk: (actor, data) => {
        // Move randomly
        const directions = [
            {dx: -1, dy: 0}, {dx: 1, dy: 0},
            {dx: 0, dy: -1}, {dx: 0, dy: 1}
        ];
        const dir = directions[Math.floor(Math.random() * directions.length)];
        actor.tryMove(actor.x + dir.dx, actor.y + dir.dy);
        return true;
    },
    
    attack_adjacent: (actor, data) => {
        // Attack if target is adjacent
        const target = actor.engine.entityManager.findAdjacentTarget(actor);
        if (target) {
            actor.attack(target);
            return true;
        }
        return false;
    }
};

// ============================================================================
// ENTITY MANAGER
// ============================================================================

class EntityManager {
    constructor(engine) {
        this.engine = engine;
        this.entities = [];
        this.actors = [];
        this.items = [];
        this.player = null;
    }
    
    async spawnEntities(prototypeConfig) {
        // Process object layers from Tiled map if available
        if (this.engine.mapManager.objectLayers) {
            for (const layer of this.engine.mapManager.objectLayers) {
                if (layer.name === 'actors') {
                    this.spawnActorsFromLayer(layer);
                } else if (layer.name === 'items') {
                    this.spawnItemsFromLayer(layer);
                }
            }
        }
        
        console.log(`Entities spawned: ${this.actors.length} actors, ${this.items.length} items`);
    }
    
    spawnActorsFromLayer(layer) {
        console.log(`Processing actors layer with ${layer.objects.length} objects`);
        
        for (const obj of layer.objects) {
            // Get actor type from Tiled's built-in class property, then type, then name
            let actorType = obj.class || obj.type || obj.name;
            
            // Fallback: Check custom properties for "Type" or "type"
            if (!actorType && obj.properties) {
                const typeProp = obj.properties.find(p => p.name === 'Type' || p.name === 'type');
                if (typeProp) {
                    actorType = typeProp.value;
                }
            }
            
            if (!actorType) {
                console.warn('Object has no class, type, or name, skipping:', obj);
                continue;
            }
            
            // Convert pixel position to tile position
            const tileX = Math.floor(obj.x / this.engine.config.tileWidth);
            const tileY = Math.floor(obj.y / this.engine.config.tileHeight);
            
            // Get actor data from prototype
            const actorData = this.engine.currentPrototype.getActorData(actorType);
            if (!actorData) {
                console.warn(`No actor data found for type '${actorType}'`);
                continue;
            }
            
            // Create and add actor
            const actor = new Actor(tileX, tileY, actorType, actorData, this.engine);
            this.addEntity(actor);
            
            console.log(`Spawned ${actorType} at tile (${tileX}, ${tileY}) from pixel (${obj.x}, ${obj.y})`);
        }
    }
    
    spawnItemsFromLayer(layer) {
        console.log(`Processing items layer with ${layer.objects.length} objects`);
        
        for (const obj of layer.objects) {
            const itemType = obj.type || obj.name;
            if (!itemType) continue;
            
            const tileX = Math.floor(obj.x / this.engine.config.tileWidth);
            const tileY = Math.floor(obj.y / this.engine.config.tileHeight);
            
            const itemData = this.engine.currentPrototype.getItemData(itemType);
            if (!itemData) {
                console.warn(`No item data found for type '${itemType}'`);
                continue;
            }
            
            const item = new Item(tileX, tileY, itemType, itemData, this.engine);
            this.addEntity(item);
            
            console.log(`Spawned ${itemType} at tile (${tileX}, ${tileY})`);
        }
    }
    
    addEntity(entity) {
        this.entities.push(entity);
        
        if (entity instanceof Actor) {
            this.actors.push(entity);
        } else if (entity instanceof Item) {
            this.items.push(entity);
        }
    }
    
    removeEntity(entity) {
        this.entities = this.entities.filter(e => e !== entity);
        this.actors = this.actors.filter(a => a !== entity);
        this.items = this.items.filter(i => i !== entity);
    }
    
    getEntityAt(x, y) {
        return this.entities.find(e => e.x === x && e.y === y);
    }
    
    getActorAt(x, y) {
        return this.actors.find(a => a.x === x && a.y === y);
    }
    
    getItemAt(x, y) {
        return this.items.find(i => i.x === x && i.y === y);
    }
    
    findNearestPlayer(fromActor) {
        // For now, just return the player
        return this.player;
    }
    
    findAdjacentTarget(actor) {
        const dirs = [{dx: -1, dy: 0}, {dx: 1, dy: 0}, {dx: 0, dy: -1}, {dx: 0, dy: 1}];
        for (const dir of dirs) {
            const target = this.getActorAt(actor.x + dir.dx, actor.y + dir.dy);
            if (target && target !== actor && !target.isDead) {
                return target;
            }
        }
        return null;
    }
    
    serializeEntities() {
        return this.entities.map(e => e.serialize());
    }
    
    deserializeEntities(data) {
        // Would need to reconstruct entities from serialized data
    }
    
    cleanup() {
        this.entities.forEach(entity => {
            if (entity instanceof Actor) {
                if (entity.spriteBase) entity.spriteBase.destroy();
                if (entity.spriteTop) entity.spriteTop.destroy();
            } else if (entity.sprite) {
                entity.sprite.destroy();
            }
        });
        this.entities = [];
        this.actors = [];
        this.items = [];
        this.player = null;
    }
}

// ============================================================================
// MAP MANAGER
// ============================================================================

class MapManager {
    constructor(engine) {
        this.engine = engine;
        // Default dimensions (will be updated when map loads)
        this.width = 30;
        this.height = 30;
        
        // Map layers
        this.floorMap = this.createEmptyMap();
        this.wallMap = this.createEmptyMap();
        this.wildcardMap = this.createEmptyMap();
        
        this.walkableTiles = [];
    }
    
    createEmptyMap() {
        return Array.from({length: this.height}, () => 
            Array.from({length: this.width}, () => null)
        );
    }
    
    async loadTiledMap(mapPath) {
        console.log(`Loading Tiled map: ${mapPath}`);
        
        try {
            const response = await fetch(mapPath);
            const tiledData = await response.json();
            
            // Store map dimensions
            this.width = tiledData.width;
            this.height = tiledData.height;
            
            // Store tileset info for converting IDs
            this.tileWidth = tiledData.tilewidth;
            this.tileHeight = tiledData.tileheight;
            
            // Recreate maps with correct dimensions
            this.floorMap = this.createEmptyMap();
            this.wallMap = this.createEmptyMap();
            this.wildcardMap = this.createEmptyMap();
            
            // Store object layers for entity spawning
            this.objectLayers = [];
            
            console.log(`Map dimensions: ${this.width}x${this.height}`);
            
            // Process layers
            for (const layer of tiledData.layers) {
                if (layer.type === 'tilelayer') {
                    if (layer.name === 'floor') {
                        this.processFloorLayer(layer);
                    } else if (layer.name === 'background') {
                        this.processBackgroundLayer(layer);
                    } else if (layer.name === 'wildcards') {
                        this.processWildcardLayer(layer);
                    }
                } else if (layer.type === 'objectgroup') {
                    // Store object layers for later processing
                    this.objectLayers.push(layer);
                }
            }
            
            console.log(`Tiled map loaded successfully`);
            console.log(`Walkable tiles: ${this.walkableTiles.length}`);
            console.log(`Object layers: ${this.objectLayers.length}`);
        } catch (error) {
            console.error('Failed to load Tiled map:', error);
            throw error;
        }
    }
    
    processBackgroundLayer(layer) {
        console.log('Processing background layer...');
        for (let y = 0; y < layer.height; y++) {
            for (let x = 0; x < layer.width; x++) {
                const index = y * layer.width + x;
                const tileId = layer.data[index];
                
                if (tileId > 0) {
                    // Store the tile ID for rendering
                    if (!this.floorMap[y][x]) {
                        this.floorMap[y][x] = { tileId, layer: 'background' };
                    }
                }
            }
        }
    }
    
    processFloorLayer(layer) {
        console.log('Processing floor layer...');
        for (let y = 0; y < layer.height; y++) {
            for (let x = 0; x < layer.width; x++) {
                const index = y * layer.width + x;
                const tileId = layer.data[index];
                
                if (tileId > 0) {
                    // Floor layer takes priority over background
                    this.floorMap[y][x] = { tileId, layer: 'floor' };
                    // Track as walkable
                    this.walkableTiles.push({x, y});
                }
            }
        }
    }
    
    processWildcardLayer(layer) {
        for (let y = 0; y < layer.height; y++) {
            for (let x = 0; x < layer.width; x++) {
                const index = y * layer.width + x;
                const tileId = layer.data[index];
                
                if (tileId > 0) {
                    this.wildcardMap[y][x] = { type: this.getWildcardType(tileId), tileId };
                }
            }
        }
    }
    
    getWildcardType(tileId) {
        // Map tile IDs to wildcard types
        const wildcardTypes = {
            209: 'maze',
            142: 'room',
            143: 'room',
            13: 'item_spawn',
            18: 'actor_spawn'
        };
        return wildcardTypes[tileId] || 'unknown';
    }
    
    generateProceduralMap() {
        console.log('Generating procedural map');
        
        // Use ROT.js for dungeon generation
        const dungeon = new ROT.Map.Uniform(this.width, this.height);
        
        dungeon.create((x, y, value) => {
            if (value === 0) {
                this.floorMap[y][x] = { value: 157 };
                this.walkableTiles.push({x, y});
            }
        });
        
        console.log('Procedural map generated');
    }
    
    async processWildcards() {
        // Process wildcard tiles and replace with generated content
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const wildcard = this.wildcardMap[y][x];
                if (wildcard) {
                    await this.generateWildcardContent(x, y, wildcard.type);
                }
            }
        }
    }
    
    async generateWildcardContent(x, y, type) {
        switch (type) {
            case 'maze':
                this.generateMazeAt(x, y, 10, 10);
                break;
            case 'room':
                this.generateRoomAt(x, y, 5, 5);
                break;
            case 'item_spawn':
                // Spawn random item
                break;
            case 'actor_spawn':
                // Spawn random actor
                break;
        }
    }
    
    generateMazeAt(startX, startY, width, height) {
        const maze = new ROT.Map.Maze(width, height);
        maze.create((x, y, value) => {
            const worldX = startX + x;
            const worldY = startY + y;
            
            if (worldX < this.width && worldY < this.height) {
                if (value === 0) {
                    this.floorMap[worldY][worldX] = { value: 157 };
                    this.walkableTiles.push({x: worldX, y: worldY});
                }
            }
        });
    }
    
    generateRoomAt(startX, startY, width, height) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const worldX = startX + x;
                const worldY = startY + y;
                
                if (worldX < this.width && worldY < this.height) {
                    this.floorMap[worldY][worldX] = { value: 157 };
                    this.walkableTiles.push({x: worldX, y: worldY});
                }
            }
        }
    }
    
    getRandomWalkableTile() {
        if (this.walkableTiles.length === 0) return {x: 0, y: 0};
        return this.walkableTiles[Math.floor(Math.random() * this.walkableTiles.length)];
    }
    
    isWalkable(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
        return this.floorMap[y][x]?.value === 157;
    }
    
    serializeMap() {
        return {
            floorMap: this.floorMap,
            walkableTiles: this.walkableTiles
        };
    }
    
    deserializeMap(data) {
        this.floorMap = data.floorMap;
        this.walkableTiles = data.walkableTiles;
    }
    
    cleanup() {
        this.floorMap = this.createEmptyMap();
        this.wallMap = this.createEmptyMap();
        this.wildcardMap = this.createEmptyMap();
        this.walkableTiles = [];
    }
}

// ============================================================================
// RENDER SYSTEM
// ============================================================================

class RenderSystem {
    constructor(app, mapWidth, mapHeight) {
        this.app = app;
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
        
        // Create rendering containers
        this.backgroundContainer = new PIXI.Container();
        this.floorContainer = new PIXI.Container();
        this.entityContainer = new PIXI.Container();
        this.uiContainer = new PIXI.Container();
        
        this.backgroundContainer.sortableChildren = true;
        this.floorContainer.sortableChildren = true;
        this.entityContainer.sortableChildren = true;
        this.uiContainer.sortableChildren = true;
        
        app.stage.addChild(this.backgroundContainer);
        app.stage.addChild(this.floorContainer);
        app.stage.addChild(this.entityContainer);
        app.stage.addChild(this.uiContainer);
    }
    
    render() {
        // Render loop would update sprites based on entity positions
        console.log('Rendering frame');
    }
    
    renderTestPattern(mapManager) {
        console.log('Rendering Tiled map...');
        
        const tileset = PIXI.Loader.shared.resources.tiles;
        if (!tileset) {
            console.error('Tileset not loaded');
            return;
        }
        
        // Clear existing content
        this.clear();
        
        let tilesRendered = 0;
        
        // Render tiles from the Tiled map
        for (let y = 0; y < mapManager.height; y++) {
            for (let x = 0; x < mapManager.width; x++) {
                const tile = mapManager.floorMap[y][x];
                
                if (tile && tile.tileId > 0) {
                    // Convert Tiled tile ID (1-indexed) to spritesheet coordinates
                    const tileIndex = tile.tileId - 1; // Make 0-indexed
                    const tileX = tileIndex % globalVars.SPRITESHEET_COLS;
                    const tileY = Math.floor(tileIndex / globalVars.SPRITESHEET_COLS);
                    
                    // Create texture from spritesheet coordinates
                    const rect = new PIXI.Rectangle(
                        tileX * globalVars.TILE_WIDTH,
                        tileY * globalVars.TILE_HEIGHT,
                        globalVars.TILE_WIDTH,
                        globalVars.TILE_HEIGHT
                    );
                    
                    const texture = new PIXI.Texture(tileset.texture.baseTexture, rect);
                    const sprite = new PIXI.Sprite(texture);
                    
                    // Position sprite on canvas
                    sprite.x = x * globalVars.TILE_WIDTH;
                    sprite.y = y * globalVars.TILE_HEIGHT;
                    
                    // Add to appropriate layer
                    if (tile.layer === 'background') {
                        this.backgroundContainer.addChild(sprite);
                    } else {
                        this.floorContainer.addChild(sprite);
                    }
                    
                    tilesRendered++;
                }
            }
        }
        
        console.log(`Rendered ${tilesRendered} tiles`);
        console.log(`  Background: ${this.backgroundContainer.children.length} tiles`);
        console.log(`  Floor: ${this.floorContainer.children.length} tiles`);
    }
    
    renderActors(entityManager) {
        console.log('Rendering actors...');
        
        const tileset = PIXI.Loader.shared.resources.tiles;
        if (!tileset) {
            console.error('Tileset not loaded');
            return;
        }
        
        let actorsRendered = 0;
        
        // Render all actors
        for (const actor of entityManager.actors) {
            if (!actor.hasAttribute('visible')) continue;
            
            // Render base tile (legs)
            const baseRect = new PIXI.Rectangle(
                actor.tileIndexBase.x * globalVars.TILE_WIDTH,
                actor.tileIndexBase.y * globalVars.TILE_HEIGHT,
                globalVars.TILE_WIDTH,
                globalVars.TILE_HEIGHT
            );
            const baseTexture = new PIXI.Texture(tileset.texture.baseTexture, baseRect);
            const baseSprite = new PIXI.Sprite(baseTexture);
            
            baseSprite.x = actor.x * globalVars.TILE_WIDTH;
            baseSprite.y = actor.y * globalVars.TILE_HEIGHT;
            baseSprite.zIndex = 10; // Above floor tiles
            
            this.entityContainer.addChild(baseSprite);
            
            // Render top tile (skull/head) - one tile above
            const topRect = new PIXI.Rectangle(
                actor.tileIndexTop.x * globalVars.TILE_WIDTH,
                actor.tileIndexTop.y * globalVars.TILE_HEIGHT,
                globalVars.TILE_WIDTH,
                globalVars.TILE_HEIGHT
            );
            const topTexture = new PIXI.Texture(tileset.texture.baseTexture, topRect);
            const topSprite = new PIXI.Sprite(topTexture);
            
            topSprite.x = actor.x * globalVars.TILE_WIDTH;
            topSprite.y = (actor.y - 1) * globalVars.TILE_HEIGHT; // One tile above
            topSprite.zIndex = 11; // Above base tile
            
            this.entityContainer.addChild(topSprite);
            
            // Store sprite references on the actor
            actor.spriteBase = baseSprite;
            actor.spriteTop = topSprite;
            
            actorsRendered++;
        }
        
        console.log(`Rendered ${actorsRendered} actors`);
    }
    
    clear() {
        this.backgroundContainer.removeChildren();
        this.floorContainer.removeChildren();
        this.entityContainer.removeChildren();
        this.uiContainer.removeChildren();
    }
}

// ============================================================================
// AUDIO MANAGER
// ============================================================================

class AudioManager {
    constructor(audioSpriteData) {
        this.audioSpriteData = audioSpriteData;
        this.sound = null;
        if (audioSpriteData) {
            this.initHowler();
        }
    }
    
    initHowler() {
        try {
            // Construct audio file paths from sprite data
            const basePath = './assets/audio/effects';
            const formats = ['ac3', 'm4a', 'mp3', 'ogg'];
            const urls = formats.map(ext => `${basePath}.${ext}`);
            
            this.sound = new Howl({
                src: urls,
                sprite: this.audioSpriteData.sprite,
                volume: 1
            });
        } catch (error) {
            console.error('Failed to initialize Howler:', error);
            this.sound = null;
        }
    }
    
    play(soundName) {
        if (this.sound) {
            try {
                this.sound.play(soundName);
            } catch (error) {
                console.warn(`Failed to play sound '${soundName}':`, error);
            }
        }
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

let engine = null;

async function initializeGame() {
    const gameContainer = document.getElementById('game');
    
    try {
        console.log('Starting game initialization...');
        
        // Clear any existing content
        gameContainer.innerHTML = '<p>Loading game...</p>';
        
        engine = new DungeonEngine();
        await engine.initialize();
        
        // Load first prototype (could be from URL param or config)
        const firstPrototype = 'default'; // or get from URL: new URLSearchParams(window.location.search).get('prototype')
        await engine.loadPrototype(firstPrototype);
        
        console.log('Game initialized successfully');
    } catch (error) {
        console.error('Failed to initialize game:', error);
        gameContainer.innerHTML = `
            <div style="color: red; padding: 20px; font-family: monospace;">
                <h2>Failed to Initialize Game</h2>
                <p><strong>Error:</strong> ${error.message}</p>
                <pre style="background: #f5f5f5; padding: 10px; overflow: auto;">${error.stack}</pre>
                <button onclick="initializeGame()" style="margin-top: 10px; padding: 10px 20px; cursor: pointer;">
                    Try Again
                </button>
            </div>
        `;
    }
}

// Manual initialization - uncomment to enable auto-start
// if (document.readyState === 'loading') {
//     document.addEventListener('DOMContentLoaded', initializeGame);
// } else {
//     initializeGame();
// }

// For debugging: expose initialization function to console
window.initializeGame = initializeGame;
console.log('ðŸŽ® Dungeon Mode Kit loaded. Call initializeGame() to start.');