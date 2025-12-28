/**
 * Dungeon Mode Kit - Core Engine
 * A modular roguelike engine supporting multiple prototypes with mixed authored/procedural content, built on rot.js and pixi.js
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
                'smoke': 'smoke',
                'fluid': 'fluid'
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
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Parse a tint value from various formats
 * @param {number|string|undefined} value - Tint value as number, hex string ("#FF0000"), or undefined
 * @param {number} defaultValue - Default tint if value is undefined (default: 0xFFFFFF white)
 * @returns {number} Parsed tint as integer
 */
function parseTint(value, defaultValue = 0xFFFFFF) {
    if (value === undefined || value === null) {
        return defaultValue;
    }

    if (typeof value === 'number') {
        return value;
    }

    if (typeof value === 'string') {
        // Remove # prefix if present
        let hex = value.startsWith('#') ? value.slice(1) : value;
        // Parse as hexadecimal
        const parsed = parseInt(hex, 16);
        if (!isNaN(parsed)) {
            return parsed;
        }
    }

    console.warn('Invalid tint value:', value);
    return defaultValue;
}

function generateColorVariation(baseColor, variation = 0x101008) {
    const r = (baseColor >> 16) & 0xFF;
    const g = (baseColor >> 8) & 0xFF;
    const b = baseColor & 0xFF;

    const vr = (variation >> 16) & 0xFF;
    const vg = (variation >> 8) & 0xFF;
    const vb = variation & 0xFF;

    return {
        lighter: ((Math.min(255, r + vr) << 16) | (Math.min(255, g + vg) << 8) | Math.min(255, b + vb)),
        darker: ((Math.max(0, r - vr) << 16) | (Math.max(0, g - vg) << 8) | Math.max(0, b - vb * 0.5))
    };
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
        this.inputManager = null;
        this.lightingManager = null;
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
        await this.loadGlobalData();
        this.setupEventListeners();
        
        console.log('Engine initialized (renderer will be created when map loads)');
    }
    
    async loadGlobalData() {
        try {
            // Load global entity definitions
            const [actorsRes, itemsRes, personalitiesRes] = await Promise.all([
                fetch('./data/actors.json'),
                fetch('./data/items.json'),
                fetch('./data/personalities.json')
            ]);
            
            this.globalActors = await actorsRes.json();
            this.globalItems = await itemsRes.json();
            this.globalPersonalities = await personalitiesRes.json();
            
            console.log('Global data loaded:', {
                actors: Object.keys(this.globalActors).length,
                items: Object.keys(this.globalItems).length,
                personalities: Object.keys(this.globalPersonalities).length
            });
        } catch (error) {
            console.error('Failed to load global data:', error);
            // Set defaults so the game can still run
            this.globalActors = {};
            this.globalItems = {};
            this.globalPersonalities = {};
        }
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
            this.renderer = new RenderSystem(this.app, this.mapManager.width, this.mapManager.height, this);
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
                        .add('fluid', './assets/sprites/fluid-animation.png')
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
        this.animationFrames = {};

        // Define animation sources - frame count calculated from texture width
        const animations = ['fire', 'smoke', 'fluid'];

        for (const name of animations) {
            this.animationFrames[name] = [];
            const baseTexture = PIXI.Loader.shared.resources[name].texture.baseTexture;
            const frameCount = Math.floor(baseTexture.width / globalVars.TILE_WIDTH);

            for (let i = 0; i < frameCount; i++) {
                let rect = new PIXI.Rectangle(i * globalVars.TILE_WIDTH, 0, globalVars.TILE_WIDTH, globalVars.TILE_HEIGHT);
                this.animationFrames[name].push(new PIXI.Texture(baseTexture, rect));
            }
        }
    }
    
    setupEventListeners() {
        createjs.Ticker.framerate = 60;
        createjs.Ticker.addEventListener("tick", createjs.Tween);

        // Initialize input handling
        this.inputManager = new InputManager(this);

        console.log('Event listeners initialized');
    }

    /**
     * Initialize the turn-based engine using ROT.js
     * Uses Simple scheduler - all actors get one turn per round
     */
    initializeTurnEngine() {
        this.scheduler = new ROT.Scheduler.Simple();
        this.turnEngine = new ROT.Engine(this.scheduler);

        // Track if there are any player-controlled actors
        this.hasControlledActor = false;

        // Only schedule actors that take turns (have personality or are player-controlled)
        for (const actor of this.entityManager.actors) {
            if (actor.personality || actor.hasAttribute('controlled')) {
                this.scheduler.add(actor, true);
                if (actor.hasAttribute('controlled')) {
                    this.hasControlledActor = true;
                }
            }
        }

        // Get turn speed from prototype config (default 50ms)
        this.turnSpeed = this.currentPrototype?.config.turn_speed ?? 50;

        // Observer mode state (for play/pause when no controlled actors)
        this.observerPaused = false;

        console.log(`Turn engine initialized with ${this.scheduler._queue._events.length} scheduled actors`);
        console.log(`Observer mode: ${!this.hasControlledActor}, turn speed: ${this.turnSpeed}ms`);

        // Start the engine
        this.turnEngine.start();

        // In observer mode, start auto-advancing turns
        if (!this.hasControlledActor) {
            this.advanceObserverTurn();
        }
    }

    /**
     * Advance one turn in observer mode (no player-controlled actors)
     */
    advanceObserverTurn() {
        if (this.observerPaused || this.hasControlledActor) return;

        // Unlock to let one round of AI turns happen
        this.turnEngine.unlock();

        // Schedule next turn after delay
        setTimeout(() => this.advanceObserverTurn(), this.turnSpeed);
    }

    /**
     * Toggle play/pause in observer mode
     */
    toggleObserverPause() {
        if (this.hasControlledActor) return;

        this.observerPaused = !this.observerPaused;
        console.log(`Observer mode ${this.observerPaused ? 'paused' : 'playing'}`);

        if (!this.observerPaused) {
            this.advanceObserverTurn();
        }
    }

    /**
     * Called when a controlled actor dies - transition to observer mode
     */
    onControlledActorDied() {
        console.log('Controlled actor died - transitioning to observer mode');
        this.hasControlledActor = false;

        // Unlock the engine (it was locked waiting for player input)
        if (this.turnEngine) {
            this.turnEngine.unlock();
        }

        // Check if there are any actors with behaviors still in the scheduler
        const hasActorsWithBehaviors = this.entityManager.actors.some(
            actor => !actor.isDead && actor.personality
        );

        if (hasActorsWithBehaviors) {
            // Start observer mode auto-advance
            this.observerPaused = false;
            setTimeout(() => this.advanceObserverTurn(), this.turnSpeed);
        } else {
            console.log('No actors with behaviors remaining - game over');
            // Could trigger a game over state here
        }
    }

    /**
     * Reload the current prototype or load a different one
     * @param {string} [newPrototypeName] - Optional name of prototype to load (defaults to current)
     */
    async reloadPrototype(newPrototypeName) {
        const prototypeName = newPrototypeName || this.currentPrototype?.name || 'default';
        console.log(`Reloading prototype: ${prototypeName}`);
        this.cleanup();
        await this.loadPrototype(prototypeName);
    }

    updateLighting() {
        if (!this.lightingManager) return;

        this.lightingManager.computeLighting();
        const fogOfWar = this.currentPrototype?.config.mechanics?.fog_of_war || false;
        this.renderer.updateDarkness(this.lightingManager, fogOfWar);
    }

    // Audio helper methods
    playSound(soundName) {
        if (this.audioManager) {
            this.audioManager.play(soundName);
        }
    }
    
    stopSound(soundName) {
        if (this.audioManager) {
            this.audioManager.stop(soundName);
        }
    }
    
    muteAudio() {
        if (this.audioManager) {
            this.audioManager.mute();
        }
    }
    
    unmuteAudio() {
        if (this.audioManager) {
            this.audioManager.unmute();
        }
    }
    
    setAudioVolume(volume) {
        if (this.audioManager) {
            this.audioManager.setVolume(volume);
        }
    }
    
    listAvailableSounds() {
        if (this.audioManager) {
            return this.audioManager.listSounds();
        }
        return [];
    }
    
    async loadPrototype(prototypeName, entryDirection = null) {
        console.log(`Loading prototype: ${prototypeName}, entry: ${entryDirection || 'direct'}`);
        const prototypeConfig = await this.loadPrototypeConfig(prototypeName);
        this.currentPrototype = new Prototype(prototypeName, prototypeConfig, this);
        await this.currentPrototype.loadAssets();
        this.mapManager = new MapManager(this);
        const hasAuthoredMap = await this.checkForAuthoredMap(prototypeName);

        // Load authored map or generate procedural map
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

        // Spawn entities from Tiled object layers (but skip player if we'll spawn at stairway)
        await this.entityManager.spawnEntities(this.currentPrototype.config, entryDirection);

        // Process wildcards (spawns actors for fire, sewage, wall tiles, etc.)
        await this.mapManager.processWildcards();

        // Spawn player at appropriate stairway based on entry direction
        this.spawnPlayerAtStairway(entryDirection);

        // Spawn any actors created by wildcard/labyrinth processing (e.g., room walls, dungeon doors)
        this.mapManager.spawnPendingWalls();
        this.mapManager.spawnPendingDoors();

        // Add diagonal shadows beneath floor tiles (only when darkness is disabled)
        if (!prototypeConfig.mechanics?.darkness) {
            this.mapManager.addBaseAndShadows();
        }

        // Render the map and entities
        this.renderer.renderTestPattern(this.mapManager);
        this.renderer.renderItems(this.entityManager);
        this.renderer.renderActors(this.entityManager);

        // Initialize lighting system if darkness is enabled
        if (prototypeConfig.mechanics?.darkness) {
            this.lightingManager = new LightingManager(this);
            this.lightingManager.initialize(
                this.mapManager.width,
                this.mapManager.height,
                prototypeConfig.mechanics
            );
            this.renderer.initializeDarkness(this.mapManager.width, this.mapManager.height);
            this.updateLighting();
        }

        // Initialize turn engine
        this.initializeTurnEngine();

        // Play loaded sound if specified
        if (prototypeConfig.loaded_sound) {
            this.playSound(prototypeConfig.loaded_sound);
        }

        console.log(`Prototype ${prototypeName} loaded successfully`);
        console.log(`Map size: ${this.mapManager.width}x${this.mapManager.height} tiles`);
        console.log(`Canvas size: ${this.canvasWidth}x${this.canvasHeight}px`);
        console.log(`Walkable tiles: ${this.mapManager.walkableTiles.length}`);
        console.log(`Actors spawned: ${this.entityManager.actors.length}`);
        console.log(`Items spawned: ${this.entityManager.items.length}`);
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
                turn_based: true
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
    
    transitionToPrototype(prototypeName, saveState = true, entryDirection = null) {
        if (saveState) {
            this.prototypeStack.push({
                name: this.currentPrototype.name,
                state: this.saveGameState()
            });
        }

        this.cleanup();
        this.loadPrototype(prototypeName, entryDirection);
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

    /**
     * Use a stairway to transition to another level
     * @param {string} direction - 'up' or 'down'
     */
    useStairway(direction) {
        const config = this.currentPrototype.config;
        let targetLevel = null;

        if (direction === 'down' && config.next_level) {
            targetLevel = config.next_level;
        } else if (direction === 'up' && config.previous_level) {
            targetLevel = config.previous_level;
        }

        if (targetLevel) {
            console.log(`Using stairway ${direction} to ${targetLevel}`);
            this.playSound('levelout');
            // Pass entry direction: descending means entering from above, ascending means entering from below
            const entryDirection = direction === 'down' ? 'from_above' : 'from_below';
            this.transitionToPrototype(targetLevel, true, entryDirection);
        } else {
            console.log(`No ${direction === 'down' ? 'next' : 'previous'} level configured`);
        }
    }

    /**
     * Spawn the player at the appropriate stairway based on entry direction
     * @param {string|null} entryDirection - 'from_above', 'from_below', or null for direct load
     */
    spawnPlayerAtStairway(entryDirection) {
        // If player was already spawned from the map, don't spawn another
        if (this.entityManager.player) {
            console.log('Player already exists from map, skipping stairway spawn');
            return;
        }

        // Determine which stairway to spawn at
        // from_above (descended) = spawn at up_stairway (the stairs leading back up)
        // from_below (ascended) = spawn at down_stairway (the stairs leading back down)
        // direct load = spawn at up_stairway if it exists
        let targetStairwayType;
        if (entryDirection === 'from_above') {
            targetStairwayType = 'up';
        } else if (entryDirection === 'from_below') {
            targetStairwayType = 'down';
        } else {
            // Direct load - try up_stairway first
            targetStairwayType = 'up';
        }

        // Find the stairway actor
        const stairway = this.entityManager.findActorByAttribute('stairway', targetStairwayType);

        if (stairway) {
            console.log(`Spawning player at ${targetStairwayType} stairway (${stairway.x}, ${stairway.y})`);
            const playerData = this.currentPrototype.getActorData('player');
            if (playerData) {
                const player = new Actor(stairway.x, stairway.y, 'player', playerData, this);
                this.entityManager.addEntity(player);
            } else {
                console.error('No player actor data found in prototype');
            }
        } else if (entryDirection === null) {
            // Direct load with no up stairway - player should be in the map
            console.log('No up stairway found, expecting player to be placed in map');
        } else {
            console.warn(`No ${targetStairwayType} stairway found to spawn player at`);
        }
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

        // Destroy the PIXI application and remove the canvas
        if (this.app) {
            this.app.destroy(true, { children: true, texture: false, baseTexture: false });
            this.app = null;
            this.renderer = null;
        }

        // Clear lighting manager
        if (this.lightingManager) {
            this.lightingManager = null;
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
        // Load prototype-specific overrides
        const prototypeActors = await this.loadJSON('actors.json', {});
        const prototypeItems = await this.loadJSON('items.json', {});
        const prototypePersonalities = await this.loadJSON('personalities.json', {});
        
        // Merge with globals (prototype overrides global)
        this.actors = { ...this.engine.globalActors, ...prototypeActors };
        this.items = { ...this.engine.globalItems, ...prototypeItems };
        this.personalities = { ...this.engine.globalPersonalities, ...prototypePersonalities };
        
        console.log(`Loaded assets for prototype: ${this.name}`);
        console.log(`  Actors: ${Object.keys(this.actors).length} (${Object.keys(prototypeActors).length} prototype-specific)`);
        console.log(`  Items: ${Object.keys(this.items).length} (${Object.keys(prototypeItems).length} prototype-specific)`);
        console.log(`  Personalities: ${Object.keys(this.personalities).length} (${Object.keys(prototypePersonalities).length} prototype-specific)`);
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
        if (!this.attributes.has(key)) return undefined;
        return this.attributes.get(key);
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

        // Load tint value (supports number or "#RRGGBB" string format)
        this.tint = parseTint(data.tint);

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

        // Load tint value (supports number or "#RRGGBB" string format)
        this.tint = parseTint(data.tint);
        this.flickerTint = data.flickerTint || false;

        // Vision range for FOV calculation
        this.visionRange = data.vision_range ?? 8;

        // Base tile - can be static (tileIndexBase) or animated (animationBase)
        this.tileIndexBase = engine.spriteLibrary.resolveTile(data.tileIndexBase) || null;
        this.animationBase = data.animationBase || null;

        // Top tile - can be static (tileIndexTop) or animated (animationTop)
        this.tileIndexTop = engine.spriteLibrary.resolveTile(data.tileIndexTop) || null;
        this.animationTop = data.animationTop || null;

        // Legacy support: if 'animated' is true with 'animation_frames', treat as animationBase
        if (data.animated && data.animation_frames) {
            this.animationBase = data.animation_frames;
        }

        // Flip properties for base and top sprites
        this.flipBaseH = data.flipBaseH || false;
        this.flipBaseV = data.flipBaseV || false;
        this.flipTopH = data.flipTopH || false;
        this.flipTopV = data.flipTopV || false;

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
        
        // Inventory - uses the 'inventory' attribute to determine max capacity
        // If no inventory attribute, actor cannot pick up items
        this.inventory = [];
        
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

        // State for openable/interactive actors (doors, chests, etc.)
        this.state = data.state ? { ...data.state } : null;

        // Store alternate tile indices for state changes
        this.tileIndexBase_open = engine.spriteLibrary.resolveTile(data.tileIndexBase_open) || null;
        this.tileIndexTop_open = engine.spriteLibrary.resolveTile(data.tileIndexTop_open) || null;

        this.isDead = false;
    }

    open() {
        if (!this.hasAttribute('openable') || !this.state) return;
        if (this.state.locked) {
            console.log(`${this.name} is locked`);
            return;
        }

        this.state.open = true;
        this.setAttribute('solid', false);

        if (this.tileIndexBase_open && this.spriteBase) {
            const tileset = PIXI.Loader.shared.resources.tiles;
            const rect = new PIXI.Rectangle(
                this.tileIndexBase_open.x * globalVars.TILE_WIDTH,
                this.tileIndexBase_open.y * globalVars.TILE_HEIGHT,
                globalVars.TILE_WIDTH,
                globalVars.TILE_HEIGHT
            );
            this.spriteBase.texture = new PIXI.Texture(tileset.texture.baseTexture, rect);
        }

        if (this.tileIndexTop_open && this.spriteTop) {
            const tileset = PIXI.Loader.shared.resources.tiles;
            const rect = new PIXI.Rectangle(
                this.tileIndexTop_open.x * globalVars.TILE_WIDTH,
                this.tileIndexTop_open.y * globalVars.TILE_HEIGHT,
                globalVars.TILE_WIDTH,
                globalVars.TILE_HEIGHT
            );
            this.spriteTop.texture = new PIXI.Texture(tileset.texture.baseTexture, rect);
        }

        console.log(`${this.name} opened`);
    }

    close() {
        if (!this.hasAttribute('openable') || !this.state) return;

        this.state.open = false;
        this.setAttribute('solid', true);

        if (this.tileIndexBase && this.spriteBase) {
            const tileset = PIXI.Loader.shared.resources.tiles;
            const rect = new PIXI.Rectangle(
                this.tileIndexBase.x * globalVars.TILE_WIDTH,
                this.tileIndexBase.y * globalVars.TILE_HEIGHT,
                globalVars.TILE_WIDTH,
                globalVars.TILE_HEIGHT
            );
            this.spriteBase.texture = new PIXI.Texture(tileset.texture.baseTexture, rect);
        }

        if (this.tileIndexTop && this.spriteTop) {
            const tileset = PIXI.Loader.shared.resources.tiles;
            const rect = new PIXI.Rectangle(
                this.tileIndexTop.x * globalVars.TILE_WIDTH,
                this.tileIndexTop.y * globalVars.TILE_HEIGHT,
                globalVars.TILE_WIDTH,
                globalVars.TILE_HEIGHT
            );
            this.spriteTop.texture = new PIXI.Texture(tileset.texture.baseTexture, rect);
        }

        console.log(`${this.name} closed`);
    }
    
    loadPersonality(personalityName) {
        const personalityData = this.engine.currentPrototype.getPersonality(personalityName);
        if (personalityData) {
            this.personality = new Personality(personalityData, this);
        }
    }
    
    /**
     * Execute turn-based action (called by ROT.Engine)
     * @returns {Promise} Resolves when action is complete
     */
    act() {
        // Player-controlled actors lock the engine and wait for input
        if (this.hasAttribute('controlled')) {
            this.engine.turnEngine.lock();
            return Promise.resolve();
        }

        // AI actors execute their personality behaviors
        if (this.personality) {
            this.personality.execute(this);
        }

        // In observer mode, lock after each AI turn to allow paced playback
        if (!this.engine.hasControlledActor) {
            this.engine.turnEngine.lock();
        }

        return Promise.resolve();
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

        // If this was the controlled actor, transition to observer mode
        if (this.hasAttribute('controlled')) {
            this.engine.onControlledActorDied();
        }
    }
    
    pickUpItem(item) {
        // Check if actor has inventory capacity (inventory attribute)
        const maxInventory = this.getAttribute('inventory');
        if (maxInventory === undefined || maxInventory <= 0) {
            // Actor cannot carry items
            return false;
        }

        if (this.inventory.length >= maxInventory) {
            console.log(`${this.name}'s inventory is full`);
            return false;
        }

        this.inventory.push(item);
        this.engine.entityManager.removeEntity(item);
        console.log(`${this.name} picked up ${item.name}`);
        return true;
    }

    /**
     * Check if a tile has a floor (is not a void/pit)
     */
    hasFloorAt(x, y) {
        if (x < 0 || x >= this.engine.mapManager.width ||
            y < 0 || y >= this.engine.mapManager.height) {
            return false;
        }
        const tile = this.engine.mapManager.floorMap[y][x];
        return tile && tile.tileId;
    }

    /**
     * Get valid movement directions for sighted actors
     * Filters out directions that would lead to void tiles or blocking actors
     */
    getValidMoveDirections() {
        const allDirections = [
            {dx: -1, dy: 0}, {dx: 1, dy: 0},
            {dx: 0, dy: -1}, {dx: 0, dy: 1}
        ];

        return allDirections.filter(dir => {
            const newX = this.x + dir.dx;
            const newY = this.y + dir.dy;

            // Check bounds
            if (newX < 0 || newX >= this.engine.mapManager.width ||
                newY < 0 || newY >= this.engine.mapManager.height) {
                return false;
            }

            // Check for blocking actors
            const actorAtTarget = this.engine.entityManager.getActorAt(newX, newY);
            if (actorAtTarget && actorAtTarget.hasAttribute('solid')) {
                return false;
            }

            // Check for floor tile
            if (!this.hasFloorAt(newX, newY)) {
                return false;
            }

            return true;
        });
    }

    /**
     * Called when actor falls into a void tile
     */
    fall() {
        console.log(`${this.name} fell into the void!`);
        this.die();
    }

    // Movement methods
    tryMove(newX, newY) {
        // Check bounds
        if (newX < 0 || newX >= this.engine.mapManager.width ||
            newY < 0 || newY >= this.engine.mapManager.height) {
            return false;
        }

        // Check for blocking actors
        const actorAtTarget = this.engine.entityManager.getActorAt(newX, newY);
        if (actorAtTarget && actorAtTarget.hasAttribute('solid')) {
            if (actorAtTarget.hasAttribute('openable') && !actorAtTarget.state?.open) {
                actorAtTarget.open();
                this.engine.updateLighting();
                return false;
            }
            console.log(`${this.name} blocked by ${actorAtTarget.name}`);
            return false;
        }

        // Check for floor tile - if no floor, actor falls
        if (!this.hasFloorAt(newX, newY)) {
            // Move to the void tile first (so we can see them fall)
            this.x = newX;
            this.y = newY;
            this.updateSpritePosition();
            this.fall();
            return true; // Move happened, actor just died
        }

        // Move successful
        this.x = newX;
        this.y = newY;
        this.updateSpritePosition();

        // Check for items to pick up
        const itemAtTarget = this.engine.entityManager.getItemAt(newX, newY);
        if (itemAtTarget && itemAtTarget.hasAttribute('pickupable')) {
            this.pickUpItem(itemAtTarget);
        }

        // Check for stairway actors (only for player-controlled actors)
        if (this.hasAttribute('controlled')) {
            const stairway = this.engine.entityManager.getOtherActorAt(newX, newY, this);
            if (stairway && stairway.hasAttribute('stairway')) {
                const direction = stairway.getAttribute('stairway');
                this.engine.useStairway(direction);
            }
        }

        // Update lighting if this actor affects it
        if (this.hasAttribute('controlled') || this.hasAttribute('light_source')) {
            this.engine.updateLighting();
        }

        return true;
    }

    moveBy(dx, dy) {
        return this.tryMove(this.x + dx, this.y + dy);
    }

    updateSpritePosition() {
        if (this.spriteBase) {
            this.spriteBase.x = this.x * globalVars.TILE_WIDTH;
            this.spriteBase.y = this.y * globalVars.TILE_HEIGHT;
        }
        if (this.spriteTop) {
            this.spriteTop.x = this.x * globalVars.TILE_WIDTH;
            this.spriteTop.y = (this.y - 1) * globalVars.TILE_HEIGHT;
        }
    }

    /**
     * Check if this actor can see the target (simple distance check)
     * @param {Entity} target - The target to check visibility for
     * @returns {boolean} True if target is within vision range
     */
    canSeeTarget(target) {
        if (!target) return false;
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= this.visionRange;
    }

    /**
     * Move toward a target position
     * @param {number} targetX - Target X coordinate
     * @param {number} targetY - Target Y coordinate
     */
    moveToward(targetX, targetY) {
        const dx = Math.sign(targetX - this.x);
        const dy = Math.sign(targetY - this.y);

        // Try to move in both directions, prefer the larger distance
        if (Math.abs(targetX - this.x) > Math.abs(targetY - this.y)) {
            if (dx !== 0 && this.tryMove(this.x + dx, this.y)) return;
            if (dy !== 0 && this.tryMove(this.x, this.y + dy)) return;
        } else {
            if (dy !== 0 && this.tryMove(this.x, this.y + dy)) return;
            if (dx !== 0 && this.tryMove(this.x + dx, this.y)) return;
        }
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
    
    random_walk: (actor) => {
        // Sighted actors only consider valid moves (avoids pits, walls, etc.)
        if (actor.hasAttribute('sighted')) {
            const validDirs = actor.getValidMoveDirections();
            if (validDirs.length === 0) {
                return false; // No valid moves available
            }
            const dir = validDirs[Math.floor(Math.random() * validDirs.length)];
            actor.tryMove(actor.x + dir.dx, actor.y + dir.dy);
            return true;
        }

        // Non-sighted actors pick randomly (may fall into pits)
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
    
    async spawnEntities(prototypeConfig, entryDirection = null) {
        // Process object layers from Tiled map if available
        if (this.engine.mapManager.objectLayers) {
            for (const layer of this.engine.mapManager.objectLayers) {
                if (layer.name === 'actors') {
                    this.spawnActorsFromLayer(layer, entryDirection);
                } else if (layer.name === 'items') {
                    this.spawnItemsFromLayer(layer);
                }
            }
        }

        console.log(`Entities spawned: ${this.actors.length} actors, ${this.items.length} items`);
    }
    
    spawnActorsFromLayer(layer, entryDirection = null) {
        console.log(`Processing actors layer with ${layer.objects.length} objects`);

        for (const obj of layer.objects) {
            // Get actor type from Tiled's class property (newer) or type property (older), then name as fallback
            let actorType = obj.class || obj.type || obj.name;

            if (!actorType) {
                console.warn('Object has no class, type, or name, skipping:', obj);
                continue;
            }

            // Skip player actors when entering via stairway (player will be spawned at stairway)
            if (entryDirection && actorType === 'player') {
                console.log('Skipping player spawn from map (will spawn at stairway)');
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
            // Get item type from Tiled's class property (newer) or type property (older), then name as fallback
            const itemType = obj.class || obj.type || obj.name;
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
            // Track player if this actor has the controlled attribute
            if (entity.hasAttribute('controlled')) {
                this.player = entity;
                console.log(`Player set: ${entity.name} at (${entity.x}, ${entity.y})`);
            }
        } else if (entity instanceof Item) {
            this.items.push(entity);
        }
    }
    
    removeEntity(entity) {
        // Remove from arrays
        this.entities = this.entities.filter(e => e !== entity);
        this.actors = this.actors.filter(a => a !== entity);
        this.items = this.items.filter(i => i !== entity);

        // Clean up sprites
        if (entity.spriteBase) {
            entity.spriteBase.destroy();
            entity.spriteBase = null;
        }
        if (entity.spriteTop) {
            entity.spriteTop.destroy();
            entity.spriteTop = null;
        }
        if (entity.sprite) {
            entity.sprite.destroy();
            entity.sprite = null;
        }
    }
    
    getEntityAt(x, y) {
        return this.entities.find(e => e.x === x && e.y === y);
    }
    
    getActorAt(x, y) {
        return this.actors.find(a => a.x === x && a.y === y);
    }

    getOtherActorAt(x, y, excludeActor) {
        return this.actors.find(a => a.x === x && a.y === y && a !== excludeActor);
    }

    getItemAt(x, y) {
        return this.items.find(i => i.x === x && i.y === y);
    }

    findActorByAttribute(attributeName, attributeValue) {
        return this.actors.find(a => a.getAttribute(attributeName) === attributeValue);
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
        this.backgroundMap = this.createEmptyMap();
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

    /**
     * Get a map layer by name
     * @param {string} layerName - 'background', 'floor', 'wall', or 'wildcard'
     * @returns {Array|null} The 2D map array or null if invalid
     */
    getLayer(layerName) {
        const layers = {
            'background': this.backgroundMap,
            'floor': this.floorMap,
            'wall': this.wallMap,
            'wildcard': this.wildcardMap
        };
        return layers[layerName] || null;
    }

    /**
     * Get tile ID at position on a layer
     * @param {string} layerName - Layer to query
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {number|null} Tile ID or null if empty/out of bounds
     */
    getTile(layerName, x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return null;
        }
        const layer = this.getLayer(layerName);
        if (!layer) return null;

        const tile = layer[y][x];
        return tile ? tile.tileId : null;
    }

    /**
     * Set tile ID at position on a layer
     * @param {string} layerName - Layer to modify
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number|null} tileId - Tile ID to set, or null to clear
     */
    setTile(layerName, x, y, tileId) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return;
        }
        const layer = this.getLayer(layerName);
        if (!layer) return;

        if (tileId === null) {
            layer[y][x] = null;
        } else {
            layer[y][x] = { tileId, layer: layerName };
        }
    }

    /**
     * Get neighboring tile IDs (8-directional)
     * @param {string} layerName - Layer to query
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {Object} Object with n, s, e, w, ne, nw, se, sw tile IDs (null if empty/OOB)
     */
    getNeighbors(layerName, x, y) {
        return {
            n:  this.getTile(layerName, x, y - 1),
            s:  this.getTile(layerName, x, y + 1),
            e:  this.getTile(layerName, x + 1, y),
            w:  this.getTile(layerName, x - 1, y),
            ne: this.getTile(layerName, x + 1, y - 1),
            nw: this.getTile(layerName, x - 1, y - 1),
            se: this.getTile(layerName, x + 1, y + 1),
            sw: this.getTile(layerName, x - 1, y + 1)
        };
    }

    /**
     * Iterate over all tiles in a layer
     * @param {string} layerName - Layer to iterate
     * @param {Function} callback - Called with (x, y, tileId) for each tile
     * @param {boolean} includeEmpty - If true, calls callback for empty tiles too (default false)
     */
    forEach(layerName, callback, includeEmpty = false) {
        const layer = this.getLayer(layerName);
        if (!layer) return;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const tile = layer[y][x];
                const tileId = tile ? tile.tileId : null;

                if (includeEmpty || tileId !== null) {
                    callback(x, y, tileId);
                }
            }
        }
    }
    
    async loadTiledMap(mapPath, options = {}) {
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
            this.backgroundMap = this.createEmptyMap();
            this.floorMap = this.createEmptyMap();
            this.wallMap = this.createEmptyMap();
            this.wildcardMap = this.createEmptyMap();

            // Store object layers for entity spawning
            this.objectLayers = [];

            console.log(`Map dimensions: ${this.width}x${this.height}`);

            // Process layers
            for (const layer of tiledData.layers) {
                if (layer.type === 'tilelayer') {
                    if (layer.name === 'floor' && !options.skipFloorLayer) {
                        this.processFloorLayer(layer);
                    } else if (layer.name === 'background') {
                        this.processBackgroundLayer(layer);
                    } else if (layer.name === 'wildcards' && !options.skipFloorLayer) {
                        // Skip wildcards too when skipping floor (labyrinth mode)
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
                    this.backgroundMap[y][x] = { tileId, layer: 'background' };
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
                    // Floor layer takes priority - clear background behind it
                    this.floorMap[y][x] = { tileId, layer: 'floor' };
                    this.backgroundMap[y][x] = null;
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
            210: 'maze',
            10: 'dungeon',   // OPAQUE_INVERSE_DIAMOND_SUITE - ROT.js Digger dungeon with walls and doors
            143: 'room',
            144: 'room',
            12: 'item_spawn',
            3: 'actor_spawn',
            9: 'fire',
            135: 'sewage',
            132: 'wall'      // Spawns wall actors
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
        // Find all wildcard regions first
        const regions = [];
        const processed = new Set();

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const key = `${x},${y}`;
                if (processed.has(key)) continue;

                const wildcard = this.wildcardMap[y][x];
                if (wildcard && wildcard.type !== 'unknown') {
                    // Find the bounding box of this contiguous wildcard region
                    const region = this.findWildcardRegion(x, y, wildcard.type, processed);
                    regions.push({ region, type: wildcard.type });
                }
            }
        }

        // Process mazes first, then rooms (so rooms can detect maze intersections)
        const mazes = regions.filter(r => r.type === 'maze');
        const rooms = regions.filter(r => r.type === 'room');
        const others = regions.filter(r => r.type !== 'maze' && r.type !== 'room');

        for (const { region, type } of [...mazes, ...rooms, ...others]) {
            await this.generateWildcardContent(region, type);
        }
    }

    findWildcardRegion(startX, startY, type, processed) {
        // Find bounding box of contiguous wildcard tiles of the same type
        let minX = startX, maxX = startX, minY = startY, maxY = startY;
        const stack = [{x: startX, y: startY}];

        while (stack.length > 0) {
            const {x, y} = stack.pop();
            const key = `${x},${y}`;

            if (processed.has(key)) continue;
            if (x < 0 || x >= this.width || y < 0 || y >= this.height) continue;

            const wildcard = this.wildcardMap[y][x];
            if (!wildcard || wildcard.type !== type) continue;

            processed.add(key);
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);

            // Check 4-connected neighbors
            stack.push({x: x+1, y}, {x: x-1, y}, {x, y: y+1}, {x, y: y-1});
        }

        return {
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1
        };
    }

    async generateWildcardContent(region, type) {
        console.log(`Generating ${type} at (${region.x}, ${region.y}) size ${region.width}x${region.height}`);

        switch (type) {
            case 'maze':
                this.generateMazeAt(region.x, region.y, region.width, region.height);
                break;
            case 'dungeon':
                this.generateDungeonAt(region.x, region.y, region.width, region.height);
                break;
            case 'room':
                this.generateRoomAt(region.x, region.y, region.width, region.height);
                break;
            case 'item_spawn':
                // Spawn random item
                break;
            case 'actor_spawn':
                // Spawn random actor
                break;
            case 'fire':
                this.spawnActorsAt(region, 'fire');
                break;
            case 'sewage':
                this.spawnActorsAt(region, 'sewage');
                break;
            case 'wall':
                this.spawnActorsAt(region, 'wall');
                break;
        }
    }

    spawnActorsAt(region, actorType) {
        const actorData = this.engine.currentPrototype.getActorData(actorType);
        if (!actorData) {
            console.warn(`No actor data found for wildcard type '${actorType}'`);
            return;
        }

        for (let y = region.y; y < region.y + region.height; y++) {
            for (let x = region.x; x < region.x + region.width; x++) {
                const wildcard = this.wildcardMap[y][x];
                if (wildcard && wildcard.type === actorType) {
                    const actor = new Actor(x, y, actorType, actorData, this.engine);
                    this.engine.entityManager.addEntity(actor);
                }
            }
        }
    }

    generateMazeAt(startX, startY, width, height) {
        const maze = new ROT.Map.EllerMaze(width, height);
        maze.create((x, y, value) => {
            const worldX = startX + x;
            const worldY = startY + y;

            if (worldX < this.width && worldY < this.height) {
                // Only generate where there's actually a wildcard tile
                const wildcard = this.wildcardMap[worldY][worldX];
                if (!wildcard || wildcard.type !== 'maze') {
                    return; // Skip non-wildcard areas (preserve authored content)
                }

                if (value === 0) {
                    // Passable floor - clear background and place floor tile
                    this.backgroundMap[worldY][worldX] = null;
                    this.floorMap[worldY][worldX] = { tileId: 158, layer: 'floor' };
                    this.walkableTiles.push({x: worldX, y: worldY});
                }
                // value === 1 is void - leave background intact (black), no floor tile
            }
        });
    }

    generateDungeonAt(startX, startY, width, height) {
        // Use ROT.js Digger for a more complex dungeon with rooms and corridors
        const dungeon = new ROT.Map.Digger(width, height, {
            roomWidth: [3, 7],
            roomHeight: [3, 5],
            corridorLength: [2, 5],
            dugPercentage: 0.3
        });

        // Track which cells are floors for wall placement
        const floorCells = new Set();
        const wallPositions = [];
        const doorPositions = [];

        // Generate the dungeon and place floor tiles
        dungeon.create((x, y, value) => {
            const worldX = startX + x;
            const worldY = startY + y;

            if (worldX < this.width && worldY < this.height) {
                // Only generate where there's actually a wildcard tile
                const wildcard = this.wildcardMap[worldY][worldX];
                if (!wildcard || wildcard.type !== 'dungeon') {
                    return; // Skip non-wildcard areas (preserve authored content)
                }

                if (value === 0) {
                    // Passable floor - clear background and place floor tile
                    this.backgroundMap[worldY][worldX] = null;
                    this.floorMap[worldY][worldX] = { tileId: 158, layer: 'floor' };
                    this.walkableTiles.push({x: worldX, y: worldY});
                    floorCells.add(`${x},${y}`);
                }
                // value === 1 is wall/void - leave background intact (black), no floor tile
            }
        });

        // Helper to check if a local coordinate has a floor
        const hasFloor = (lx, ly) => floorCells.has(`${lx},${ly}`);

        // Helper to check if a local coordinate is within bounds
        const inBounds = (lx, ly) => lx >= 0 && lx < width && ly >= 0 && ly < height;

        // Find wall positions: cells adjacent to floors but not floors themselves
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (hasFloor(x, y)) continue; // Skip floor cells

                const worldX = startX + x;
                const worldY = startY + y;

                // Check if within map bounds
                if (worldX >= this.width || worldY >= this.height) continue;

                // Check if this is within the wildcard region
                const wildcard = this.wildcardMap[worldY][worldX];
                if (!wildcard || wildcard.type !== 'dungeon') continue;

                // Check if adjacent to any floor (8-directional, includes corners)
                const adjacentToFloor =
                    (inBounds(x-1, y) && hasFloor(x-1, y)) ||
                    (inBounds(x+1, y) && hasFloor(x+1, y)) ||
                    (inBounds(x, y-1) && hasFloor(x, y-1)) ||
                    (inBounds(x, y+1) && hasFloor(x, y+1)) ||
                    (inBounds(x-1, y-1) && hasFloor(x-1, y-1)) ||  // top-left
                    (inBounds(x+1, y-1) && hasFloor(x+1, y-1)) ||  // top-right
                    (inBounds(x-1, y+1) && hasFloor(x-1, y+1)) ||  // bottom-left
                    (inBounds(x+1, y+1) && hasFloor(x+1, y+1));    // bottom-right

                if (adjacentToFloor && worldY > 0) {
                    wallPositions.push({x: worldX, y: worldY});
                    // Place floor tile under walls
                    this.backgroundMap[worldY][worldX] = null;
                    this.floorMap[worldY][worldX] = { tileId: 158, layer: 'floor' };
                }
            }
        }

        // Get doors from rooms - these are where corridors connect to rooms
        const rooms = dungeon.getRooms();
        for (const room of rooms) {
            room.getDoors((x, y) => {
                const worldX = startX + x;
                const worldY = startY + y;

                if (worldX < this.width && worldY < this.height && worldY > 0) {
                    const wildcard = this.wildcardMap[worldY][worldX];
                    if (wildcard && wildcard.type === 'dungeon') {
                        doorPositions.push({x: worldX, y: worldY});
                    }
                }
            });
        }

        // Store wall and door positions for later spawning (after EntityManager exists)
        this.pendingWallSpawns = this.pendingWallSpawns || [];
        this.pendingWallSpawns.push(...wallPositions);

        this.pendingDoorSpawns = this.pendingDoorSpawns || [];
        this.pendingDoorSpawns.push(...doorPositions);

        console.log(`Dungeon generated: ${floorCells.size} floor tiles, ${wallPositions.length} walls, ${doorPositions.length} doors`);
    }

    generateRoomAt(startX, startY, width, height) {
        const wallPositions = [];

        // Helper to check if a position has a maze floor tile
        const hasMazeFloor = (wx, wy) => {
            if (wx < 0 || wx >= this.width || wy < 0 || wy >= this.height) return false;
            const floor = this.floorMap[wy][wx];
            return floor && floor.tileId === 158;
        };

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const worldX = startX + x;
                const worldY = startY + y;

                if (worldX < this.width && worldY < this.height) {
                    // Clear background behind generated tiles
                    this.backgroundMap[worldY][worldX] = null;

                    const isPerimeter = (x === 0 || x === width - 1 || y === 0 || y === height - 1);

                    // Check if a maze path is adjacent to this perimeter tile (just outside the room)
                    let hasAdjacentMazePath = false;
                    if (isPerimeter) {
                        // Check the tile just outside the room perimeter
                        if (x === 0 && hasMazeFloor(worldX - 1, worldY)) hasAdjacentMazePath = true;
                        if (x === width - 1 && hasMazeFloor(worldX + 1, worldY)) hasAdjacentMazePath = true;
                        if (y === 0 && hasMazeFloor(worldX, worldY - 1)) hasAdjacentMazePath = true;
                        if (y === height - 1 && hasMazeFloor(worldX, worldY + 1)) hasAdjacentMazePath = true;
                    }

                    if (isPerimeter && !hasAdjacentMazePath) {
                        // Mark for wall actor placement (need +1 for actor's 2-tile height)
                        // Only place wall if there's room for the top sprite
                        if (worldY > 0) {
                            wallPositions.push({x: worldX, y: worldY});
                        }
                        // Still put a floor tile under walls
                        this.floorMap[worldY][worldX] = { tileId: 158, layer: 'floor' };
                    } else if (isPerimeter && hasAdjacentMazePath) {
                        // Maze path adjacent to room perimeter - this is a passageway
                        // Place floor and make walkable (no wall)
                        this.floorMap[worldY][worldX] = { tileId: 158, layer: 'floor' };
                        this.walkableTiles.push({x: worldX, y: worldY});
                    } else {
                        // Interior floor
                        this.floorMap[worldY][worldX] = { tileId: 158, layer: 'floor' };
                        this.walkableTiles.push({x: worldX, y: worldY});
                    }
                }
            }
        }

        // Spawn wall actors - needs to happen after EntityManager exists
        // Store for later processing
        this.pendingWallSpawns = this.pendingWallSpawns || [];
        this.pendingWallSpawns.push(...wallPositions);
    }

    spawnPendingWalls() {
        if (!this.pendingWallSpawns || this.pendingWallSpawns.length === 0) return;

        const actorData = this.engine.currentPrototype.getActorData('wall');
        if (!actorData) {
            console.warn('No wall actor data found');
            return;
        }

        for (const pos of this.pendingWallSpawns) {
            const wall = new Actor(pos.x, pos.y, 'wall', actorData, this.engine);
            this.engine.entityManager.addEntity(wall);
        }

        console.log(`Spawned ${this.pendingWallSpawns.length} wall actors`);
        this.pendingWallSpawns = [];
    }

    spawnPendingDoors() {
        if (!this.pendingDoorSpawns || this.pendingDoorSpawns.length === 0) return;

        const actorData = this.engine.currentPrototype.getActorData('door');
        if (!actorData) {
            console.warn('No door actor data found');
            return;
        }

        for (const pos of this.pendingDoorSpawns) {
            const door = new Actor(pos.x, pos.y, 'door', actorData, this.engine);
            this.engine.entityManager.addEntity(door);
        }

        console.log(`Spawned ${this.pendingDoorSpawns.length} door actors`);
        this.pendingDoorSpawns = [];
    }

    getRandomWalkableTile() {
        if (this.walkableTiles.length === 0) return {x: 0, y: 0};
        return this.walkableTiles[Math.floor(Math.random() * this.walkableTiles.length)];
    }

    isWalkable(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
        return this.floorMap[y][x]?.value === 157;
    }

    /**
     * Add diagonal shadow beneath floor tiles
     * Creates the appearance of a base with hard diagonal shadow
     *
     * Tile IDs (1-indexed for Tiled):
     * - BLACK_SQUARE: 142 (3,6 -> 6*23+3+1)
     * - DARK_SHADE: 178 (16,7 -> 7*23+16+1)
     * - BLACK_LOWER_LEFT_TRIANGLE_WITH_DARK_SHADE_UPPER_RIGHT_TRIANGLE: 128 (12,5 -> 5*23+12+1)
     */
    addBaseAndShadows() {
        // Tile IDs (1-indexed for Tiled):
        // FULL_BLOCK [9,9] = 9*23+9+1 = 217 (the black background tile)
        // DARK_SHADE [16,7] = 7*23+16+1 = 178
        // BLACK_LOWER_LEFT_TRIANGLE_WITH_DARK_SHADE_UPPER_RIGHT_TRIANGLE [12,5] = 5*23+12+1 = 128
        const BLACK_TILE = 217;
        const DARK_SHADE = 178;
        const SHADOW_DIAGONAL = 128;

        // Helper: check if position has a floor tile
        const hasFloor = (x, y) => {
            if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
            const floorTile = this.getTile('floor', x, y);
            return floorTile !== null && floorTile !== BLACK_TILE;
        };

        // Helper: check if background tile at position equals value
        const bgEquals = (x, y, value) => {
            if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
            return this.getTile('background', x, y) === value;
        };

        // Helper: check if floor is above (at y-1)
        const isFloorAbove = (x, y) => hasFloor(x, y - 1);

        // Helper: check if floor is to the left (at x-1)
        const isFloorLeft = (x, y) => hasFloor(x - 1, y);

        // Helper: check if floor is at upper-left (at x-1, y-1)
        const isFloorUpperLeft = (x, y) => hasFloor(x - 1, y - 1);

        // Helper: check if diagonal is to the left
        const isDiagonalLeft = (x, y) => bgEquals(x - 1, y, SHADOW_DIAGONAL);

        // Helper: check if diagonal is at upper-left
        const isDiagonalUpperLeft = (x, y) => bgEquals(x - 1, y - 1, SHADOW_DIAGONAL);

        // Helper: check if dark shade is above
        const isDarkShadeAbove = (x, y) => bgEquals(x, y - 1, DARK_SHADE);

        // Single pass through all tiles
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                // Only process black void tiles
                if (!bgEquals(x, y, BLACK_TILE)) continue;

                // Skip if this position has a floor tile
                if (hasFloor(x, y)) continue;

                // Condition 1: Place diagonal if floor above and either:
                // - floor to the left (left floor casts the black shadow), OR
                // - no floor at upper-left (this is the left edge of floor above)
                if (isFloorAbove(x, y) && (isFloorLeft(x, y) || !isFloorUpperLeft(x, y))) {
                    this.setTile('background', x, y, SHADOW_DIAGONAL);
                    continue;
                }

                // Condition 2: Place diagonal if there's a diagonal at upper-left and dark shade above
                // (continuing a diagonal line down-right)
                if (isDiagonalUpperLeft(x, y) && isDarkShadeAbove(x, y)) {
                    this.setTile('background', x, y, SHADOW_DIAGONAL);
                    continue;
                }

                // Condition 3: Fill with dark shade if diagonal is to the left and
                // there's floor or dark shade above (horizontal shadow fill)
                if (isDiagonalLeft(x, y) && (isFloorAbove(x, y) || isDarkShadeAbove(x, y))) {
                    // Fill horizontally to the right while conditions hold
                    let xPos = x;
                    while (xPos < this.width &&
                           bgEquals(xPos, y, BLACK_TILE) &&
                           !hasFloor(xPos, y) &&
                           (hasFloor(xPos, y - 1) || bgEquals(xPos, y - 1, DARK_SHADE))) {
                        this.setTile('background', xPos, y, DARK_SHADE);
                        xPos++;
                    }
                    continue;
                }
            }
        }
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
        this.backgroundMap = this.createEmptyMap();
        this.floorMap = this.createEmptyMap();
        this.wallMap = this.createEmptyMap();
        this.wildcardMap = this.createEmptyMap();
        this.walkableTiles = [];
    }
}

// LightingManager is now in lighting.js

// ============================================================================
// RENDER SYSTEM
// ============================================================================

class RenderSystem {
    constructor(app, mapWidth, mapHeight, engine) {
        this.app = app;
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
        this.engine = engine;
        
        // Create rendering containers
        this.backgroundContainer = new PIXI.Container();
        this.floorContainer = new PIXI.Container();
        this.entityContainer = new PIXI.Container();
        this.lightColorContainer = new PIXI.Container();
        this.darknessContainer = new PIXI.Container();
        this.uiContainer = new PIXI.Container();

        this.backgroundContainer.sortableChildren = true;
        this.floorContainer.sortableChildren = true;
        this.entityContainer.sortableChildren = true;
        this.lightColorContainer.sortableChildren = true;
        this.darknessContainer.sortableChildren = true;
        this.uiContainer.sortableChildren = true;

        // Set explicit zIndex to ensure correct layer order
        this.backgroundContainer.zIndex = 0;
        this.floorContainer.zIndex = 1;
        this.entityContainer.zIndex = 2;
        this.lightColorContainer.zIndex = 3;
        this.darknessContainer.zIndex = 4;
        this.uiContainer.zIndex = 5;

        app.stage.addChild(this.backgroundContainer);
        app.stage.addChild(this.floorContainer);
        app.stage.addChild(this.entityContainer);
        app.stage.addChild(this.lightColorContainer);
        app.stage.addChild(this.darknessContainer);
        app.stage.addChild(this.uiContainer);

        this.darknessSprites = [];
        this.lightColorSprites = [];
        this.floorSprites = [];
        this.backgroundSprites = [];
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

        // Initialize sprite tracking arrays
        this.backgroundSprites = Array.from({ length: this.mapHeight }, () =>
            Array.from({ length: this.mapWidth }, () => null)
        );
        this.floorSprites = Array.from({ length: this.mapHeight }, () =>
            Array.from({ length: this.mapWidth }, () => null)
        );

        // Render background layer
        this.renderLayer(mapManager.backgroundMap, this.backgroundContainer, tileset, this.backgroundSprites);

        // Render floor layer
        this.renderLayer(mapManager.floorMap, this.floorContainer, tileset, this.floorSprites);

        console.log(`Rendered tiles:`);
        console.log(`  Background: ${this.backgroundContainer.children.length} tiles`);
        console.log(`  Floor: ${this.floorContainer.children.length} tiles`);
    }

    /**
     * Render a single map layer to a container
     */
    renderLayer(layerMap, container, tileset, spriteArray = null) {
        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                const tile = layerMap[y]?.[x];

                if (tile && tile.tileId > 0) {
                    const sprite = this.createTileSprite(tile.tileId, x, y, tileset);
                    container.addChild(sprite);
                    if (spriteArray) {
                        spriteArray[y][x] = sprite;
                    }
                }
            }
        }
    }

    /**
     * Create a sprite for a tile ID at a position
     */
    createTileSprite(tileId, x, y, tileset) {
        // Convert Tiled tile ID (1-indexed) to spritesheet coordinates
        const tileIndex = tileId - 1;
        const tileX = tileIndex % globalVars.SPRITESHEET_COLS;
        const tileY = Math.floor(tileIndex / globalVars.SPRITESHEET_COLS);

        const rect = new PIXI.Rectangle(
            tileX * globalVars.TILE_WIDTH,
            tileY * globalVars.TILE_HEIGHT,
            globalVars.TILE_WIDTH,
            globalVars.TILE_HEIGHT
        );

        const texture = new PIXI.Texture(tileset.texture.baseTexture, rect);
        const sprite = new PIXI.Sprite(texture);

        sprite.x = x * globalVars.TILE_WIDTH;
        sprite.y = y * globalVars.TILE_HEIGHT;

        return sprite;
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

            // Render base sprite (static or animated)
            actor.spriteBase = this.createActorSprite(
                actor,
                actor.tileIndexBase,
                actor.animationBase,
                actor.x * globalVars.TILE_WIDTH,
                actor.y * globalVars.TILE_HEIGHT,
                10, // zIndex
                { flipH: actor.flipBaseH, flipV: actor.flipBaseV }
            );

            // Render top sprite (static or animated) - one tile above
            actor.spriteTop = this.createActorSprite(
                actor,
                actor.tileIndexTop,
                actor.animationTop,
                actor.x * globalVars.TILE_WIDTH,
                (actor.y - 1) * globalVars.TILE_HEIGHT,
                11, // zIndex
                { flipH: actor.flipTopH, flipV: actor.flipTopV }
            );

            actorsRendered++;
        }

        console.log(`Rendered ${actorsRendered} actors`);
    }

    /**
     * Create a sprite for an actor tile (base or top)
     * @param {Actor} actor - The actor this sprite belongs to
     * @param {Object|null} tileIndex - Static tile coordinates {x, y} or null
     * @param {string|null} animationName - Animation name (e.g., 'fire') or null
     * @param {number} x - Pixel x position
     * @param {number} y - Pixel y position
     * @param {number} zIndex - Render layer
     * @param {Object} options - Additional options {flipH: boolean, flipV: boolean}
     * @returns {PIXI.Sprite|PIXI.AnimatedSprite|null} The created sprite or null
     */
    createActorSprite(actor, tileIndex, animationName, x, y, zIndex, options = {}) {
        const tileset = PIXI.Loader.shared.resources.tiles;

        // Check for animated sprite first
        if (animationName && this.engine.animationFrames) {
            const animFrames = this.engine.animationFrames[animationName];
            if (animFrames && animFrames.length > 0) {
                const animSprite = new PIXI.AnimatedSprite(animFrames);
                animSprite.x = x;
                animSprite.y = y;
                animSprite.animationSpeed = 0.1;
                animSprite.play();
                animSprite.zIndex = zIndex;
                animSprite.tint = actor.tint;

                if (actor.flickerTint) {
                    const colors = generateColorVariation(actor.tint, 0x181808);
                    const tween = new createjs.Tween.get(animSprite, { loop: true })
                        .to({ tint: colors.lighter }, 80)
                        .wait(150)
                        .to({ tint: actor.tint }, 200)
                        .wait(300)
                        .to({ tint: colors.darker }, 60)
                        .wait(100);
                    animSprite._flickerTween = tween;
                }

                this.entityContainer.addChild(animSprite);
                return animSprite;
            }
        }

        // Fall back to static sprite
        if (tileIndex) {
            const rect = new PIXI.Rectangle(
                tileIndex.x * globalVars.TILE_WIDTH,
                tileIndex.y * globalVars.TILE_HEIGHT,
                globalVars.TILE_WIDTH,
                globalVars.TILE_HEIGHT
            );
            const texture = new PIXI.Texture(tileset.texture.baseTexture, rect);
            const sprite = new PIXI.Sprite(texture);

            sprite.zIndex = zIndex;
            sprite.tint = actor.tint;

            // Apply horizontal/vertical flip using anchor and scale
            // Set anchor to center for flipping, then adjust position
            if (options.flipH || options.flipV) {
                sprite.anchor.set(0.5, 0.5);
                sprite.x = x + globalVars.TILE_WIDTH / 2;
                sprite.y = y + globalVars.TILE_HEIGHT / 2;
                if (options.flipH) {
                    sprite.scale.x = -1;
                }
                if (options.flipV) {
                    sprite.scale.y = -1;
                }
            } else {
                sprite.x = x;
                sprite.y = y;
            }

            this.entityContainer.addChild(sprite);
            return sprite;
        }

        // No sprite to render
        return null;
    }

    renderItems(entityManager) {
        console.log('Rendering items...');

        const tileset = PIXI.Loader.shared.resources.tiles;
        if (!tileset) {
            console.error('Tileset not loaded');
            return;
        }

        let itemsRendered = 0;

        for (const item of entityManager.items) {
            if (!item.hasAttribute('visible')) continue;

            if (item.tileIndex) {
                const rect = new PIXI.Rectangle(
                    item.tileIndex.x * globalVars.TILE_WIDTH,
                    item.tileIndex.y * globalVars.TILE_HEIGHT,
                    globalVars.TILE_WIDTH,
                    globalVars.TILE_HEIGHT
                );
                const texture = new PIXI.Texture(tileset.texture.baseTexture, rect);
                const sprite = new PIXI.Sprite(texture);

                sprite.x = item.x * globalVars.TILE_WIDTH;
                sprite.y = item.y * globalVars.TILE_HEIGHT;
                sprite.zIndex = 5; // Below actors but above floor
                sprite.tint = item.tint;

                this.entityContainer.addChild(sprite);
                item.sprite = sprite;

                itemsRendered++;
            }
        }

        console.log(`Rendered ${itemsRendered} items`);
    }

    clear() {
        this.backgroundContainer.removeChildren();
        this.floorContainer.removeChildren();
        this.entityContainer.removeChildren();
        this.lightColorContainer.removeChildren();
        this.darknessContainer.removeChildren();
        this.uiContainer.removeChildren();
        this.darknessSprites = [];
        this.lightColorSprites = [];
        this.floorSprites = [];
        this.backgroundSprites = [];
    }

    initializeDarkness(width, height) {
        this.darknessContainer.removeChildren();
        this.lightColorContainer.removeChildren();
        this.darknessSprites = [];
        this.lightColorSprites = [];

        const tileset = PIXI.Loader.shared.resources.tiles;
        if (!tileset) return;

        const rect = new PIXI.Rectangle(
            0 * globalVars.TILE_WIDTH,
            10 * globalVars.TILE_HEIGHT,
            globalVars.TILE_WIDTH,
            globalVars.TILE_HEIGHT
        );
        this.darkTexture = new PIXI.Texture(tileset.texture.baseTexture, rect);
        this.solidDarkTexture = this.darkTexture;

        const whiteGraphics = new PIXI.Graphics();
        whiteGraphics.beginFill(0xFFFFFF);
        whiteGraphics.drawRect(0, 0, globalVars.TILE_WIDTH, globalVars.TILE_HEIGHT);
        whiteGraphics.endFill();
        this.lightColorTexture = this.app.renderer.generateTexture(whiteGraphics);
        whiteGraphics.destroy();

        for (let y = 0; y < height; y++) {
            this.darknessSprites[y] = [];
            this.lightColorSprites[y] = [];
            for (let x = 0; x < width; x++) {
                // Light color overlay (multiply blend)
                const lightSprite = new PIXI.Sprite(this.lightColorTexture);
                lightSprite.x = x * globalVars.TILE_WIDTH;
                lightSprite.y = y * globalVars.TILE_HEIGHT;
                lightSprite.alpha = 0;
                lightSprite.tint = 0xFFFFFF;
                lightSprite.blendMode = PIXI.BLEND_MODES.MULTIPLY;
                this.lightColorContainer.addChild(lightSprite);
                this.lightColorSprites[y][x] = lightSprite;

                // Darkness overlay
                const sprite = new PIXI.Sprite(this.solidDarkTexture);
                sprite.x = x * globalVars.TILE_WIDTH;
                sprite.y = y * globalVars.TILE_HEIGHT;
                sprite.alpha = 1.0;

                sprite.anchor.set(0.5, 0.5);
                sprite.x += globalVars.TILE_WIDTH / 2;
                sprite.y += globalVars.TILE_HEIGHT / 2;
                if (Math.random() < 0.5) sprite.scale.x = -1;
                if (Math.random() < 0.5) sprite.scale.y = -1;

                this.darknessContainer.addChild(sprite);
                this.darknessSprites[y][x] = sprite;
            }
        }
    }

    updateDarkness(lightingManager, fogOfWar = false) {
        if (!this.darknessSprites.length) return;

        const hasControlled = lightingManager.hasControlledActors();

        for (let y = 0; y < lightingManager.height; y++) {
            for (let x = 0; x < lightingManager.width; x++) {
                const darkSprite = this.darknessSprites[y]?.[x];
                const lightColorSprite = this.lightColorSprites[y]?.[x];

                const light = lightingManager.getLightLevel(x, y);
                const visible = lightingManager.isVisible(x, y);
                const explored = lightingManager.isExplored(x, y);

                // Calculate light tint color
                let lightTint = 0xFFFFFF;
                if (light.intensity > 0 && (light.r > 0 || light.g > 0 || light.b > 0)) {
                    const maxComponent = Math.max(light.r, light.g, light.b, 1);
                    const r = Math.floor((light.r / maxComponent) * 255);
                    const g = Math.floor((light.g / maxComponent) * 255);
                    const b = Math.floor((light.b / maxComponent) * 255);
                    lightTint = (r << 16) | (g << 8) | b;
                }

                // Apply colored light overlay using multiply blend
                if (lightColorSprite) {
                    if (visible && light.intensity > 0 && lightTint !== 0xFFFFFF) {
                        lightColorSprite.tint = lightTint;
                        lightColorSprite.alpha = Math.min(0.5, light.intensity * 0.5);
                    } else if (!hasControlled && light.intensity > 0 && lightTint !== 0xFFFFFF) {
                        // Observer mode: show light color where illuminated
                        lightColorSprite.tint = lightTint;
                        lightColorSprite.alpha = Math.min(0.5, light.intensity * 0.5);
                    } else {
                        lightColorSprite.alpha = 0;
                    }
                }

                // Update darkness overlay based on visibility and light
                if (darkSprite) {
                    if (!hasControlled) {
                        // Observer mode: show based on illumination only
                        if (light.intensity > 0 && light.intensity < 1) {
                            darkSprite.texture = this.darkTexture;
                            darkSprite.alpha = 1.0 - light.intensity;
                        } else if (light.intensity >= 1) {
                            darkSprite.alpha = 0;
                        } else {
                            darkSprite.texture = this.solidDarkTexture;
                            darkSprite.alpha = 1.0;
                        }
                    } else if (visible) {
                        // Visible to a controlled actor
                        // Alpha progression: 0 (full light) -> 0.85 (no light) -> 0.92 (remembered)
                        if (light.intensity >= 1) {
                            darkSprite.alpha = 0;
                        } else if (light.intensity > 0) {
                            // Scale from 0 to 0.85 as intensity goes from 1 to 0
                            darkSprite.texture = this.darkTexture;
                            darkSprite.alpha = 0.85 * (1.0 - light.intensity);
                        } else {
                            // Visible but no light
                            darkSprite.texture = this.darkTexture;
                            darkSprite.alpha = 0.85;
                        }
                    } else if (fogOfWar && explored) {
                        // Not visible but previously explored - darker than visible unlit
                        darkSprite.texture = this.darkTexture;
                        darkSprite.alpha = 0.92;
                    } else {
                        // Not visible and not explored
                        darkSprite.texture = this.solidDarkTexture;
                        darkSprite.alpha = 1.0;
                    }
                }
            }
        }

        // Update actor and item tints based on lighting
        this.updateEntityLighting(lightingManager);
    }

    updateEntityLighting(lightingManager) {
        const hasControlled = lightingManager.hasControlledActors();
        const fogOfWar = this.engine.currentPrototype?.config?.mechanics?.fog_of_war;

        for (const actor of this.engine.entityManager.actors) {
            const light = lightingManager.getLightLevel(actor.x, actor.y);
            const visible = lightingManager.isVisible(actor.x, actor.y);
            const explored = lightingManager.isExplored(actor.x, actor.y);

            if (hasControlled) {
                const shouldShow = visible || (fogOfWar && explored);
                if (actor.spriteBase) actor.spriteBase.visible = shouldShow;
                if (actor.spriteTop) actor.spriteTop.visible = shouldShow;

                this.setAnimationPlaying(actor.spriteBase, visible);
                this.setAnimationPlaying(actor.spriteTop, visible);

                if (!shouldShow) continue;
            } else {
                if (actor.spriteBase) actor.spriteBase.visible = true;
                if (actor.spriteTop) actor.spriteTop.visible = true;
                this.setAnimationPlaying(actor.spriteBase, true);
                this.setAnimationPlaying(actor.spriteTop, true);
            }

            if (actor.hasAttribute('light_source')) continue;

            let lightTint = 0xFFFFFF;
            if (light.intensity > 0 && (light.r > 0 || light.g > 0 || light.b > 0)) {
                const maxComponent = Math.max(light.r, light.g, light.b, 1);
                const r = Math.floor((light.r / maxComponent) * 255);
                const g = Math.floor((light.g / maxComponent) * 255);
                const b = Math.floor((light.b / maxComponent) * 255);
                lightTint = (r << 16) | (g << 8) | b;
            }

            if (hasControlled && !visible && fogOfWar && explored) {
                lightTint = 0x333333;
            }

            if (actor.spriteBase) {
                actor.spriteBase.tint = this.blendTints(actor.tint, lightTint);
            }
            if (actor.spriteTop) {
                actor.spriteTop.tint = this.blendTints(actor.tint, lightTint);
            }
        }

        for (const item of this.engine.entityManager.items) {
            const light = lightingManager.getLightLevel(item.x, item.y);
            const visible = lightingManager.isVisible(item.x, item.y);
            const explored = lightingManager.isExplored(item.x, item.y);

            if (hasControlled) {
                const shouldShow = visible || (fogOfWar && explored);
                if (item.sprite) item.sprite.visible = shouldShow;
                this.setAnimationPlaying(item.sprite, visible);
                if (!shouldShow) continue;
            } else {
                if (item.sprite) item.sprite.visible = true;
                this.setAnimationPlaying(item.sprite, true);
            }

            let lightTint = 0xFFFFFF;
            if (light.intensity > 0 && (light.r > 0 || light.g > 0 || light.b > 0)) {
                const maxComponent = Math.max(light.r, light.g, light.b, 1);
                const r = Math.floor((light.r / maxComponent) * 255);
                const g = Math.floor((light.g / maxComponent) * 255);
                const b = Math.floor((light.b / maxComponent) * 255);
                lightTint = (r << 16) | (g << 8) | b;
            }

            if (hasControlled && !visible && fogOfWar && explored) {
                lightTint = 0x333333;
            }

            if (item.sprite) {
                item.sprite.tint = this.blendTints(item.tint, lightTint);
            }
        }
    }

    blendTints(baseTint, lightTint) {
        const br = (baseTint >> 16) & 0xFF;
        const bg = (baseTint >> 8) & 0xFF;
        const bb = baseTint & 0xFF;

        const lr = (lightTint >> 16) & 0xFF;
        const lg = (lightTint >> 8) & 0xFF;
        const lb = lightTint & 0xFF;

        const r = Math.floor((br * lr) / 255);
        const g = Math.floor((bg * lg) / 255);
        const b = Math.floor((bb * lb) / 255);

        return (r << 16) | (g << 8) | b;
    }

    setAnimationPlaying(sprite, shouldPlay) {
        if (!sprite) return;
        if (!(sprite instanceof PIXI.AnimatedSprite)) return;

        if (shouldPlay && !sprite.playing) {
            sprite.play();
        } else if (!shouldPlay && sprite.playing) {
            sprite.stop();
        }
    }
}

// ============================================================================
// AUDIO MANAGER
// ============================================================================

class AudioManager {
    constructor(audioSpriteData) {
        this.audioSpriteData = audioSpriteData;
        this.sound = null;
        this.muted = false;
        this.volume = 1.0;
        
        if (audioSpriteData) {
            this.initHowler();
        }
    }
    
    initHowler() {
        try {
            // Use URLs from sprite data if available, otherwise construct default paths
            let urls = this.audioSpriteData.urls;
            
            // If URLs are relative and start with /, make them relative to current directory
            if (urls && urls.length > 0) {
                urls = urls.map(url => {
                    if (url.startsWith('/')) {
                        return '.' + url; // Convert /assets/... to ./assets/...
                    }
                    return url;
                });
            } else {
                // Fallback to default paths
                const basePath = './assets/audio/effects';
                const formats = ['mp3', 'ogg', 'm4a'];
                urls = formats.map(ext => `${basePath}.${ext}`);
            }
            
            console.log('Initializing audio with URLs:', urls);
            
            this.sound = new Howl({
                src: urls,
                sprite: this.audioSpriteData.sprite,
                volume: this.volume,
                onload: () => {
                    console.log('Audio sprite loaded successfully');
                },
                onloaderror: (id, error) => {
                    console.error('Audio loading error:', error);
                }
            });
            
            console.log('Howler initialized with', Object.keys(this.audioSpriteData.sprite).length, 'sound effects');
        } catch (error) {
            console.error('Failed to initialize Howler:', error);
            this.sound = null;
        }
    }
    
    play(soundName) {
        if (!this.sound) {
            console.warn('Audio system not initialized');
            return;
        }
        
        if (this.muted) {
            return;
        }
        
        try {
            // Check if the sound exists in the sprite
            if (!this.audioSpriteData.sprite[soundName]) {
                console.warn(`Sound '${soundName}' not found in audio sprite`);
                return;
            }
            
            this.sound.play(soundName);
        } catch (error) {
            console.warn(`Failed to play sound '${soundName}':`, error);
        }
    }
    
    stop(soundName) {
        if (this.sound) {
            try {
                this.sound.stop(soundName);
            } catch (error) {
                console.warn(`Failed to stop sound '${soundName}':`, error);
            }
        }
    }
    
    mute() {
        this.muted = true;
        if (this.sound) {
            this.sound.mute(true);
        }
    }
    
    unmute() {
        this.muted = false;
        if (this.sound) {
            this.sound.mute(false);
        }
    }
    
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume)); // Clamp between 0 and 1
        if (this.sound) {
            this.sound.volume(this.volume);
        }
    }
    
    listSounds() {
        if (!this.audioSpriteData) {
            return [];
        }
        return Object.keys(this.audioSpriteData.sprite);
    }
}

// ============================================================================
// INPUT MANAGER
// ============================================================================

class InputManager {
    constructor(engine) {
        this.engine = engine;
        this.enabled = true;

        // Key mappings (supports multiple keys per action)
        this.keyMap = {
            // Arrow keys and WASD for movement
            'ArrowUp': 'move_up',
            'ArrowDown': 'move_down',
            'ArrowLeft': 'move_left',
            'ArrowRight': 'move_right',
            'w': 'move_up',
            'W': 'move_up',
            's': 'move_down',
            'S': 'move_down',
            'a': 'move_left',
            'A': 'move_left',
            'd': 'move_right',
            'D': 'move_right',
            // Numpad for 8-directional movement
            'Numpad8': 'move_up',
            'Numpad2': 'move_down',
            'Numpad4': 'move_left',
            'Numpad6': 'move_right',
            'Numpad7': 'move_up_left',
            'Numpad9': 'move_up_right',
            'Numpad1': 'move_down_left',
            'Numpad3': 'move_down_right',
            'Numpad5': 'wait',
            // Vi keys
            'k': 'move_up',
            'j': 'move_down',
            'h': 'move_left',
            'l': 'move_right',
            'y': 'move_up_left',
            'u': 'move_up_right',
            'b': 'move_down_left',
            'n': 'move_down_right',
            // Other actions
            '.': 'wait',
            'g': 'pickup',
            ',': 'pickup',
            'i': 'inventory'
        };

        // Global keys (work regardless of player state)
        this.globalKeyMap = {
            ' ': 'toggle_pause',
            'Escape': 'reload'
        };

        // Direction vectors for movement actions
        this.directions = {
            'move_up': { dx: 0, dy: -1 },
            'move_down': { dx: 0, dy: 1 },
            'move_left': { dx: -1, dy: 0 },
            'move_right': { dx: 1, dy: 0 },
            'move_up_left': { dx: -1, dy: -1 },
            'move_up_right': { dx: 1, dy: -1 },
            'move_down_left': { dx: -1, dy: 1 },
            'move_down_right': { dx: 1, dy: 1 }
        };

        this.setupListeners();
    }

    setupListeners() {
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    handleKeyDown(event) {
        if (!this.enabled) return;

        // Check global keys first (work regardless of player state)
        const globalAction = this.globalKeyMap[event.key] || this.globalKeyMap[event.code];
        if (globalAction) {
            event.preventDefault();
            this.executeGlobalAction(globalAction);
            return;
        }

        // Player-specific actions require a living player
        const player = this.engine.entityManager?.player;
        if (!player || player.isDead) return;

        const action = this.keyMap[event.key] || this.keyMap[event.code];
        if (!action) return;

        // Prevent default for game keys (don't scroll page with arrows, etc.)
        event.preventDefault();

        this.executeAction(action, player);
    }

    executeGlobalAction(action) {
        switch (action) {
            case 'toggle_pause':
                this.engine.toggleObserverPause();
                break;

            case 'reload':
                this.engine.reloadPrototype();
                break;
        }
    }

    executeAction(action, player) {
        // Handle movement actions
        if (this.directions[action]) {
            const dir = this.directions[action];
            const moved = player.moveBy(dir.dx, dir.dy);
            if (moved) {
                this.engine.playSound('feets');
                this.onPlayerAction();
            }
            return;
        }

        // Handle other actions
        switch (action) {
            case 'wait':
                console.log(`${player.name} waits.`);
                this.onPlayerAction();
                break;

            case 'pickup':
                const item = this.engine.entityManager.getItemAt(player.x, player.y);
                if (item) {
                    player.pickUpItem(item);
                    this.engine.playSound('pickup');
                    this.onPlayerAction();
                } else {
                    console.log('Nothing to pick up here.');
                }
                break;

            case 'inventory':
                console.log('Inventory:', player.inventory.map(i => i.name).join(', ') || '(empty)');
                break;
        }
    }

    onPlayerAction() {
        // Called after player takes an action - unlock the turn engine to let AI act
        if (this.engine.turnEngine) {
            this.engine.turnEngine.unlock();
        }
    }

    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
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

// Audio debugging utilities
window.audioDebug = {
    play: (soundName) => {
        if (!engine || !engine.audioManager) {
            console.error('Engine not initialized. Run initializeGame() first.');
            return;
        }
        engine.playSound(soundName);
    },
    
    list: () => {
        if (!engine || !engine.audioManager) {
            console.error('Engine not initialized. Run initializeGame() first.');
            return [];
        }
        const sounds = engine.listAvailableSounds();
        console.table(sounds.map(name => ({ sound: name })));
        return sounds;
    },
    
    volume: (vol) => {
        if (!engine || !engine.audioManager) {
            console.error('Engine not initialized. Run initializeGame() first.');
            return;
        }
        engine.setAudioVolume(vol);
        console.log(`Volume set to ${vol * 100}%`);
    },
    
    mute: () => {
        if (!engine || !engine.audioManager) {
            console.error('Engine not initialized. Run initializeGame() first.');
            return;
        }
        engine.muteAudio();
        console.log('Audio muted');
    },
    
    unmute: () => {
        if (!engine || !engine.audioManager) {
            console.error('Engine not initialized. Run initializeGame() first.');
            return;
        }
        engine.unmuteAudio();
        console.log('Audio unmuted');
    },
    
    test: () => {
        if (!engine || !engine.audioManager) {
            console.error('Engine not initialized. Run initializeGame() first.');
            return;
        }
        console.log('Playing test sequence...');
        const testSounds = ['feets', 'plunk1', 'tone1', 'bow', 'pickup'];
        testSounds.forEach((sound, i) => {
            setTimeout(() => {
                console.log(`Playing: ${sound}`);
                engine.playSound(sound);
            }, i * 600);
        });
    }
};

// Level loading utilities for developer console
// Levels ordered by depth (index = depth number)
const levelsByDepth = [
    { name: 'default', description: 'Default Test Prototype' },
    { name: 'labyrinth', description: 'Cretan Labyrinth' }
];

window.loadLevel = async (levelIdentifier) => {
    if (!engine) {
        console.error('Engine not initialized. Run initializeGame() first.');
        return;
    }

    let prototypeName;

    // Check if it's a number (depth) or string (name)
    if (typeof levelIdentifier === 'number') {
        const depth = levelIdentifier;
        if (depth < 0 || depth >= levelsByDepth.length) {
            console.error(`Invalid depth: ${depth}. Valid range: 0-${levelsByDepth.length - 1}`);
            listLevels();
            return;
        }
        prototypeName = levelsByDepth[depth].name;
        console.log(`Loading depth ${depth}: ${prototypeName}`);
    } else {
        prototypeName = levelIdentifier;
        console.log(`Loading level: ${prototypeName}`);
    }

    await engine.reloadPrototype(prototypeName);
};

window.listLevels = () => {
    const levels = levelsByDepth.map((level, depth) => ({
        depth,
        name: level.name,
        description: level.description
    }));
    console.table(levels);
    console.log('Use loadLevel(depth) or loadLevel("name") to load a level');
    return levels;
};

console.log('Dungeon Mode Kit loaded. Call initializeGame() to start.');
console.log('Level utilities: listLevels(), loadLevel("prototypeName")');