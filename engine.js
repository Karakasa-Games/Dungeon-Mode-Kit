/**
 * Dungeon Mode Kit - Core Engine, 2025- Wiley Wiggins
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
            const response = await fetch(`${globalVars.BASE_PATH}/data/static-tiles.json`);
            const data = await response.json();
            this.tiles = data.tiles;
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
     * Convert a tile name to a Tiled tileId (1-based linear index)
     * @param {string} name - Tile name from static-tiles.json
     * @param {number} cols - Number of columns in spritesheet (default 23)
     * @returns {number|null} Tiled tileId or null if not found
     */
    getTileIdByName(name, cols = 23) {
        const coords = this.getTileByName(name);
        if (!coords) return null;
        return coords.y * cols + coords.x + 1;
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
        let hex = value.startsWith('#') ? value.slice(1) : value;
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

/**
 * Get the indefinite article ('a' or 'an') for a word
 * @param {string} word - The word to get the article for
 * @returns {string} 'a' or 'an'
 */
function getIndefiniteArticle(word) {
    if (!word || word.length === 0) return 'a';
    const firstLetter = word.charAt(0).toLowerCase();
    const vowels = ['a', 'e', 'i', 'o', 'u'];
    return vowels.includes(firstLetter) ? 'an' : 'a';
}

/**
 * Process [a-an] template markers in a string
 * Replaces [a-an] with 'a' or 'an' based on the following word
 * @param {string} text - The text containing [a-an] markers
 * @returns {string} The processed text with proper articles
 */
function processArticleTemplates(text) {
    // Match [a-an] followed by optional whitespace and capture the next word
    return text.replace(/\[a-an\]\s*(\w+)/gi, (_match, nextWord) => {
        const article = getIndefiniteArticle(nextWord);
        return `${article} ${nextWord}`;
    });
}

// ============================================================================
// PATHFINDING UTILITIES
// ============================================================================

/**
 * Compute a straight line path between two points using Bresenham's algorithm
 * Useful for line-of-sight, projectile paths, and aiming
 * @param {number} x0 - Starting X coordinate
 * @param {number} y0 - Starting Y coordinate
 * @param {number} x1 - Ending X coordinate
 * @param {number} y1 - Ending Y coordinate
 * @returns {Array<{x: number, y: number}>} Array of points along the line (includes start and end)
 */
function getLinePath(x0, y0, x1, y1) {
    const points = [];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let x = x0;
    let y = y0;

    while (true) {
        points.push({ x, y });

        if (x === x1 && y === y1) break;

        const e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy;
            x += sx;
        }
        if (e2 < dx) {
            err += dx;
            y += sy;
        }
    }

    return points;
}

/**
 * Check if there's a clear line of sight between two points
 * @param {number} x0 - Starting X coordinate
 * @param {number} y0 - Starting Y coordinate
 * @param {number} x1 - Ending X coordinate
 * @param {number} y1 - Ending Y coordinate
 * @param {function(number, number): boolean} isBlocked - Callback that returns true if a tile blocks sight
 * @param {boolean} includeEndpoints - Whether to check the start and end points (default: false)
 * @returns {boolean} True if line of sight is clear
 */
function hasLineOfSight(x0, y0, x1, y1, isBlocked, includeEndpoints = false) {
    const path = getLinePath(x0, y0, x1, y1);

    for (let i = 0; i < path.length; i++) {
        if (!includeEndpoints && (i === 0 || i === path.length - 1)) {
            continue;
        }

        if (isBlocked(path[i].x, path[i].y)) {
            return false;
        }
    }

    return true;
}

/**
 * Get the first blocking point along a line (for projectile impacts, etc.)
 * @param {number} x0 - Starting X coordinate
 * @param {number} y0 - Starting Y coordinate
 * @param {number} x1 - Ending X coordinate
 * @param {number} y1 - Ending Y coordinate
 * @param {function(number, number): boolean} isBlocked - Callback that returns true if a tile blocks
 * @param {boolean} skipStart - Whether to skip the starting point (default: true)
 * @returns {{x: number, y: number}|null} First blocking point, or null if path is clear
 */
function getFirstBlockingPoint(x0, y0, x1, y1, isBlocked, skipStart = true) {
    const path = getLinePath(x0, y0, x1, y1);

    for (let i = skipStart ? 1 : 0; i < path.length; i++) {
        if (isBlocked(path[i].x, path[i].y)) {
            return path[i];
        }
    }

    return null;
}

/**
 * Compute a path using A* algorithm via ROT.js
 * @param {number} fromX - Starting X coordinate
 * @param {number} fromY - Starting Y coordinate
 * @param {number} toX - Target X coordinate
 * @param {number} toY - Target Y coordinate
 * @param {function(number, number): boolean} isPassable - Callback that returns true if a tile is passable
 * @param {object} options - Optional settings
 * @param {number} options.topology - Movement topology: 4 (cardinal), 6 (hex), or 8 (including diagonals). Default: 8
 * @returns {Array<{x: number, y: number}>} Array of points from start to end (includes both), or empty array if no path
 */
function findPathAStar(fromX, fromY, toX, toY, isPassable, options = {}) {
    const topology = options.topology ?? 8;
    const path = [];

    const astar = new ROT.Path.AStar(toX, toY, isPassable, { topology });

    astar.compute(fromX, fromY, (x, y) => {
        path.push({ x, y });
    });

    return path;
}

/**
 * Compute a path using Dijkstra's algorithm via ROT.js
 * @param {number} fromX
 * @param {number} fromY
 * @param {number} toX
 * @param {number} toY
 * @param {function(number, number): boolean} isPassable
 * @param {object} options
 * @param {number} options.topology - Movement topology: 4 (cardinal), 6 (hex), or 8 (including diagonals). Default: 8
 * @returns {Array<{x: number, y: number}>} Array of points from start to end (includes both), or empty array if no path
 */
function findPathDijkstra(fromX, fromY, toX, toY, isPassable, options = {}) {
    const topology = options.topology ?? 8;
    const path = [];

    const dijkstra = new ROT.Path.Dijkstra(toX, toY, isPassable, { topology });

    dijkstra.compute(fromX, fromY, (x, y) => {
        path.push({ x, y });
    });

    return path;
}

/**
 * Check if a path exists between two points (without computing the full path)
 * Uses A* for efficiency
 * @param {number} fromX
 * @param {number} fromY
 * @param {number} toX
 * @param {number} toY
 * @param {function(number, number): boolean} isPassable
 * @param {object} options
 * @param {number} options.topology - Movement topology: 4, 6, or 8. Default: 8
 * @returns {boolean} True if a path exists
 */
function pathExists(fromX, fromY, toX, toY, isPassable, options = {}) {
    const path = findPathAStar(fromX, fromY, toX, toY, isPassable, options);
    return path.length > 0;
}

/**
 * Get the next step along a path from one point to another
 * Useful for AI movement - returns just the next tile to move to
 * @param {number} fromX
 * @param {number} fromY
 * @param {number} toX
 * @param {number} toY
 * @param {function(number, number): boolean} isPassable
 * @param {object} options
 * @param {number} options.topology - Movement topology: 4, 6, or 8. Default: 8
 * @returns {{x: number, y: number}|null} Next point to move to, or null if no path or already at target
 */
function getNextPathStep(fromX, fromY, toX, toY, isPassable, options = {}) {
    if (fromX === toX && fromY === toY) {
        return null;
    }
    const path = findPathAStar(fromX, fromY, toX, toY, isPassable, options);
    if (path.length > 1) {
        return path[1];
    }

    return null;
}

/**
 * Calculate Manhattan distance between two points
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @returns {number} Manhattan distance
 */
function getManhattanDistance(x0, y0, x1, y1) {
    return Math.abs(x1 - x0) + Math.abs(y1 - y0);
}

/**
 * Calculate Chebyshev distance between two points (diagonal distance)
 * This is the number of king moves on a chessboard
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @returns {number} Chebyshev distance
 */
function getChebyshevDistance(x0, y0, x1, y1) {
    return Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
}

/**
 * Calculate Euclidean distance between two points
 * @param {number} x0 - First X coordinate
 * @param {number} y0 - First Y coordinate
 * @param {number} x1 - Second X coordinate
 * @param {number} y1 - Second Y coordinate
 * @returns {number} Euclidean distance
 */
function getEuclideanDistance(x0, y0, x1, y1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    return Math.sqrt(dx * dx + dy * dy);
}

// ============================================================================
// CORE ENGINE CLASS
// ============================================================================

class DungeonEngine {
    constructor(config = {}) {
        this.app = null;
        this.scheduler = null;
        this.turnEngine = null;
        this.renderer = null;
        this.mapManager = null;
        this.entityManager = null;
        this.inputManager = null;
        this.lightingManager = null;
        this.interfaceManager = null;
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
            const [actorsRes, itemsRes, personalitiesRes, entitiesRes, colorsRes, adjectivesRes, attacksRes, reagentsRes] = await Promise.all([
                fetch(`${globalVars.BASE_PATH}/data/actors.json`),
                fetch(`${globalVars.BASE_PATH}/data/items.json`),
                fetch(`${globalVars.BASE_PATH}/data/personalities.json`),
                fetch(`${globalVars.BASE_PATH}/data/entities.json`),
                fetch(`${globalVars.BASE_PATH}/data/colors.json`),
                fetch(`${globalVars.BASE_PATH}/data/adjectives.json`),
                fetch(`${globalVars.BASE_PATH}/data/attacks.json`),
                fetch(`${globalVars.BASE_PATH}/data/reagents.json`)
            ]);

            this.globalActors = await actorsRes.json();
            this.globalItems = await itemsRes.json();
            this.globalPersonalities = await personalitiesRes.json();
            this.globalEntities = await entitiesRes.json();
            const colorsData = await colorsRes.json();
            this.globalColors = colorsData.colors || [];
            this.globalAdjectives = await adjectivesRes.json();
            this.globalAttacks = await attacksRes.json();

            // Load reagents and sample a random subset to keep in memory
            const fullReagents = await reagentsRes.json();
            this.globalReagents = this.sampleReagents(fullReagents, 100);

            console.log('Global data loaded:', {
                actors: Object.keys(this.globalActors).length,
                items: Object.keys(this.globalItems).length,
                personalities: Object.keys(this.globalPersonalities).length,
                entities: Object.keys(this.globalEntities).length,
                colors: this.globalColors.length,
                adjectives: Object.keys(this.globalAdjectives).length,
                attacks: Object.keys(this.globalAttacks).length,
                reagents: Object.keys(this.globalReagents).length
            });
        } catch (error) {
            console.error('Failed to load global data:', error);
            this.globalActors = {};
            this.globalItems = {};
            this.globalPersonalities = {};
            this.globalEntities = {};
            this.globalColors = [];
            this.globalAdjectives = {};
            this.globalAttacks = {};
            this.globalReagents = {};
        }
    }

    /**
     * Sample a random subset from a reagents data object
     * @param {Object} fullData - The full reagents data with category arrays
     * @param {number} sampleSize - Number of items to keep per category
     * @returns {Object} Sampled data with same structure but fewer items
     */
    sampleReagents(fullData, sampleSize) {
        const sampled = {};
        for (const [category, items] of Object.entries(fullData)) {
            if (Array.isArray(items)) {
                // Fisher-Yates shuffle and take first sampleSize items
                const shuffled = [...items];
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                sampled[category] = shuffled.slice(0, Math.min(sampleSize, shuffled.length));
            } else {
                sampled[category] = items;
            }
        }
        return sampled;
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
            this.interfaceManager = new InterfaceManager(this);
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
                        .add('fire', `${globalVars.BASE_PATH}/assets/sprites/fire-animation.png`)
                        .add('smoke', `${globalVars.BASE_PATH}/assets/sprites/smoke-animation.png`)
                        .add('fluid', `${globalVars.BASE_PATH}/assets/sprites/fluid-animation.png`)
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
            const audioData = await fetch(`${globalVars.BASE_PATH}/data/sounds.json`).then(r => r.json());
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

        this.turnSpeed = this.currentPrototype?.config.turn_speed ?? 50;
        this.observerPaused = false;
        console.log(`Turn engine initialized with ${this.scheduler._queue._events.length} scheduled actors`);
        console.log(`Observer mode: ${!this.hasControlledActor}, turn speed: ${this.turnSpeed}ms`);
        this.turnEngine.start();
        if (!this.hasControlledActor) {
            this.advanceObserverTurn();
        }
    }

    /**
     * Advance one turn in observer mode (no player-controlled actors)
     */
    advanceObserverTurn() {
        if (this.observerPaused || this.hasControlledActor) return;
        if (this.turnEngine && this.turnEngine._lock) {
            this.turnEngine.unlock();
        }
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

        if (this.interfaceManager) {
            this.interfaceManager.hidePlayerInfo();
        }

        if (this.turnEngine && this.turnEngine._lock) {
            this.turnEngine.unlock();
        }
        const hasActorsWithBehaviors = this.entityManager.actors.some(
            actor => !actor.isDead && actor.personality
        );

        if (hasActorsWithBehaviors) {
            this.observerPaused = false;
            setTimeout(() => this.advanceObserverTurn(), this.turnSpeed);
        } else {
            console.log('No actors with behaviors remaining - game over');
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
    playSound(soundName) {
        if (this.audioManager) {
            this.audioManager.play(soundName);
        }
    }
    playSoundVaried(soundName, volumeBase, volumeVariance, rateBase, rateVariance) {
        if (this.audioManager) {
            this.audioManager.playVaried(soundName, volumeBase, volumeVariance, rateBase, rateVariance);
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
        if (hasAuthoredMap) {
            await this.mapManager.loadTiledMap(`${globalVars.BASE_PATH}/prototypes/${prototypeName}/map.tmj`);
        } else {
            this.mapManager.generateProceduralMap();
        }

        this.canvasWidth = this.mapManager.width * this.config.tileWidth;
        this.canvasHeight = this.mapManager.height * this.config.tileHeight;

        await this.initializeRenderer();

        this.entityManager = new EntityManager(this);

        await this.entityManager.spawnEntities(this.currentPrototype.config, entryDirection);
        await this.mapManager.processWildcards();

        this.spawnPlayerAtStairway(entryDirection);

        this.mapManager.spawnPendingWalls();
        this.mapManager.spawnPendingDoors();

        // Run cellular automata behaviors once to pre-calculate initial state
        this.entityManager.runCellularAutomataStep();

        if (!prototypeConfig.mechanics?.darkness) {
            this.mapManager.addBaseAndShadows();
        }

        this.renderer.renderTestPattern(this.mapManager);
        this.renderer.renderItems(this.entityManager);
        this.renderer.renderActors(this.entityManager);

        // Check initial submersion state for all actors (after sprites exist)
        for (const actor of this.entityManager.actors) {
            actor.updateSubmersionState();
        }

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


        this.initializeTurnEngine();

        if (prototypeConfig.loaded_sound) {
            this.playSound(prototypeConfig.loaded_sound);
        }

        // Show prototype description in the description element
        if (prototypeConfig.description && this.inputManager) {
            this.inputManager.clearMessageStack();
            this.inputManager.showMessage(prototypeConfig.description);
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
            const response = await fetch(`${globalVars.BASE_PATH}/prototypes/${prototypeName}/prototype.json`);
            return await response.json();
        } catch (error) {
            console.error(`Failed to load prototype config for ${prototypeName}:`, error);
            return this.getDefaultPrototypeConfig();
        }
    }

    async checkForAuthoredMap(prototypeName) {
        try {
            const response = await fetch(`${globalVars.BASE_PATH}/prototypes/${prototypeName}/map.tmj`, { method: 'HEAD' });
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
                health: { max: 1, current: 1 }
            },
            inventory: { max_items: 10 },
            available_items: ["key", "bow", "arrow"],
            available_actors: ["player", "monster", "wall"],
            win_conditions: ["reach_exit"]
        };
    }
    
    async transitionToPrototype(prototypeName, saveState = true, entryDirection = null) {
        if (saveState) {
            this.prototypeStack.push({
                name: this.currentPrototype.name,
                state: this.saveGameState()
            });
        }

        this.cleanup();
        await this.loadPrototype(prototypeName, entryDirection);
    }

    async returnToPreviousPrototype() {
        if (this.prototypeStack.length === 0) {
            console.warn('No previous prototype to return to');
            return;
        }

        const previous = this.prototypeStack.pop();
        this.cleanup();
        await this.loadPrototype(previous.name);
        this.restoreGameState(previous.state);
    }

    /**
     * Check if all win conditions for the current prototype are met
     * @returns {boolean} True if all win conditions are satisfied
     */
    checkWinConditions() {
        const config = this.currentPrototype?.config;
        const winConditions = config?.win_conditions || [];

        // No conditions = always unlocked
        if (winConditions.length === 0) return true;

        const player = this.entityManager?.player;
        if (!player) return false;

        for (const condition of winConditions) {
            if (!this.checkWinCondition(condition, player)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Check a single win condition
     * @param {string|object} condition - The condition to check
     * @param {Actor} player - The player actor
     * @returns {boolean} True if condition is met
     */
    checkWinCondition(condition, player) {
        if (typeof condition === 'string') {
            // Format: "wearing:item_type" - player must have item equipped
            if (condition.startsWith('wearing:')) {
                const itemType = condition.substring(8);
                return player.inventory.some(item =>
                    item.type === itemType && player.isItemEquipped(item)
                );
            }
            // Format: "holding:item_type" - player must have item in inventory
            if (condition.startsWith('holding:')) {
                const itemType = condition.substring(8);
                return player.inventory.some(item => item.type === itemType);
            }
            // Format: "killed:actor_type" - all actors of type must be dead
            if (condition.startsWith('killed:')) {
                const actorType = condition.substring(7);
                return !this.entityManager.actors.some(actor =>
                    actor.type === actorType && !actor.isDead
                );
            }
        }

        // Handle object conditions (for future expansion)
        if (typeof condition === 'object') {
            // Could add more complex conditions here
        }

        console.warn(`Unknown win condition: ${condition}`);
        return false;
    }

    /**
     * Unlock all locked stairways when win conditions are met
     * This is called when a win condition is triggered (e.g., equipping an item)
     */
    unlockWinConditionStairways() {
        const stairways = this.entityManager?.actors.filter(actor =>
            actor.hasAttribute('stairway') && actor.hasAttribute('locked')
        );

        if (!stairways || stairways.length === 0) return;

        for (const stairway of stairways) {
            stairway.setAttribute('locked', false);
            stairway.setAttribute('collision_description', null);
            stairway.open();
            stairway.name = 'Stairs Down';
        }

        this.inputManager?.showMessage('The way forward is now open!');
    }

    /**
     * Lock stairways when win conditions are no longer met
     * This is called when a win condition is broken (e.g., unequipping an item)
     */
    lockWinConditionStairways() {
        // Find stairways that were unlocked (have openable attribute and are open)
        const stairways = this.entityManager?.actors.filter(actor =>
            actor.hasAttribute('stairway') &&
            actor.hasAttribute('openable') &&
            actor.hasAttribute('open')
        );

        if (!stairways || stairways.length === 0) return;

        for (const stairway of stairways) {
            stairway.setAttribute('locked', true);
            stairway.setAttribute('open', false);
            stairway.setAttribute('solid', true);
            stairway.setAttribute('collision_description', 'The stairs are sealed. You must fulfill your quest first.');
            stairway.name = 'Sealed Stairs';

            // Update tiles back to locked appearance
            if (stairway.tileIndexBase && stairway.spriteBase) {
                const tileset = PIXI.Loader.shared.resources.tiles;
                const rect = new PIXI.Rectangle(
                    stairway.tileIndexBase.x * globalVars.TILE_WIDTH,
                    stairway.tileIndexBase.y * globalVars.TILE_HEIGHT,
                    globalVars.TILE_WIDTH,
                    globalVars.TILE_HEIGHT
                );
                stairway.spriteBase.texture = new PIXI.Texture(tileset.texture.baseTexture, rect);
            }
        }

        this.inputManager?.showMessage('The way forward is sealed once more.');
    }

    /**
     * Use a stairway to transition to another level
     * @param {string} direction - 'up' or 'down'
     */
    async useStairway(direction) {
        const config = this.currentPrototype.config;
        let targetLevel = null;

        if (direction === 'down' && config.next_level) {
            targetLevel = config.next_level;
        } else if (direction === 'up' && config.previous_level) {
            targetLevel = config.previous_level;
        }

        if (targetLevel) {
            console.log(`Using stairway ${direction} to ${targetLevel}`);

            const entryDirection = direction === 'down' ? 'from_above' : 'from_below';
            await this.transitionToPrototype(targetLevel, true, entryDirection);
        } else {
            console.log(`No ${direction === 'down' ? 'next' : 'previous'} level configured`);
        }
    }

    /**
     * Spawn the player at the appropriate stairway based on entry direction
     * @param {string|null} entryDirection - 'from_above', 'from_below', or null for direct load
     */
    spawnPlayerAtStairway(entryDirection) {

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
            targetStairwayType = 'up';
        }

        const stairway = this.entityManager.findActorByAttribute('stairway', targetStairwayType);

        if (stairway) {
            console.log(`Spawning player at ${targetStairwayType} stairway (${stairway.x}, ${stairway.y})`);
            const playerData = this.currentPrototype.getActorData('player');
            if (playerData) {
                const player = new Actor(stairway.x, stairway.y, 'player', playerData, this);
                this.entityManager.addEntity(player);
                player.loadDefaultItems();
            } else {
                console.error('No player actor data found in prototype');
            }
        } else if (entryDirection === null) {
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

        if (this.interfaceManager) {
            this.interfaceManager.clear();
        }

        if (this.app) {
            this.app.destroy(true, { children: true, texture: false, baseTexture: false });
            this.app = null;
            this.renderer = null;
            this.interfaceManager = null;
        }

        if (this.lightingManager) {
            this.lightingManager = null;
        }
    }
}

// ============================================================================
// PROTOTYPE CLASS  (levels)
// ============================================================================

class Prototype {
    constructor(name, config, engine) {
        this.name = name;
        this.config = config;
        this.engine = engine;
        this.basePath = `${globalVars.BASE_PATH}/prototypes/${name}/`;

        // Identification tracking: maps item type -> true if identified this session
        this.identifiedTypes = new Set();

        // Random color assignments: maps item type -> assigned color object
        // This ensures all instances of the same item type get the same random color
        this.itemColorAssignments = new Map();

        // Lock pairing system: tracks color-locked doors and their assigned colors
        // Each locked door gets a unique color, keys are assigned to match
        this.lockColors = [];           // Array of assigned lock colors (color objects)
        this.usedLockColors = new Set(); // Track which colors have been used
        this.unpairedLockColors = [];    // Colors assigned to doors but not yet to keys
    }

    async loadAssets() {

        const prototypeActors = await this.loadJSON('actors.json', {});
        const prototypeItems = await this.loadJSON('items.json', {});
        const prototypePersonalities = await this.loadJSON('personalities.json', {});
        this.actors = { ...this.engine.globalActors, ...prototypeActors };
        this.items = { ...this.engine.globalItems, ...prototypeItems };
        this.personalities = { ...this.engine.globalPersonalities, ...prototypePersonalities };

        // Store prototype-specific keys for random distribution
        this.prototypeActorTypes = Object.keys(prototypeActors);
        this.prototypeItemTypes = Object.keys(prototypeItems);

        console.log(`Loaded assets for prototype: ${this.name}`);
        console.log(`  Actors: ${Object.keys(this.actors).length} (${this.prototypeActorTypes.length} prototype-specific)`);
        console.log(`  Items: ${Object.keys(this.items).length} (${this.prototypeItemTypes.length} prototype-specific)`);
        console.log(`  Personalities: ${Object.keys(this.personalities).length} (${Object.keys(prototypePersonalities).length} prototype-specific)`);
    }

    /**
     * Check if an item type has been identified in this prototype session
     */
    isTypeIdentified(itemType) {
        return this.identifiedTypes.has(itemType);
    }

    /**
     * Mark an item type as identified, affecting all items of that type
     */
    identifyType(itemType) {
        if (!this.identifiedTypes.has(itemType)) {
            this.identifiedTypes.add(itemType);
            console.log(`Item type '${itemType}' has been identified!`);

            // Update all existing items of this type
            if (this.engine.entityManager) {
                for (const item of this.engine.entityManager.items) {
                    if (item.type === itemType) {
                        item.identified = true;
                    }
                }
            }
        }
    }

    /**
     * Get or assign a random color for an item type
     * Ensures all items of the same type get the same color within this prototype
     */
    getColorForItemType(itemType) {
        if (this.itemColorAssignments.has(itemType)) {
            return this.itemColorAssignments.get(itemType);
        }

        // Assign a random color from the global colors list
        const colors = this.engine.globalColors;
        if (colors && colors.length > 0) {
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            this.itemColorAssignments.set(itemType, randomColor);
            console.log(`Assigned color '${randomColor.color}' (${randomColor.hex}) to item type '${itemType}'`);
            return randomColor;
        }

        return null;
    }

    /**
     * Assign a unique color to a locked door
     * Each door gets its own color that a matching key must have
     * @returns {Object|null} The assigned color object {color, hex}
     */
    assignLockColor() {
        const colors = this.engine.globalColors;
        if (!colors || colors.length === 0) return null;

        // Find an unused color
        const availableColors = colors.filter(c => !this.usedLockColors.has(c.color));

        if (availableColors.length === 0) {
            // All colors used, pick a random one (allows duplicate colors)
            const color = colors[Math.floor(Math.random() * colors.length)];
            this.lockColors.push(color);
            this.unpairedLockColors.push(color);
            console.log(`Assigned lock color '${color.color}' (reused, all colors taken)`);
            return color;
        }

        // Pick a random unused color
        const color = availableColors[Math.floor(Math.random() * availableColors.length)];
        this.usedLockColors.add(color.color);
        this.lockColors.push(color);
        this.unpairedLockColors.push(color);
        console.log(`Assigned lock color '${color.color}' to door`);
        return color;
    }

    /**
     * Get a color for a key that matches an unpaired locked door
     * @returns {Object|null} The assigned color object {color, hex}
     */
    getKeyColor() {
        // If there are unpaired doors, assign the key to one of them
        if (this.unpairedLockColors.length > 0) {
            const color = this.unpairedLockColors.shift(); // Take the first unpaired color
            console.log(`Assigned key color '${color.color}' to match a door`);
            return color;
        }

        // No unpaired doors - this key won't match anything yet
        // Assign a random color (the door might be spawned later)
        const colors = this.engine.globalColors;
        if (colors && colors.length > 0) {
            const color = colors[Math.floor(Math.random() * colors.length)];
            console.log(`Assigned key color '${color.color}' (no unpaired doors)`);
            return color;
        }

        return null;
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
        this.tileIndex = engine.spriteLibrary.resolveTile(data.tileIndex) || {x: 0, y: 0};
        this.height = 1;
        this.flipH = data.flipH || false;
        this.flipV = data.flipV || false;
        this.setAttribute('pickupable', true);
        this.setAttribute('visible', true);

        // Identification system
        this.unidentifiedTemplate = data.unidentified_template || null;
        this.identifiedTemplate = data.identified_template || null;
        // Store template variables for substitution (copy so we can modify per-instance)
        this.templateVars = { ...(data.template_vars || {}) };

        // Handle random color assignment for items with random_color flag
        if (data.random_color && engine.currentPrototype) {
            let assignedColor;

            // Keys use the lock pairing system - each key gets a color matching a door
            if (data.attributes?.key) {
                assignedColor = engine.currentPrototype.getKeyColor();
                if (assignedColor) {
                    // Store the lock_color for matching with doors
                    this.setAttribute('lock_color', assignedColor.color);
                }
            } else {
                // Other items (potions, etc.) use type-based color assignment
                assignedColor = engine.currentPrototype.getColorForItemType(type);
            }

            if (assignedColor) {
                // Set the color name for template substitution
                this.templateVars.color = assignedColor.color;
                // Set the tint from the hex value
                this.tint = parseTint(assignedColor.hex);
            } else {
                this.tint = parseTint(data.tint);
            }
        } else {
            this.tint = parseTint(data.tint);
        }

        // Identification status - check if this type was already identified
        if (data.identified === false) {
            // Item starts unidentified, but check if type was already identified this session
            this.identified = engine.currentPrototype?.isTypeIdentified(type) ?? false;
        } else {
            this.identified = data.identified ?? true;
        }

        // Use description template (shown when item is used)
        this.useDescription = data.use_description || null;

        if (data.attributes) {
            Object.entries(data.attributes).forEach(([key, value]) => {
                this.setAttribute(key, value);
            });
        }

        // Handle random effect generation for generic potions
        if (data.random_effect && engine.currentPrototype) {
            this.generateRandomEffect(engine);
        }
    }

    /**
     * Generate a random stat effect for this item based on available player stats
     * Sets use_effect attribute and generates an appropriate description
     * @param {DungeonEngine} engine - The game engine
     */
    generateRandomEffect(engine) {
        // Get player actor data to find available stats
        const playerData = engine.currentPrototype.getActorData('player');
        if (!playerData || !playerData.stats) {
            // No player stats defined - potion has no effect
            this.templateVars.effect_description = 'It has no effect';
            return;
        }

        const statNames = Object.keys(playerData.stats);
        if (statNames.length === 0) {
            this.templateVars.effect_description = 'It has no effect';
            return;
        }

        // Pick a random stat
        const randomStat = statNames[Math.floor(Math.random() * statNames.length)];

        // Determine effect magnitude and direction
        // 70% chance positive, 30% chance negative
        const isPositive = Math.random() < 0.7;
        // Effect magnitude: 5-25 for health-like stats, 1-5 for strength-like stats
        const statValue = playerData.stats[randomStat];
        const maxStat = typeof statValue === 'object' ? statValue.max : statValue;
        let magnitude;
        if (maxStat >= 50) {
            // Large stat (health, nutrition) - bigger effects
            magnitude = Math.floor(Math.random() * 21) + 5; // 5-25
        } else {
            // Small stat (strength, etc.) - smaller effects
            magnitude = Math.floor(Math.random() * 5) + 1; // 1-5
        }

        const effectValue = isPositive ? magnitude : -magnitude;

        // Set the use_effect
        this.setAttribute('use_effect', { [randomStat]: effectValue });

        // Generate description based on effect
        const statCapitalized = randomStat.charAt(0).toUpperCase() + randomStat.slice(1);
        if (effectValue > 0) {
            this.templateVars.effect_description = `It restores ${statCapitalized}`;
        } else {
            this.templateVars.effect_description = `It drains ${statCapitalized}`;
        }
    }

    /**
     * Get the display name based on identification status
     * Processes templates like "[color] [name]" or "[name] of [reagents.reagents]"
     * Supports [file.key] syntax for random selection from global data (reagents, adjectives)
     * @returns {string} The name to display
     */
    getDisplayName() {
        const template = this.identified ? this.identifiedTemplate : this.unidentifiedTemplate;

        // If no template, return base name
        if (!template) {
            return this.name;
        }

        // Process template by replacing [key] or [file.key] with values
        return template.replace(/\[([^\]]+)\]/g, (match, key) => {
            // Check templateVars first (includes previously resolved random values)
            if (this.templateVars[key] !== undefined) {
                return this.templateVars[key];
            }

            // Handle file.key syntax (e.g., [reagents.reagents], [adjectives.yucky])
            if (key.includes('.')) {
                const [file, category] = key.split('.');
                let dataSource = null;

                if (file === 'reagents') {
                    dataSource = this.engine.globalReagents;
                } else if (file === 'adjectives') {
                    dataSource = this.engine.globalAdjectives;
                }

                if (dataSource && dataSource[category] && dataSource[category].length > 0) {
                    // Pick a random value and store it so it's consistent
                    const randomValue = dataSource[category][Math.floor(Math.random() * dataSource[category].length)];
                    this.templateVars[key] = randomValue;
                    return randomValue;
                }
                return match;
            }

            // Check item properties
            if (this[key] !== undefined) {
                return this[key];
            }
            // Check attributes
            const attrValue = this.getAttribute(key);
            if (attrValue !== undefined) {
                return attrValue;
            }
            // Return the key itself if no substitution found
            return match;
        });
    }

    /**
     * Identify this item and all items of the same type in this prototype
     */
    identify() {
        this.identified = true;
        // Notify the prototype so all items of this type become identified
        if (this.engine.currentPrototype) {
            this.engine.currentPrototype.identifyType(this.type);
        }
    }

    /**
     * Get the use description with template substitution
     * Supports [item_name], [key], and [adjectives.category] for random adjective selection
     * @returns {string|null} The processed use description or null if none
     */
    getUseDescription() {
        if (!this.useDescription) return null;

        let result = this.useDescription.replace(/\[([^\]]+)\]/g, (match, key) => {
            // Skip [a-an] - will be processed after all other substitutions
            if (key.toLowerCase() === 'a-an') {
                return match;
            }

            // Handle adjectives.category syntax (e.g., [adjectives.yucky])
            if (key.startsWith('adjectives.')) {
                const category = key.substring('adjectives.'.length);
                const adjectives = this.engine.globalAdjectives?.[category];
                if (adjectives && adjectives.length > 0) {
                    return adjectives[Math.floor(Math.random() * adjectives.length)];
                }
                return match;
            }

            // Handle special item_name key
            if (key === 'item_name') {
                return this.getDisplayName();
            }

            // Check templateVars
            if (this.templateVars[key] !== undefined) {
                return this.templateVars[key];
            }

            // Check item properties
            if (this[key] !== undefined) {
                return this[key];
            }

            // Check attributes
            const attrValue = this.getAttribute(key);
            if (attrValue !== undefined) {
                return attrValue;
            }

            // Return the key itself if no substitution found
            return match;
        });

        // Process [a-an] templates after all other substitutions
        return processArticleTemplates(result);
    }

    use(actor) {
        console.log(`${actor.name} used ${this.name}`);
    }
}

class Actor extends Entity {
    constructor(x, y, type, data, engine) {
        super(x, y, type, engine);
        this.name = data.name || type;
        this.height = 2;
        this.tint = parseTint(data.tint);
        this.flickerTint = data.flickerTint || false;
        this.visionRange = data.vision_range ?? 8;

        this.tileIndexBase = engine.spriteLibrary.resolveTile(data.tileIndexBase) || null;
        this.animationBase = data.animationBase || null;

        this.tileIndexTop = engine.spriteLibrary.resolveTile(data.tileIndexTop) || null;
        this.animationTop = data.animationTop || null;

        // Legacy support: if 'animated' is true with 'animation_frames', treat as animationBase
        if (data.animated && data.animation_frames) {
            this.animationBase = data.animation_frames;
        }

        this.flipBaseH = data.flipBaseH || false;
        this.flipBaseV = data.flipBaseV || false;
        this.flipTopH = data.flipTopH || false;
        this.flipTopV = data.flipTopV || false;

        this.spriteBase = null;
        this.spriteTop = null;

        this.equipment = {
            top: null,
            middle: null,
            lower: null
        };
        this.spriteEquipment = {
            top: null,
            middle: null,
            lower: null
        };
        

        this.stats = {};

        if (data.stats) {
            Object.entries(data.stats).forEach(([stat, value]) => {
                // Normalize to { max, current } format
                if (typeof value === 'object' && value.max !== undefined) {
                    this.stats[stat] = { ...value };
                } else {
                    this.stats[stat] = { max: value, current: value };
                }
            });
        }
        
        this.inventory = [];

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

        // Load top-level behavior properties as attributes
        if (data.collision_effect) {
            this.setAttribute('collision_effect', data.collision_effect);
        }
        if (data.collision_sound) {
            this.setAttribute('collision_sound', data.collision_sound);
        }
        if (data.collision_description) {
            this.setAttribute('collision_description', data.collision_description);
        }
        if (data.death_sound) {
            this.setAttribute('death_sound', data.death_sound);
        }

        // Copy lifetime for actors that expire (clouds, fire, etc.)
        this.lifetime = data.lifetime || null;

        // Legacy support: load state properties as attributes (open, locked, etc.)
        // New format: define these directly in attributes instead of state
        if (data.state) {
            Object.entries(data.state).forEach(([key, value]) => {
                this.setAttribute(key, value);
            });
        }

        // Store alternate tile indices for state changes
        this.tileIndexBase_open = engine.spriteLibrary.resolveTile(data.tileIndexBase_open) || null;
        this.tileIndexTop_open = engine.spriteLibrary.resolveTile(data.tileIndexTop_open) || null;

        // Handle random color assignment for color-locked doors
        if (data.random_color && this.hasAttribute('color_locked') && engine.currentPrototype) {
            const assignedColor = engine.currentPrototype.assignLockColor();
            if (assignedColor) {
                this.setAttribute('lock_color', assignedColor.color);
                this.tint = parseTint(assignedColor.hex);
            }
        }

        this.isDead = false;


        this.defaultItems = data.default_items || [];
    }

    /**
     * Load default items into actor's inventory
     * Called after actor is spawned and prototype is available
     */
    loadDefaultItems() {
        if (!this.defaultItems.length) return;

        for (const itemType of this.defaultItems) {
            const itemData = this.engine.currentPrototype?.getItemData(itemType);
            if (!itemData) {
                console.warn(`Default item '${itemType}' not found for ${this.name}`);
                continue;
            }


            const item = new Item(-1, -1, itemType, itemData, this.engine);

            this.inventory.push(item);
            console.log(`${this.name} starts with ${item.name}`);

            // Auto-equip wearable items for now
            const slot = item.getAttribute('wearable');
            if (slot && ['top', 'middle', 'lower'].includes(slot)) {
                this.equipToSlot(item, slot);
            }
        }
    }

    open() {
        if (!this.hasAttribute('openable')) return;
        if (this.hasAttribute('locked')) {
            console.log(`${this.name} is locked`);
            return;
        }

        this.setAttribute('open', true);
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
        this.engine.playSound('plunk3');
        console.log(`${this.name} opened`);
        this.engine.inputManager?.showMessage(`The ${this.name} opens.`);
    }

    close() {
        if (!this.hasAttribute('openable')) return;

        this.setAttribute('open', false);
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
        this.engine.inputManager?.showMessage(`The ${this.name} closes.`);
    }

    /**
     * Update the tile index for base or top sprite
     * @param {string|Object} tileRef - Tile name string or {x, y} coordinates
     * @param {string} layer - 'base' or 'top'
     */
    updateTileIndex(tileRef, layer = 'base') {
        const tileIndex = this.engine.spriteLibrary.resolveTile(tileRef);
        if (!tileIndex) return;

        const tileset = PIXI.Loader.shared.resources.tiles;
        const rect = new PIXI.Rectangle(
            tileIndex.x * globalVars.TILE_WIDTH,
            tileIndex.y * globalVars.TILE_HEIGHT,
            globalVars.TILE_WIDTH,
            globalVars.TILE_HEIGHT
        );

        if (layer === 'base' && this.spriteBase) {
            this.tileIndexBase = tileIndex;
            this.spriteBase.texture = new PIXI.Texture(tileset.texture.baseTexture, rect);
        } else if (layer === 'top' && this.spriteTop) {
            this.tileIndexTop = tileIndex;
            this.spriteTop.texture = new PIXI.Texture(tileset.texture.baseTexture, rect);
        }
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

            // Update player info box if visible (reflects stat changes from previous turn)
            this.engine.interfaceManager?.updatePlayerInfo();

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
    
    /**
     * Kill the actor
     * @param {boolean} spawnRemains - Whether to spawn remains entity (default: true)
     */
    die(spawnRemains = true) {
        this.isDead = true;
        this.setAttribute('solid', false);

        // Show death message for visible actors (skip for mass nouns like clouds)
        if (this.hasAttribute('visible') && !this.hasAttribute('mass_noun')) {
            if (this.hasAttribute('controlled')) {
                this.engine.inputManager?.showMessage(`You die...`);
            } else {
                this.engine.inputManager?.showMessage(`The ${this.name} dies.`);
            }
        }

        // Play death sound if specified
        const deathSound = this.getAttribute('death_sound');
        if (deathSound) {
            this.engine.playSound?.(deathSound);
        }

        // Drop items (if not already dropped by fall())
        if (this.inventory.length > 0) {
            this.dropItems(false);
        }

        // Spawn remains entity if specified (not when falling into void)
        if (spawnRemains) {
            const remains = this.getAttribute('remains');
            if (remains) {
                this.engine.entityManager.spawnEntity(remains, this.x, this.y);
            }
        }

        if (this.spriteBase) {
            this.spriteBase.visible = false;
        }
        if (this.spriteTop) {
            this.spriteTop.visible = false;
        }

        // Hide equipment sprites
        for (const slot of ['top', 'middle', 'lower']) {
            if (this.spriteEquipment[slot]) {
                this.spriteEquipment[slot].visible = false;
            }
        }

        if (this.engine.scheduler) {
            this.engine.scheduler.remove(this);
        }

        // If this was the controlled actor, transition to observer mode
        if (this.hasAttribute('controlled')) {
            this.engine.onControlledActorDied();
        }

        // Check if this death triggers win conditions
        if (!this.hasAttribute('controlled') && this.engine.checkWinConditions()) {
            this.engine.unlockWinConditionStairways();
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
            if (this.hasAttribute('controlled')) {
                const displayName = item.getDisplayName ? item.getDisplayName() : item.name;
                const article = this.engine.inputManager?.getIndefiniteArticle(displayName) || 'a';
                this.engine.inputManager?.showMessage(`Your inventory is full. You can't pick up ${article} ${displayName}.`);
            }
            return false;
        }

        this.inventory.push(item);
        this.engine.entityManager.removeEntity(item);
        console.log(`${this.name} picked up ${item.name}`);

        // Play pickup sound and show message if this is the player
        if (this.hasAttribute('controlled')) {
            const pickupSound = item.getAttribute('pickup_sound') || 'tone3';
            this.engine.playSound(pickupSound);

            // Show pickup message in description element
            const displayName = item.getDisplayName ? item.getDisplayName() : item.name;
            const article = this.engine.inputManager?.getIndefiniteArticle(displayName) || 'a';
            this.engine.inputManager?.showMessage(`You pick up ${article} ${displayName}.`);
        }

        // Auto-equip wearable items
        const slot = item.getAttribute('wearable');
        if (slot && ['top', 'middle', 'lower'].includes(slot)) {
            this.equipToSlot(item, slot);
        }

        return true;
    }

    /**
     * Equip a wearable item to its designated slot
     * @param {Item} item - The wearable item to equip
     * @param {string} slot - The equipment slot ('top', 'middle', or 'lower')
     */
    equipToSlot(item, slot) {
        // If slot already has an item, unequip it first
        const currentItem = this.equipment[slot];
        if (currentItem) {
            this.unequipFromSlot(slot);
        }

        // Equip the new item
        this.equipment[slot] = item;

        // Apply wear effects to actor
        this.applyWearEffect(item);

        // Create sprite for the equipped item
        this.spriteEquipment[slot] = this.engine.renderer.createEquipmentSprite(
            this,
            item,
            slot
        );

        console.log(`${this.name} equipped ${item.name} (${slot})`);

        // Check if this triggers win conditions (for player only)
        if (this.hasAttribute('controlled') && this.engine.checkWinConditions()) {
            this.engine.unlockWinConditionStairways();
        }
    }

    /**
     * Unequip an item from a slot
     * @param {string} slot - The equipment slot to unequip
     */
    unequipFromSlot(slot) {
        const item = this.equipment[slot];
        if (!item) return;

        // Remove wear effects from actor
        this.removeWearEffect(item);

        // Destroy sprite
        if (this.spriteEquipment[slot]) {
            this.spriteEquipment[slot].destroy();
            this.spriteEquipment[slot] = null;
        }

        // Clear the slot
        this.equipment[slot] = null;

        console.log(`${this.name} unequipped ${item.name}`);

        // Check if this breaks win conditions (for player only)
        if (this.hasAttribute('controlled') && !this.engine.checkWinConditions()) {
            this.engine.lockWinConditionStairways();
        }
    }

    /**
     * Apply wear effects from an item to this actor
     * @param {Item} item - The item being equipped
     */
    applyWearEffect(item) {
        const wearEffect = item.getAttribute('wear_effect');
        if (!wearEffect) return;

        for (const [attr, value] of Object.entries(wearEffect)) {
            const currentValue = this.getAttribute(attr);

            // Only apply if actor has this attribute
            if (currentValue === undefined) continue;

            // Handle "toggle" value
            if (value === 'toggle') {
                this.setAttribute(attr, !currentValue);
                console.log(`${item.name}: toggled ${this.name}'s ${attr} to ${!currentValue}`);
            }
            // Handle numeric values (add)
            else if (typeof currentValue === 'number' && typeof value === 'number') {
                this.setAttribute(attr, currentValue + value);
                console.log(`${item.name}: ${this.name}'s ${attr} ${value >= 0 ? '+' : ''}${value} (now ${currentValue + value})`);
            }
            // Handle boolean values (set directly)
            else if (typeof value === 'boolean') {
                // Store original value for restoration on unequip
                if (!item._originalWearValues) item._originalWearValues = {};
                item._originalWearValues[attr] = currentValue;
                this.setAttribute(attr, value);
                console.log(`${item.name}: set ${this.name}'s ${attr} to ${value}`);
            }
        }
    }

    /**
     * Remove wear effects from an item from this actor
     * @param {Item} item - The item being unequipped
     */
    removeWearEffect(item) {
        const wearEffect = item.getAttribute('wear_effect');
        if (!wearEffect) return;

        for (const [attr, value] of Object.entries(wearEffect)) {
            const currentValue = this.getAttribute(attr);

            // Only remove if actor has this attribute
            if (currentValue === undefined) continue;

            // Handle "toggle" value (toggle back)
            if (value === 'toggle') {
                this.setAttribute(attr, !currentValue);
                console.log(`${item.name} removed: toggled ${this.name}'s ${attr} to ${!currentValue}`);
            }
            // Handle numeric values (subtract)
            else if (typeof currentValue === 'number' && typeof value === 'number') {
                this.setAttribute(attr, currentValue - value);
                console.log(`${item.name} removed: ${this.name}'s ${attr} ${value >= 0 ? '-' : '+'}${Math.abs(value)} (now ${currentValue - value})`);
            }
            // Handle boolean values (restore original)
            else if (typeof value === 'boolean') {
                const originalValue = item._originalWearValues?.[attr];
                if (originalValue !== undefined) {
                    this.setAttribute(attr, originalValue);
                    console.log(`${item.name} removed: restored ${this.name}'s ${attr} to ${originalValue}`);
                }
            }
        }
    }

    /**
     * Get the item equipped in a specific slot
     * @param {string} slot - The equipment slot ('head', 'body', or 'feet')
     * @returns {Item|null}
     */
    getEquippedItem(slot) {
        return this.equipment[slot] || null;
    }

    /**
     * Check if actor has any equipped items
     * @returns {boolean}
     */
    hasEquippedItems() {
        return this.equipment.top || this.equipment.middle || this.equipment.lower;
    }

    /**
     * Check if a specific item is currently equipped
     * @param {Item} item - The item to check
     * @returns {boolean} True if the item is equipped in any slot
     */
    isItemEquipped(item) {
        return this.equipment.top === item ||
               this.equipment.middle === item ||
               this.equipment.lower === item;
    }

    /**
     * Equip a wearable item (convenience method)
     * @param {Item} item - The item to equip
     * @returns {boolean} True if successfully equipped
     */
    equipItem(item) {
        const slot = item.getAttribute('wearable');
        if (!slot || !['top', 'middle', 'lower'].includes(slot)) {
            console.log(`${item.name} is not wearable`);
            return false;
        }

        if (!this.inventory.includes(item)) {
            console.log(`${this.name} doesn't have ${item.name}`);
            return false;
        }

        this.equipToSlot(item, slot);
        return true;
    }

    /**
     * Unequip a worn item (convenience method)
     * @param {Item} item - The item to unequip
     * @returns {boolean} True if successfully unequipped
     */
    unequipItem(item) {
        const slot = item.getAttribute('wearable');
        if (!slot) return false;

        if (this.equipment[slot] !== item) {
            console.log(`${item.name} is not equipped`);
            return false;
        }

        this.unequipFromSlot(slot);
        return true;
    }

    /**
     * Use an item from inventory
     * @param {Item} item - The item to use
     * @returns {boolean} True if item was used successfully
     */
    useItem(item) {
        // Check if item is in inventory
        if (!this.inventory.includes(item)) {
            console.log(`${this.name} doesn't have ${item.name}`);
            return false;
        }

        // Check if item has a use_verb (is usable)
        const useVerb = item.getAttribute('use_verb');
        if (!useVerb) {
            console.log(`${item.name} cannot be used`);
            return false;
        }

        // Play use sound if this is the player
        if (this.hasAttribute('controlled')) {
            const useSound = item.getAttribute('use_sound') || 'tone1';
            this.engine.playSound(useSound);
        }

        // Get the use effect to determine what happens
        const useEffect = item.getAttribute('use_effect');
        let success = false;

        if (useEffect) {
            success = this.executeItemEffect(item, useEffect);
        } else {
            // Item has a verb but no effect - just mark as used
            console.log(`${this.name} used ${item.name}`);
            success = true;
        }

        // Handle consumable items (remove from inventory after use)
        if (success && item.hasAttribute('consumable')) {
            this.inventory = this.inventory.filter(i => i !== item);
            console.log(`${item.name} was consumed`);
        }

        // Show use description to player if available (before identification changes the name)
        if (success && this.hasAttribute('controlled') && this.engine.inputManager) {
            const useDescription = item.getUseDescription();
            if (useDescription) {
                this.engine.inputManager.showMessage(useDescription);
            }
        }

        // Identify the item after successful use (reveals what it does)
        if (success && !item.identified) {
            item.identify();
            const identifiedName = item.getDisplayName();
            console.log(`${this.name} identified the ${identifiedName}!`);

            // Show identification message to player (stacks with use description)
            if (this.hasAttribute('controlled') && this.engine.inputManager) {
                this.engine.inputManager.showMessage(`You identified the ${identifiedName}!`);
            }
        }

        return success;
    }

    /**
     * Execute an item's use effect
     * @param {Item} item - The item being used
     * @param {string|object} effect - The effect identifier (string) or stat modifiers (object)
     * @returns {boolean} True if effect executed successfully
     */
    executeItemEffect(item, effect) {
        // Handle object format: { "health": 20, "nutrition": 10 } for direct stat modification
        if (typeof effect === 'object') {
            let anyStatModified = false;
            for (const [statName, amount] of Object.entries(effect)) {
                if (this.stats[statName] !== undefined) {
                    // Stats are stored as { max, current } objects
                    if (typeof this.stats[statName] === 'object') {
                        const oldValue = this.stats[statName].current;
                        this.stats[statName].current = Math.min(
                            this.stats[statName].max,
                            Math.max(0, this.stats[statName].current + amount)
                        );
                        console.log(`${this.name}'s ${statName}: ${oldValue} -> ${this.stats[statName].current}`);

                        // Check for death if health dropped to 0
                        if (statName === 'health' && this.stats[statName].current <= 0) {
                            this.die();
                        }
                    } else {
                        // Simple number stat
                        this.stats[statName] += amount;
                        console.log(`${this.name}'s ${statName} modified by ${amount}`);
                    }
                    anyStatModified = true;
                } else {
                    console.log(`${this.name} has no ${statName} stat to modify`);
                }
            }
            return anyStatModified;
        }

        // Handle string format: method name for complex effects
        switch (effect) {
            default:
                console.log(`Unknown item effect: ${effect}`);
                return false;
        }
    }

    /**
     * Get all usable items in inventory (items with use_verb attribute)
     * @returns {Array<{item: Item, verb: string}>}
     */
    getUsableItems() {
        return this.inventory
            .filter(item => item.getAttribute('use_verb'))
            .map(item => ({
                item: item,
                verb: item.getAttribute('use_verb')
            }));
    }

    /**
     * Get the collision description with template substitution
     * @param {Actor} target - The actor being attacked
     * @returns {string|null} The processed description or null if none
     */
    getCollisionDescription(target) {
        const template = this.getAttribute('collision_description');
        if (!template) return null;

        let result = template.replace(/\[([^\]]+)\]/g, (match, key) => {
            // Skip [a-an] - will be processed after all other substitutions
            if (key.toLowerCase() === 'a-an') {
                return match;
            }

            // Handle attacks.category for random attack verbs
            if (key.startsWith('attacks.')) {
                const category = key.substring('attacks.'.length);
                const attacks = this.engine.globalAttacks?.[category];
                if (attacks && attacks.length > 0) {
                    return attacks[Math.floor(Math.random() * attacks.length)];
                }
                return match;
            }
            // Handle adjectives.category
            if (key.startsWith('adjectives.')) {
                const category = key.substring('adjectives.'.length);
                const adjectives = this.engine.globalAdjectives?.[category];
                if (adjectives && adjectives.length > 0) {
                    return adjectives[Math.floor(Math.random() * adjectives.length)];
                }
                return match;
            }
            // Handle special keys
            if (key === 'actor_name') {
                return this.name;
            }
            if (key === 'attacked_actor_name') {
                return target.name;
            }
            return match;
        });

        // Process [a-an] templates after all other substitutions
        return processArticleTemplates(result);
    }

    /**
     * Resolve attribute or stat references in a value string or number
     * Supports patterns like "{strength}" or "-{strength}" which get replaced with actor attribute/stat values
     * Checks stats first (including current value for object stats), then attributes
     * @param {any} value - The value to resolve (string like "-{strength}" or a number)
     * @param {Actor} sourceActor - The actor whose attributes/stats to use for resolution
     * @returns {any} - The resolved value (number if pattern matched, original value otherwise)
     */
    resolveAttributeValue(value, sourceActor) {
        if (typeof value === 'string') {
            // Match patterns like "{attr}", "-{attr}", or "+{attr}"
            const match = value.match(/^([+-]?)?\{(\w+)\}$/);
            if (match) {
                const sign = match[1] || '+';
                const name = match[2];

                // Check stats first
                if (sourceActor.stats && sourceActor.stats[name] !== undefined) {
                    const stat = sourceActor.stats[name];
                    let statValue;
                    if (typeof stat === 'object' && stat.current !== undefined) {
                        statValue = stat.current;
                    } else if (typeof stat === 'number') {
                        statValue = stat;
                    }
                    if (typeof statValue === 'number') {
                        return sign === '-' ? -statValue : statValue;
                    }
                }

                // Fall back to attributes
                const attrValue = sourceActor.getAttribute(name);
                if (typeof attrValue === 'number') {
                    return sign === '-' ? -attrValue : attrValue;
                }

                console.warn(`Stat/Attribute '${name}' not found or not a number on ${sourceActor.name}`);
                return 0;
            }
        }
        return value;
    }

    /**
     * Apply collision effects from actor or held items to a target actor
     * @param {Actor} target - The actor being collided with
     * @returns {{effectApplied: boolean, targetPassable: boolean}}
     */
    applyCollisionEffects(target) {
        let effectApplied = false;
        let targetPassable = false;
        let targetShouldDie = false;

        // Gather all effect sources: items first, then actor's own effect (unarmed)
        const sources = [];
        for (const item of this.inventory) {
            const itemEffect = item.getAttribute('collision_effect');
            if (itemEffect) {
                sources.push({
                    name: item.name,
                    effect: itemEffect,
                    sound: item.getAttribute('collision_sound'),
                    item: item,  // Include item reference for key color checking
                    lockColor: item.getAttribute('lock_color'),
                    sourceActor: this  // The actor wielding the item
                });
            }
        }
        const actorEffect = this.getAttribute('collision_effect');
        if (actorEffect) {
            sources.push({ name: this.name, effect: actorEffect, sound: this.getAttribute('collision_sound'), item: null, lockColor: null, sourceActor: this });
        }

        // Apply effects from ALL sources (stacking)
        for (const source of sources) {
            let sourceApplied = false;

            // Apply each effect in the collision_effect object
            for (const [key, rawValue] of Object.entries(source.effect)) {
                // Resolve attribute references like "{strength}" or "-{strength}"
                const value = this.resolveAttributeValue(rawValue, source.sourceActor);

                // Auto-detect: check stats first, then attributes
                // Stats priority - check if target has this as a stat
                if (target.stats && target.stats[key] !== undefined) {
                    const stat = target.stats[key];
                    if (typeof stat === 'object' && stat.current !== undefined) {
                        // Stats stored as { max, current }
                        const oldValue = stat.current;
                        stat.current = Math.max(0, stat.current + value);
                        console.log(`${source.name}: ${target.name}'s ${key} ${value >= 0 ? '+' : ''}${value} (${oldValue} -> ${stat.current})`);
                        sourceApplied = true;

                        // Mark for death after effects are shown (don't call die() yet)
                        if (key === 'health' && stat.current <= 0) {
                            targetShouldDie = true;
                            targetPassable = true;
                        }
                    } else if (typeof stat === 'number') {
                        // Simple number stat
                        target.stats[key] += value;
                        console.log(`${source.name}: ${target.name}'s ${key} ${value >= 0 ? '+' : ''}${value}`);
                        sourceApplied = true;
                    }
                    continue;
                }

                // Fall back to attributes
                const currentValue = target.getAttribute(key);

                // Handle special "toggle" value
                if (value === 'toggle') {
                    if (currentValue !== undefined) {
                        target.setAttribute(key, !currentValue);
                        console.log(`${source.name}: toggled ${target.name}'s ${key} to ${!currentValue}`);
                        sourceApplied = true;
                    }
                }
                // Handle numeric values (add/subtract)
                else if (typeof value === 'number' && typeof currentValue === 'number') {
                    const newValue = currentValue + value;
                    target.setAttribute(key, newValue);
                    console.log(`${source.name}: ${target.name}'s ${key} ${value >= 0 ? '+' : ''}${value} (now ${newValue})`);
                    sourceApplied = true;

                    // Mark for death after effects are shown (don't call die() yet)
                    if (key === 'health' && newValue <= 0) {
                        targetShouldDie = true;
                        targetPassable = true;
                    }
                }
                // Handle boolean values (set directly)
                else if (typeof value === 'boolean') {
                    // Special handling for locked attribute with color-locked doors
                    if (key === 'locked' && value === false && target.hasAttribute('color_locked')) {
                        const targetLockColor = target.getAttribute('lock_color');
                        const sourceLockColor = source.lockColor;

                        // Check if colors match
                        if (targetLockColor && sourceLockColor && targetLockColor === sourceLockColor) {
                            target.setAttribute(key, value);
                            console.log(`${source.name} (${sourceLockColor}) unlocks ${target.name} (${targetLockColor})!`);
                            sourceApplied = true;
                            target.open();
                            this.engine.updateLighting();
                            targetPassable = !target.hasAttribute('solid');

                            // Show unlock message
                            if (this.hasAttribute('controlled')) {
                                this.engine.inputManager?.showMessage(`The ${source.name} unlocks the ${targetLockColor} door!`);
                            }

                            // Consume the key if it has consumable attribute
                            if (source.item && source.item.hasAttribute('consumable')) {
                                this.inventory = this.inventory.filter(i => i !== source.item);
                                console.log(`${source.name} was consumed`);
                            }
                        } else {
                            // Wrong color - show message but don't apply effect
                            console.log(`${source.name} (${sourceLockColor || 'no color'}) doesn't match ${target.name} (${targetLockColor})`);
                            if (this.hasAttribute('controlled') && targetLockColor) {
                                this.engine.inputManager?.showMessage(`The ${targetLockColor} door requires a ${targetLockColor} key.`);
                            }
                        }
                    }
                    // Standard boolean handling for non-color-locked targets
                    else if (currentValue !== undefined) {
                        target.setAttribute(key, value);
                        console.log(`${source.name}: set ${target.name}'s ${key} to ${value}`);
                        sourceApplied = true;

                        // Check if setting locked to false should open something
                        if (key === 'locked' && value === false && target.hasAttribute('openable')) {
                            target.open();
                            this.engine.updateLighting();
                            // Door is now open, can pass through
                            targetPassable = !target.hasAttribute('solid');
                        }
                    }
                }
            }

            // Play collision sound if this source applied any effect
            if (sourceApplied) {
                effectApplied = true;
                if (source.sound) {
                    this.engine.playSound(source.sound);
                }
            }
        }

        // Flash the target for visual feedback if any effect was applied
        if (effectApplied && target.flash) {
            target.flash();
        }

        // Show collision description if any effect was applied
        if (effectApplied) {
            const description = this.getCollisionDescription(target);
            if (description) {
                this.engine.inputManager?.showMessage(description);
            }
        }

        // Now trigger death after collision description is shown
        if (targetShouldDie) {
            target.die();
        }

        return { effectApplied, targetPassable };
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
     * Check if an actor can be pushed to a position
     * @param {number} x - Target X coordinate
     * @param {number} y - Target Y coordinate
     * @returns {boolean} True if position is valid for pushing
     */
    canPushTo(x, y) {
        // Check bounds
        if (x < 0 || x >= this.engine.mapManager.width ||
            y < 0 || y >= this.engine.mapManager.height) {
            return false;
        }

        // Check for floor
        if (!this.hasFloorAt(x, y)) {
            return false;
        }

        // Check for walls don't need this since all walls in play are actors
        /* const wallTile = this.engine.mapManager.wallMap[y][x];
        if (wallTile !== null) {
            return false;
        } */

        // Check for blocking actors
        const actorAt = this.engine.entityManager.getActorAt(x, y);
        if (actorAt && actorAt.hasAttribute('solid')) {
            return false;
        }

        return true;
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

        // Show fall message
        if (this.hasAttribute('controlled')) {
            this.engine.inputManager?.showMessage(`You plunge into the depths!`);
        } else if (this.hasAttribute('visible')) {
            this.engine.inputManager?.showMessage(`The ${this.name} falls into the void.`);
        }

        this.dropItems(true); // Items lost to void
        this.die(false); // Don't spawn remains when falling into void
    }

    /**
     * Drop all inventory items when actor dies or is removed
     * @param {boolean} destroyItems - If true, items are lost (fell into void)
     */
    dropItems(destroyItems = false) {
        if (this.inventory.length === 0) return;

        // Unequip all items first
        for (const slot of ['top', 'middle', 'lower']) {
            if (this.equipment[slot]) {
                this.unequipFromSlot(slot);
            }
        }

        if (destroyItems) {
            console.log(`${this.name}'s items were lost to the void`);
            this.inventory = [];
            return;
        }

        // Find valid floor tiles around the actor (current tile + 8 neighbors)
        const dropPositions = [];
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const tx = this.x + dx;
                const ty = this.y + dy;
                if (this.hasFloorAt(tx, ty)) {
                    dropPositions.push({ x: tx, y: ty });
                }
            }
        }

        if (dropPositions.length === 0) {
            console.log(`${this.name}'s items were lost - no valid drop location`);
            this.inventory = [];
            return;
        }

        // Drop items to available positions (skip items with drop: false)
        let posIndex = 0;
        for (const item of this.inventory) {
            if (item.getAttribute('drop') === false) {
                console.log(`${item.name} was not dropped (drop: false)`);
                continue;
            }
            const pos = dropPositions[posIndex % dropPositions.length];
            item.x = pos.x;
            item.y = pos.y;
            this.engine.entityManager.addEntity(item);
            console.log(`${item.name} dropped at (${pos.x}, ${pos.y})`);
            posIndex++;
        }

        this.inventory = [];
    }

    // Movement methods
    /**
     * Attempt to move to a new position
     * @param {number} newX - Target X coordinate
     * @param {number} newY - Target Y coordinate
     * @returns {{moved: boolean, actionTaken: boolean}} moved=position changed, actionTaken=turn should be consumed
     */
    tryMove(newX, newY) {
        // Hide walk path highlight when player moves
        this.engine.renderer?.hideWalkPath();

        // Check bounds
        if (newX < 0 || newX >= this.engine.mapManager.width ||
            newY < 0 || newY >= this.engine.mapManager.height) {
            return { moved: false, actionTaken: false };
        }

        // Check for blocking actors
        const actorAtTarget = this.engine.entityManager.getActorAt(newX, newY);
        if (actorAtTarget && actorAtTarget.hasAttribute('solid')) {
            // Check if actor can be pushed
            if (actorAtTarget.hasAttribute('pushable')) {
                const dx = newX - this.x;
                const dy = newY - this.y;
                const pushX = newX + dx;
                const pushY = newY + dy;

                // Check if the push destination is valid
                const canPush = this.canPushTo(pushX, pushY);
                if (canPush) {
                    // Push the actor
                    actorAtTarget.x = pushX;
                    actorAtTarget.y = pushY;
                    actorAtTarget.updateSpritePosition();
                    console.log(`${this.name} pushes ${actorAtTarget.name}`);
                    this.engine.playSound('push1');
                    // Show push message if player is pushing
                    if (this.hasAttribute('controlled')) {
                        this.engine.inputManager?.showMessage(`You push the ${actorAtTarget.name}.`);
                    }

                    // Now move into the vacated space
                    this.x = newX;
                    this.y = newY;
                    this.updateSpritePosition();

                    // Update lighting if needed
                    if (this.hasAttribute('controlled') || this.hasAttribute('light_source')) {
                        this.engine.updateLighting();
                    }

                    return { moved: true, actionTaken: true };
                }
                // Can't push - fall through to normal blocking behavior
            }

            // Apply collision effects from held items
            const collisionResult = this.applyCollisionEffects(actorAtTarget);

            // If collision effects made the actor passable, try again
            if (collisionResult.targetPassable) {
                // Recurse to check if we can now move
                return this.tryMove(newX, newY);
            }

            // Check if actor can be opened (doors, chests, etc.)
            if (actorAtTarget.hasAttribute('openable') && !actorAtTarget.hasAttribute('open')) {
                // Check if locked - play tap sound and block
                if (actorAtTarget.hasAttribute('locked')) {
                    console.log(`${actorAtTarget.name} is locked`);
                    this.engine.playSound?.('tap1');
                    if (this.hasAttribute('controlled')) {
                        this.engine.inputManager?.showMessage(`The ${actorAtTarget.name} is locked.`);
                    }
                    return { moved: false, actionTaken: false };
                }
                actorAtTarget.open();
                this.engine.updateLighting();
                return { moved: false, actionTaken: true };
            }

            // Check for collision_description attribute (for locked stairways, etc.)
            if (this.hasAttribute('controlled') && actorAtTarget.hasAttribute('collision_description')) {
                this.engine.inputManager?.showMessage(actorAtTarget.getAttribute('collision_description'));
                return { moved: false, actionTaken: true };
            }

            if (!collisionResult.effectApplied) {
                console.log(`${this.name} blocked by ${actorAtTarget.name}`);
            }
            // Effect applied = action taken (attack), even though we didn't move
            return { moved: false, actionTaken: collisionResult.effectApplied };
        }

        // Check for floor tile - if no floor, actor falls
        if (!this.hasFloorAt(newX, newY)) {
            // Move to the void tile first (so we can see them fall)
            this.x = newX;
            this.y = newY;
            this.updateSpritePosition();
            this.fall();
            return { moved: true, actionTaken: true }; // Move happened, actor just died
        }

        // Move successful - track last position for notable event detection
        this._lastPosition = { x: this.x, y: this.y };
        this.x = newX;
        this.y = newY;
        this.updateSpritePosition();

        // Check for items to pick up
        const itemAtTarget = this.engine.entityManager.getItemAt(newX, newY);
        if (itemAtTarget && itemAtTarget.hasAttribute('pickupable')) {
            this.pickUpItem(itemAtTarget);
        }

        // Check for entity walk descriptions (only for player-controlled actors)
        if (this.hasAttribute('controlled')) {
            const entityAtTarget = this.engine.entityManager.getEntityAt(newX, newY);
            if (entityAtTarget && entityAtTarget.hasAttribute('walk_description')) {
                this.engine.inputManager?.showMessage(entityAtTarget.getAttribute('walk_description'));
            }
        }

        // Check for stairway actors (only for player-controlled actors)
        if (this.hasAttribute('controlled')) {
            const stairway = this.engine.entityManager.getOtherActorAt(newX, newY, this);
            if (stairway && stairway.hasAttribute('stairway')) {
                const direction = stairway.getAttribute('stairway');

                // Lock the turn engine to prevent further actions during transition
                if (this.engine.turnEngine) {
                    this.engine.turnEngine.lock();
                }
                this.engine.useStairway(direction);
                return { moved: true, actionTaken: true }; // Exit early, transition handles everything
            }
        }

        // Update lighting if this actor affects it
        if (this.hasAttribute('controlled') || this.hasAttribute('light_source')) {
            this.engine.updateLighting();
        }

        // Check for submersion in deep liquids
        this.updateSubmersionState();

        // Notify interface of player move (for dismissOnMove text boxes)
        if (this.hasAttribute('controlled') && this.engine.interfaceManager) {
            this.engine.interfaceManager.onPlayerMove();
        }

        // Check for entry sound from non-solid actors at destination (for controlled actors)
        let entrySound = null;
        if (this.hasAttribute('controlled')) {
            const actorAtTarget = this.engine.entityManager.getOtherActorAt(newX, newY, this);
            if (actorAtTarget && !actorAtTarget.hasAttribute('solid') && actorAtTarget.hasAttribute('entry_sound')) {
                entrySound = actorAtTarget.getAttribute('entry_sound');
            }
        }

        return { moved: true, actionTaken: true, entrySound };
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
        // Update equipment sprite positions
        // top: above actor's top tile (y - 2)
        if (this.spriteEquipment.top) {
            this.spriteEquipment.top.x = this.x * globalVars.TILE_WIDTH;
            this.spriteEquipment.top.y = (this.y - 2) * globalVars.TILE_HEIGHT;
        }
        // middle: on actor's top tile (y - 1)
        if (this.spriteEquipment.middle) {
            this.spriteEquipment.middle.x = this.x * globalVars.TILE_WIDTH;
            this.spriteEquipment.middle.y = (this.y - 1) * globalVars.TILE_HEIGHT;
        }
        // lower: on actor's base tile (y)
        if (this.spriteEquipment.lower) {
            this.spriteEquipment.lower.x = this.x * globalVars.TILE_WIDTH;
            this.spriteEquipment.lower.y = this.y * globalVars.TILE_HEIGHT;
        }
    }

    /**
     * Flash the actor's sprites with color inversion for visual feedback
     * @param {number} duration - Duration of flash in milliseconds (default 100)
     */
    flash(duration = 100) {
        // Create invert color matrix filter
        const invertFilter = new PIXI.filters.ColorMatrixFilter();
        invertFilter.negative();

        // Collect all sprites to flash
        const sprites = [];
        if (this.spriteBase) sprites.push(this.spriteBase);
        if (this.spriteTop) sprites.push(this.spriteTop);
        if (this.spriteEquipment.top) sprites.push(this.spriteEquipment.top);
        if (this.spriteEquipment.middle) sprites.push(this.spriteEquipment.middle);
        if (this.spriteEquipment.lower) sprites.push(this.spriteEquipment.lower);

        // Apply filter to all sprites
        for (const sprite of sprites) {
            sprite.filters = sprite.filters ? [...sprite.filters, invertFilter] : [invertFilter];
        }

        // Remove filter after duration
        setTimeout(() => {
            for (const sprite of sprites) {
                if (sprite.filters) {
                    sprite.filters = sprite.filters.filter(f => f !== invertFilter);
                    if (sprite.filters.length === 0) sprite.filters = null;
                }
            }
        }, duration);
    }

    /**
     * Check if there's a deep actor at the given position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {Actor|null} The deep actor at position, or null
     */
    getDeepActorAt(x, y) {
        const actors = this.engine.entityManager.actors.filter(
            a => a.x === x && a.y === y &&
                 !a.isDead &&
                 !a.hasAttribute('solid') &&
                 a.hasAttribute('deep')
        );
        return actors.length > 0 ? actors[0] : null;
    }

    /**
     * Submerge this actor (when entering a deep tile)
     * Base sprite shows the top tile texture, top sprite becomes invisible
     * @param {Actor} deepActor - The deep actor we're submerging in
     */
    submerge(deepActor) {
        if (this.isSubmerged) return;

        this.isSubmerged = true;
        this.submergedIn = deepActor;

        // Store original textures for restoration
        if (this.spriteBase) {
            this._originalBaseTexture = this.spriteBase.texture;
        }
        if (this.spriteTop) {
            this._originalTopTexture = this.spriteTop.texture;
            this._originalTopVisible = this.spriteTop.visible;
        }

        // Move top texture to base position (head now at floor level)
        if (this.spriteTop && this.spriteBase) {
            this.spriteBase.texture = this.spriteTop.texture;
        }

        // Hide top sprite
        if (this.spriteTop) {
            this.spriteTop.visible = false;
        }

        // Hide equipment sprites (they're underwater)
        for (const slot of ['top', 'middle', 'lower']) {
            if (this.spriteEquipment[slot]) {
                this[`_originalEquipment${slot}Visible`] = this.spriteEquipment[slot].visible;
                this.spriteEquipment[slot].visible = false;
            }
        }

        // If this is the player, apply canvas tinting and show message
        if (this.hasAttribute('controlled') && deepActor) {
            this.engine.renderer?.applySubmersionTint(deepActor.tint);
            this.engine.inputManager?.showMessage(`You are submerged in the ${deepActor.name}!`);
        }

        console.log(`${this.name} submerges in ${deepActor?.name || 'deep liquid'}`);
    }

    /**
     * Emerge from submersion (when exiting a deep tile)
     */
    emerge() {
        if (!this.isSubmerged) return;

        // Restore original base texture
        if (this.spriteBase && this._originalBaseTexture) {
            this.spriteBase.texture = this._originalBaseTexture;
        }

        // Restore and show top sprite
        if (this.spriteTop) {
            if (this._originalTopTexture) {
                this.spriteTop.texture = this._originalTopTexture;
            }
            this.spriteTop.visible = this._originalTopVisible !== false;
        }

        // Restore equipment sprite visibility
        for (const slot of ['top', 'middle', 'lower']) {
            if (this.spriteEquipment[slot] && this[`_originalEquipment${slot}Visible`] !== undefined) {
                this.spriteEquipment[slot].visible = this[`_originalEquipment${slot}Visible`];
            }
        }

        // If this is the player, remove canvas tinting
        if (this.hasAttribute('controlled')) {
            this.engine.renderer?.removeSubmersionTint();
        }

        console.log(`${this.name} emerges from ${this.submergedIn?.name || 'deep liquid'}`);

        this.isSubmerged = false;
        this.submergedIn = null;
        this._originalBaseTexture = null;
        this._originalTopTexture = null;
        this._originalTopVisible = null;
    }

    /**
     * Check and update submersion state based on current position
     */
    updateSubmersionState() {
        const deepActor = this.getDeepActorAt(this.x, this.y);

        if (deepActor && !this.isSubmerged) {
            this.submerge(deepActor);
        } else if (!deepActor && this.isSubmerged) {
            this.emerge();
        }
    }

    /**
     * Check if this actor can see the target (distance + line-of-sight check)
     * @param {Entity} target - The target to check visibility for
     * @returns {boolean} True if target is within vision range and has clear line of sight
     */
    canSeeTarget(target) {
        if (!target) return false;

        // First check distance
        const distance = getEuclideanDistance(this.x, this.y, target.x, target.y);
        if (distance > this.visionRange) return false;

        // Then check actual line of sight
        const isBlocked = (x, y) => {
            // Check if tile blocks vision (walls, solid actors)
            if (!this.hasFloorAt(x, y)) return true;

            // Check for solid actors at this position (but not self or target)
            const actorAt = this.engine.entityManager.getActorAt(x, y);
            if (actorAt && actorAt !== this && actorAt !== target && actorAt.hasAttribute('solid')) {
                return true;
            }

            return false;
        };

        return hasLineOfSight(this.x, this.y, target.x, target.y, isBlocked);
    }

    /**
     * Check if a tile is passable for pathfinding purposes
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean} True if the tile can be walked through
     */
    isPassableAt(x, y) {
        // Check bounds
        if (x < 0 || x >= this.engine.mapManager.width ||
            y < 0 || y >= this.engine.mapManager.height) {
            return false;
        }

        // Check for floor
        if (!this.hasFloorAt(x, y)) return false;

        // Check for solid actors (but allow the actor's own position)
        const actorAt = this.engine.entityManager.getActorAt(x, y);
        if (actorAt && actorAt !== this && actorAt.hasAttribute('solid')) {
            return false;
        }

        return true;
    }

    /**
     * Move toward a target position using A* pathfinding
     * Falls back to simple directional movement if no path found
     * @param {number} targetX - Target X coordinate
     * @param {number} targetY - Target Y coordinate
     * @returns {boolean} True if movement was attempted
     */
    moveToward(targetX, targetY) {
        // Already at target
        if (this.x === targetX && this.y === targetY) return false;

        // Create passability callback for pathfinding
        const isPassable = (x, y) => {
            // Target position is always considered passable (we want to reach it)
            if (x === targetX && y === targetY) return true;
            return this.isPassableAt(x, y);
        };

        // Try A* pathfinding first
        const nextStep = getNextPathStep(this.x, this.y, targetX, targetY, isPassable);

        if (nextStep) {
            // Found a path - try to move to next step
            const result = this.tryMove(nextStep.x, nextStep.y);
            return result.moved || result.actionTaken;
        }

        // No path found - fall back to simple directional movement
        // This handles cases where target is unreachable but we want to get closer
        const dx = Math.sign(targetX - this.x);
        const dy = Math.sign(targetY - this.y);

        // Try to move in both directions, prefer the larger distance
        if (Math.abs(targetX - this.x) > Math.abs(targetY - this.y)) {
            if (dx !== 0) {
                const result = this.tryMove(this.x + dx, this.y);
                if (result.moved || result.actionTaken) return true;
            }
            if (dy !== 0) {
                const result = this.tryMove(this.x, this.y + dy);
                if (result.moved || result.actionTaken) return true;
            }
        } else {
            if (dy !== 0) {
                const result = this.tryMove(this.x, this.y + dy);
                if (result.moved || result.actionTaken) return true;
            }
            if (dx !== 0) {
                const result = this.tryMove(this.x + dx, this.y);
                if (result.moved || result.actionTaken) return true;
            }
        }

        // Try diagonal movement as last resort
        if (dx !== 0 && dy !== 0) {
            const result = this.tryMove(this.x + dx, this.y + dy);
            if (result.moved || result.actionTaken) return true;
        }

        return false;
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
    /**
     * Attack an adjacent hostile target (player or enemy faction)
     * Returns true if an attack was made
     */
    attack_adjacent: (actor) => {
        // Check all adjacent tiles (8-directional)
        const directions = [
            {dx: -1, dy: -1}, {dx: 0, dy: -1}, {dx: 1, dy: -1},
            {dx: -1, dy: 0},                   {dx: 1, dy: 0},
            {dx: -1, dy: 1},  {dx: 0, dy: 1},  {dx: 1, dy: 1}
        ];

        for (const dir of directions) {
            const targetX = actor.x + dir.dx;
            const targetY = actor.y + dir.dy;
            const target = actor.engine.entityManager.getActorAt(targetX, targetY);

            // Check if target is valid - only attack controlled actors (players, allies)
            if (!target || target.isDead || !target.hasAttribute('controlled')) continue;

            // Use unified collision effects system (handles damage, sounds, flash, etc.)
            const result = actor.applyCollisionEffects(target);

            if (result.effectApplied) {
                return true; // Attack was made
            }
        }

        return false; // No valid target found
    },

    /**
     * Patrol between waypoints (placeholder)
     */
    patrol: (actor, data) => {
        // TODO: Implement waypoint patrol
        return false;
    },

    /**
     * Pursue a visible target using A* pathfinding
     */
    pursue_target: (actor, data) => {
        // Find and move toward target
        const target = actor.engine.entityManager.findNearestPlayer(actor);
        if (target && actor.canSeeTarget(target)) {
            return actor.moveToward(target.x, target.y);
        }
        return false;
    },

    /**
     * Random wandering movement
     */
    random_walk: (actor) => {
        // Sighted actors only consider valid moves (avoids pits, walls, etc.)
        if (actor.hasAttribute('sighted')) {
            const validDirs = actor.getValidMoveDirections();
            if (validDirs.length === 0) {
                return false; // No valid moves available
            }
            const dir = validDirs[Math.floor(Math.random() * validDirs.length)];
            const result = actor.tryMove(actor.x + dir.dx, actor.y + dir.dy);
            return result.moved || result.actionTaken;
        }

        // Non-sighted actors pick randomly (may fall into pits)
        const directions = [
            {dx: -1, dy: 0}, {dx: 1, dy: 0},
            {dx: 0, dy: -1}, {dx: 0, dy: 1}
        ];
        const dir = directions[Math.floor(Math.random() * directions.length)];
        const result = actor.tryMove(actor.x + dir.dx, actor.y + dir.dy);
        return result.moved || result.actionTaken;
    },

    /**
     * Flee from nearby threats
     */
    flee_from_danger: (actor, data) => {
        const fleeDistance = data.flee_threshold || 3;
        const player = actor.engine.entityManager.player;

        if (!player || player.isDead) return false;

        const distance = getChebyshevDistance(actor.x, actor.y, player.x, player.y);

        // Only flee if player is within flee threshold
        if (distance > fleeDistance) return false;

        // Move away from the player
        const dx = Math.sign(actor.x - player.x);
        const dy = Math.sign(actor.y - player.y);

        // Try to move directly away
        if (dx !== 0 && dy !== 0) {
            const result = actor.tryMove(actor.x + dx, actor.y + dy);
            if (result.moved || result.actionTaken) return true;
        }
        if (dx !== 0) {
            const result = actor.tryMove(actor.x + dx, actor.y);
            if (result.moved || result.actionTaken) return true;
        }
        if (dy !== 0) {
            const result = actor.tryMove(actor.x, actor.y + dy);
            if (result.moved || result.actionTaken) return true;
        }

        // Try perpendicular movement as escape
        let result = actor.tryMove(actor.x + dy, actor.y + dx);
        if (result.moved || result.actionTaken) return true;
        result = actor.tryMove(actor.x - dy, actor.y - dx);
        if (result.moved || result.actionTaken) return true;

        return false;
    },

    /**
     * Incinerate any entities (actors or items) sharing this actor's tile
     * Spawns a replacement actor (e.g., fire) in their place
     */
    incinerate_entities: (actor, data) => {
        const entityManager = actor.engine.entityManager;
        const spawnType = data.spawn_on_incinerate || 'fire';
        const liquidSpawnType = data.spawn_on_liquid_incinerate || 'smoke';
        let incinerated = false;

        // Find other actors at this position
        for (const other of entityManager.actors) {
            if (other === actor) continue;
            if (other.isDead) continue;
            if (other.x !== actor.x || other.y !== actor.y) continue;

            const isSolid = other.hasAttribute('solid');
            const isLiquid = other.hasAttribute('liquid');

            // Only incinerate solid actors or liquids
            if (!isSolid && !isLiquid) continue;

            console.log(`${actor.name} incinerates ${other.name}!`);

            // Show incineration message for visible actors
            if (other.hasAttribute('visible')) {
                const otherName = other.hasAttribute('mass_noun') ? other.name : `the ${other.name}`;
                actor.engine.inputManager?.showMessage(`The ${actor.name} incinerates ${otherName}!`);
            }

            other.die();

            // Spawn replacement actor - smoke for liquids, fire for solids
            if (isLiquid && liquidSpawnType) {
                entityManager.spawnActor(liquidSpawnType, other.x, other.y);
                actor.engine.playSound?.('match');
            } else if (isSolid && spawnType) {
                entityManager.spawnActor(spawnType, other.x, other.y);
                actor.engine.playSound?.('fireball');
            }

            incinerated = true;
        }

        // Find items at this position
        const itemsAtPosition = entityManager.items.filter(
            item => item.x === actor.x && item.y === actor.y
        );

        for (const item of itemsAtPosition) {
            // Only incinerate flammable items
            if (!item.hasAttribute('flammable')) continue;

            console.log(`${actor.name} incinerates ${item.name}!`);

            // Show incineration message for visible items
            if (item.hasAttribute('visible')) {
                const displayName = item.getDisplayName ? item.getDisplayName() : item.name;
                const article = actor.engine.inputManager?.getIndefiniteArticle(displayName) || 'a';
                actor.engine.inputManager?.showMessage(`The ${actor.name} incinerates ${article} ${displayName}!`);
            }

            entityManager.removeEntity(item);
            incinerated = true;
        }

        return incinerated;
    },

    /**
     * Cloud spreading behavior - gradually expands to fill an area
     * Uses actor's spreadTurnsRemaining and origin position
     */
    cloud_spread: (actor, data) => {
        // Only the origin cloud spreads
        if (!actor.isCloudOrigin) return false;

        // Initialize spread tracking on first call
        if (actor.spreadTurnsRemaining === undefined) {
            actor.spreadTurnsRemaining = data.spread_turns || 4;
            actor.currentSpreadDistance = 0;
        }

        if (actor.spreadTurnsRemaining <= 0) return false;

        actor.spreadTurnsRemaining--;
        actor.currentSpreadDistance++;

        const spreadRadius = data.spread_radius || 2;
        const entityManager = actor.engine.entityManager;

        // Don't spawn beyond spread radius
        if (actor.currentSpreadDistance > spreadRadius) return false;

        // Spread to tiles at the current distance from origin
        const directions = [
            {dx: -1, dy: -1}, {dx: 0, dy: -1}, {dx: 1, dy: -1},
            {dx: -1, dy: 0},                   {dx: 1, dy: 0},
            {dx: -1, dy: 1},  {dx: 0, dy: 1},  {dx: 1, dy: 1}
        ];

        // Get the origin cloud's lifetime (initialize if needed)
        if (actor.cloudLifetime === undefined) {
            actor.cloudLifetime = actor.lifetime || 10;
        }

        for (const dir of directions) {
            const targetX = actor.cloudOriginX + dir.dx * actor.currentSpreadDistance;
            const targetY = actor.cloudOriginY + dir.dy * actor.currentSpreadDistance;

            // Check if tile is valid (has floor, not a wall)
            const floorTile = actor.engine.mapManager?.floorMap[targetY]?.[targetX];
            if (!floorTile || floorTile.tileId <= 0) continue;

            // Check if there's already a cloud at this position
            const existingCloud = entityManager.actors.find(
                a => a.x === targetX && a.y === targetY && a.type === 'cloud' && !a.isDead
            );
            if (existingCloud) continue;

            // Spawn a new cloud at this position
            const newCloud = entityManager.spawnActor('cloud', targetX, targetY);
            if (newCloud) {
                // Copy properties from origin cloud
                newCloud.tint = actor.tint;
                newCloud.setAttribute('collision_effect', actor.getAttribute('collision_effect'));
                // Give spawned clouds the same remaining lifetime as the origin
                newCloud.cloudLifetime = actor.cloudLifetime;
                // Update sprites with new tint
                if (newCloud.spriteBase) newCloud.spriteBase.tint = actor.tint;
                if (newCloud.spriteTop) newCloud.spriteTop.tint = actor.tint;
            }
        }

        return true;
    },

    /**
     * Apply cloud's collision effect to any actors standing in it
     */
    cloud_affect_actors: (actor) => {
        const collisionEffect = actor.getAttribute('collision_effect');
        if (!collisionEffect || Object.keys(collisionEffect).length === 0) return false;

        const entityManager = actor.engine.entityManager;

        // Find actors at this position
        for (const other of entityManager.actors) {
            if (other === actor) continue;
            if (other.isDead) continue;
            if (other.x !== actor.x || other.y !== actor.y) continue;
            if (other.type === 'cloud') continue; // Don't affect other clouds

            // Apply collision effect
            for (const [key, value] of Object.entries(collisionEffect)) {
                if (other.stats && other.stats[key] !== undefined) {
                    const stat = other.stats[key];
                    if (typeof stat === 'object' && stat.current !== undefined) {
                        stat.current = Math.max(0, stat.current + value);
                        if (key === 'health' && stat.current <= 0) {
                            other.die();
                        }
                    }
                }
            }

            // Flash the affected actor
            other.flash?.();
        }

        return false; // Don't stop other behaviors
    },

    /**
     * Countdown cloud lifetime and remove when expired
     */
    cloud_lifetime: (actor) => {
        // Initialize lifetime from actor data if not set
        if (actor.cloudLifetime === undefined) {
            actor.cloudLifetime = actor.lifetime || 5;
        }

        actor.cloudLifetime--;

        if (actor.cloudLifetime <= 0) {
            actor.die();
            return true;
        }

        return false;
    },

    /**
     * Cellular automata transformation behavior
     * Checks if neighbors match a condition and transforms this actor into another type
     *
     * Data parameters:
     * - neighbor_type: The actor type to check for in neighbors (e.g., "sewage")
     * - neighbor_count: Minimum number of matching neighbors required (default: 4, meaning all cardinal directions)
     * - transform_to: The actor type to transform into (e.g., "deep_sewage")
     * - check_cardinal: If true, only check 4 cardinal directions; if false, check all 8 (default: true)
     */
    cellular_transform: (actor, data) => {
        const neighborType = data.neighbor_type || actor.type;
        const requiredCount = data.neighbor_count ?? 4;
        const transformTo = data.transform_to;
        const checkCardinal = data.check_cardinal !== false;

        if (!transformTo) {
            console.warn('cellular_transform: no transform_to specified');
            return false;
        }

        // Don't transform if already the target type
        if (actor.type === transformTo) return false;

        const directions = checkCardinal
            ? [{dx: 0, dy: -1}, {dx: 0, dy: 1}, {dx: -1, dy: 0}, {dx: 1, dy: 0}]
            : [
                {dx: -1, dy: -1}, {dx: 0, dy: -1}, {dx: 1, dy: -1},
                {dx: -1, dy: 0},                   {dx: 1, dy: 0},
                {dx: -1, dy: 1},  {dx: 0, dy: 1},  {dx: 1, dy: 1}
            ];

        const entityManager = actor.engine.entityManager;
        let matchingNeighbors = 0;

        for (const dir of directions) {
            const checkX = actor.x + dir.dx;
            const checkY = actor.y + dir.dy;

            // Find actors at this position that match the neighbor type
            const neighbor = entityManager.actors.find(
                a => a.x === checkX && a.y === checkY &&
                     !a.isDead &&
                     (a.type === neighborType || a.type === transformTo)
            );

            if (neighbor) {
                matchingNeighbors++;
            }
        }

        // Check if we have enough matching neighbors to transform
        if (matchingNeighbors >= requiredCount) {
            const x = actor.x;
            const y = actor.y;

            // Remove the current actor
            actor.die();

            // Spawn the transformed actor
            const newActor = entityManager.spawnActor(transformTo, x, y);
            if (newActor) {
                console.log(`${neighborType} at (${x}, ${y}) transformed into ${transformTo} (${matchingNeighbors} neighbors)`);
            }

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
        // Track which actor/item types are placed in the map
        const placedActorTypes = new Set();
        const placedItemTypes = new Set();

        // Process object layers from Tiled map if available
        if (this.engine.mapManager.objectLayers) {
            for (const layer of this.engine.mapManager.objectLayers) {
                if (layer.name === 'actors') {
                    this.spawnActorsFromLayer(layer, entryDirection, placedActorTypes);
                } else if (layer.name === 'items') {
                    this.spawnItemsFromLayer(layer, placedItemTypes);
                }
            }
        }

        // Spawn unplaced actors/items from prototype's actors.json and items.json
        this.spawnUnplacedEntities(placedActorTypes, placedItemTypes);

        console.log(`Entities spawned: ${this.actors.length} actors, ${this.items.length} items`);
    }

    /**
     * Run cellular automata behaviors once to pre-calculate initial state
     * This allows things like sewage pooling to be calculated at load time
     * @param {number} [steps=1] - Number of simulation steps to run
     */
    runCellularAutomataStep(steps = 1) {
        for (let step = 0; step < steps; step++) {
            // Get all actors with cellular_transform behavior
            // We need to collect transformations first, then apply them to avoid order-dependent issues
            const transformations = [];

            for (const actor of this.actors) {
                if (actor.isDead) continue;
                if (!actor.personality) continue;

                // Check if this actor has cellular_transform behavior
                const hasCellularBehavior = actor.personality.behaviors?.includes('cellular_transform');
                if (!hasCellularBehavior) continue;

                const data = actor.personality.data || {};
                const neighborType = data.neighbor_type || actor.type;
                const requiredCount = data.neighbor_count ?? 4;
                const transformTo = data.transform_to;
                const checkCardinal = data.check_cardinal !== false;

                if (!transformTo || actor.type === transformTo) continue;

                const directions = checkCardinal
                    ? [{dx: 0, dy: -1}, {dx: 0, dy: 1}, {dx: -1, dy: 0}, {dx: 1, dy: 0}]
                    : [
                        {dx: -1, dy: -1}, {dx: 0, dy: -1}, {dx: 1, dy: -1},
                        {dx: -1, dy: 0},                   {dx: 1, dy: 0},
                        {dx: -1, dy: 1},  {dx: 0, dy: 1},  {dx: 1, dy: 1}
                    ];

                let matchingNeighbors = 0;

                for (const dir of directions) {
                    const checkX = actor.x + dir.dx;
                    const checkY = actor.y + dir.dy;

                    const neighbor = this.actors.find(
                        a => a.x === checkX && a.y === checkY &&
                             !a.isDead &&
                             (a.type === neighborType || a.type === transformTo)
                    );

                    if (neighbor) {
                        matchingNeighbors++;
                    }
                }

                if (matchingNeighbors >= requiredCount) {
                    transformations.push({
                        actor,
                        x: actor.x,
                        y: actor.y,
                        transformTo
                    });
                }
            }

            // Apply all transformations
            for (const t of transformations) {
                // Remove the old actor (without triggering death effects)
                this.removeEntity(t.actor);

                // Spawn the new actor
                const newActor = this.spawnActor(t.transformTo, t.x, t.y);
                if (newActor) {
                    console.log(`Initial CA: ${t.actor.type} at (${t.x}, ${t.y}) -> ${t.transformTo}`);
                }
            }

            if (transformations.length > 0) {
                console.log(`Cellular automata step ${step + 1}: ${transformations.length} transformations`);
            }
        }
    }

    /**
     * Spawn actors and items that are defined in the prototype folder but not placed in the map
     * Only considers prototype-specific actors/items, not global defaults from data/
     * @param {Set} placedActorTypes - Actor types already placed from the map
     * @param {Set} placedItemTypes - Item types already placed from the map
     */
    spawnUnplacedEntities(placedActorTypes, placedItemTypes) {
        const prototype = this.engine.currentPrototype;
        if (!prototype) return;

        const walkableTiles = this.engine.mapManager.walkableTiles;
        if (!walkableTiles || walkableTiles.length === 0) {
            console.warn('No walkable tiles available for spawning unplaced entities');
            return;
        }

        // Get list of tiles not occupied by actors
        const getAvailableTiles = () => {
            const occupied = new Set();
            for (const actor of this.actors) {
                occupied.add(`${actor.x},${actor.y}`);
            }
            return walkableTiles.filter(t => !occupied.has(`${t.x},${t.y}`));
        };

        // Types to skip - these are structural or special and shouldn't be randomly spawned
        const skipActorTypes = new Set(['player', 'wall', 'door', 'stairway_up', 'stairway_down']);

        // Spawn unplaced actors (only prototype-specific ones)
        for (const actorType of prototype.prototypeActorTypes || []) {
            if (placedActorTypes.has(actorType)) continue;
            if (skipActorTypes.has(actorType)) continue;

            const actorData = prototype.getActorData(actorType);
            if (!actorData) continue;

            // Spawn 1-3 of each unplaced actor type
            const count = Math.floor(Math.random() * 3) + 1;
            const availableTiles = getAvailableTiles();

            for (let i = 0; i < count && availableTiles.length > 0; i++) {
                const tileIndex = Math.floor(Math.random() * availableTiles.length);
                const tile = availableTiles.splice(tileIndex, 1)[0];

                const actor = new Actor(tile.x, tile.y, actorType, actorData, this.engine);
                this.addEntity(actor);
                actor.loadDefaultItems();

                console.log(`Randomly spawned ${actorType} at (${tile.x}, ${tile.y})`);
            }
        }

        // Spawn unplaced items (only prototype-specific ones)
        for (const itemType of prototype.prototypeItemTypes || []) {
            if (placedItemTypes.has(itemType)) continue;

            const itemData = prototype.getItemData(itemType);
            if (!itemData) continue;

            // Spawn 1-3 of each unplaced item type
            const count = Math.floor(Math.random() * 3) + 1;
            const availableTiles = getAvailableTiles();

            for (let i = 0; i < count && availableTiles.length > 0; i++) {
                const tileIndex = Math.floor(Math.random() * availableTiles.length);
                const tile = availableTiles.splice(tileIndex, 1)[0];

                const item = new Item(tile.x, tile.y, itemType, itemData, this.engine);
                this.addEntity(item);

                console.log(`Randomly spawned ${itemType} at (${tile.x}, ${tile.y})`);
            }
        }
    }
    
    spawnActorsFromLayer(layer, entryDirection = null, placedActorTypes = null) {
        console.log(`Processing actors layer with ${layer.objects.length} objects`);

        for (const obj of layer.objects) {
            // Get actor type from Tiled's class property (newer) or type property (older), then name as fallback
            let actorType = obj.class || obj.type || obj.name;

            if (!actorType) {
                console.warn('Object has no class, type, or name, skipping:', obj);
                continue;
            }

            // Track that this actor type was placed in the map
            if (placedActorTypes) {
                placedActorTypes.add(actorType);
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

            // Load any default items for this actor
            actor.loadDefaultItems();

            console.log(`Spawned ${actorType} at tile (${tileX}, ${tileY}) from pixel (${obj.x}, ${obj.y})`);
        }
    }
    
    spawnItemsFromLayer(layer, placedItemTypes = null) {
        console.log(`Processing items layer with ${layer.objects.length} objects`);

        for (const obj of layer.objects) {
            // Get item type from Tiled's class property (newer) or type property (older), then name as fallback
            const itemType = obj.class || obj.type || obj.name;
            if (!itemType) continue;

            // Track that this item type was placed in the map
            if (placedItemTypes) {
                placedItemTypes.add(itemType);
            }

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
            // Create sprite for dynamically added items
            if (this.engine.renderer) {
                this.engine.renderer.createItemSprite(entity);
            }
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
        // Clean up equipment sprites
        if (entity.spriteEquipment) {
            for (const slot of ['top', 'middle', 'lower']) {
                if (entity.spriteEquipment[slot]) {
                    entity.spriteEquipment[slot].destroy();
                    entity.spriteEquipment[slot] = null;
                }
            }
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

    /**
     * Find the nearest controlled actor (player or ally) to a given actor
     * @param {Actor} fromActor - The actor searching for a target
     * @returns {Actor|null} The nearest controlled actor, or null if none found
     */
    findNearestPlayer(fromActor) {
        let nearest = null;
        let nearestDistance = Infinity;

        for (const actor of this.actors) {
            // Skip dead actors and the searcher itself
            if (actor.isDead || actor === fromActor) continue;

            // Only consider controlled actors (players, allies)
            if (!actor.hasAttribute('controlled')) continue;

            const distance = getChebyshevDistance(fromActor.x, fromActor.y, actor.x, actor.y);

            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearest = actor;
            }
        }

        return nearest;
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

    /**
     * Spawn an actor from actors.json at a given position
     * @param {string} actorType - The actor type key from actors.json
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {Actor|null} The spawned actor or null if type not found
     */
    spawnActor(actorType, x, y) {
        const actorData = this.engine.currentPrototype?.getActorData(actorType);
        if (!actorData) {
            console.warn(`Actor type '${actorType}' not found in actors.json`);
            return null;
        }

        const actor = new Actor(x, y, actorType, actorData, this.engine);
        this.addEntity(actor);
        actor.loadDefaultItems();

        // Create sprites if renderer exists
        if (this.engine.renderer) {
            this.engine.renderer.createActorSprites(actor);
        }

        // Add to scheduler if actor has a personality (takes turns)
        if (actor.personality && this.engine.scheduler) {
            this.engine.scheduler.add(actor, true);
        }

        return actor;
    }

    /**
     * Spawn a decorative entity from entities.json
     * @param {string} entityType - The entity type key from entities.json
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {Entity|null} The spawned entity or null if type not found
     */
    spawnEntity(entityType, x, y) {
        const entityData = this.engine.globalEntities?.[entityType];
        if (!entityData) {
            console.warn(`Entity type '${entityType}' not found in entities.json`);
            return null;
        }

        const entity = new Entity(x, y, entityType, this.engine);
        entity.name = entityData.name || entityType;

        // Set tint
        entity.tint = parseTint(entityData.tint);

        // Set fill color if specified (for entities like blood that are just colored fills)
        entity.fillColor = entityData.fillColor ? parseTint(entityData.fillColor) : null;

        // Resolve tile index
        entity.tileIndex = this.engine.spriteLibrary.resolveTile(entityData.tileIndex);

        // Apply attributes
        if (entityData.attributes) {
            for (const [key, value] of Object.entries(entityData.attributes)) {
                entity.setAttribute(key, value);
            }
        }

        // Create sprite
        this.engine.renderer?.createEntitySprite(entity);

        // Add to entities list
        this.entities.push(entity);

        return entity;
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
                // Clean up equipment sprites
                if (entity.spriteEquipment) {
                    for (const slot of ['top', 'middle', 'lower']) {
                        if (entity.spriteEquipment[slot]) entity.spriteEquipment[slot].destroy();
                    }
                }
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
        // Map tile IDs to wildcard types (built-in procedural types)
        const builtinWildcards = {
            210: 'maze',
            10: 'dungeon',   // OPAQUE_INVERSE_DIAMOND_SUITE - ROT.js Digger dungeon with walls and doors
            143: 'room',
            144: 'room',
            12: 'item_spawn',
            3: 'actor_spawn'
        };

        if (builtinWildcards[tileId]) {
            return builtinWildcards[tileId];
        }

        // Check actor wildcard_tile attributes
        const actorType = this.getActorWildcardType(tileId);
        if (actorType) {
            return actorType;
        }

        return 'unknown';
    }

    /**
     * Build lookup of tileId -> actorType from wildcard_tile attributes
     * Cached for performance
     */
    getActorWildcardType(tileId) {
        // Build cache if not exists
        if (!this.actorWildcardCache) {
            this.actorWildcardCache = {};
            const prototype = this.engine.currentPrototype;
            if (prototype && prototype.actors) {
                for (const [actorType, actorData] of Object.entries(prototype.actors)) {
                    const paintTile = actorData.attributes?.paint_tile;
                    if (paintTile) {
                        const paintTileId = this.engine.spriteLibrary.getTileIdByName(paintTile);
                        if (paintTileId) {
                            this.actorWildcardCache[paintTileId] = actorType;
                        }
                    }
                }
            }
        }
        return this.actorWildcardCache[tileId] || null;
    }

    /**
     * Clear the actor wildcard cache (call when prototype changes)
     */
    clearWildcardCache() {
        this.actorWildcardCache = null;
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
            default:
                // Check if this is an actor type from wildcard_tile attribute
                const actorData = this.engine.currentPrototype?.getActorData(type);
                if (actorData) {
                    this.spawnActorsAt(region, type);
                }
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
                    actor.loadDefaultItems();
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

        // Tile highlight for hover/aiming
        this.highlightFilter = true;
        this.highlightedSprites = [];
        this.highlightEnabled = true;

        // Line path highlight for throwing/aiming
        this.linePathSprites = [];

        // Walk path highlight for click-to-walk
        this.walkPathSprites = [];

        // Submersion overlay sprite
        this.submersionOverlay = null;
    }

    /**
     * Apply a color overlay to simulate submersion using multiply blend mode
     * @param {number} tint - The tint color (e.g., 0x9BC964 for green)
     */
    applySubmersionTint(tint) {
        if (this.submersionOverlay) return;

        // Create a filled rectangle that covers the entire game area
        const graphics = new PIXI.Graphics();
        graphics.beginFill(tint);
        graphics.drawRect(0, 0, this.mapWidth * globalVars.TILE_WIDTH, this.mapHeight * globalVars.TILE_HEIGHT);
        graphics.endFill();

        // Use multiply blend mode for realistic color mixing
        graphics.blendMode = PIXI.BLEND_MODES.MULTIPLY;

        // Add to darkness container (above entities, below UI)
        // Use a high zIndex to ensure it's on top of other elements in that container
        graphics.zIndex = 100;
        this.darknessContainer.addChild(graphics);

        this.submersionOverlay = graphics;
        console.log(`Applied submersion overlay: #${tint.toString(16)}`);
    }

    /**
     * Remove the submersion overlay
     */
    removeSubmersionTint() {
        if (!this.submersionOverlay) return;

        this.darknessContainer.removeChild(this.submersionOverlay);
        this.submersionOverlay.destroy();
        this.submersionOverlay = null;
        console.log('Removed submersion overlay');
    }

    /**
     * Show a highlight effect on a specific tile using color inversion
     * Applies invert filter directly to the sprites at that tile position
     * @param {number} tileX - Tile X coordinate
     * @param {number} tileY - Tile Y coordinate
     */
    showTileHighlight(tileX, tileY) {
        // First, clear any existing highlight
        this.hideTileHighlight();

        // Create invert filter if it doesn't exist
        if (!this.highlightFilter) {
            this.highlightFilter = new PIXI.filters.ColorMatrixFilter();
            this.highlightFilter.negative();
        }

        // Track which sprites we're highlighting
        this.highlightedSprites = [];

        // Apply filter to background sprite at this tile
        const bgSprite = this.backgroundSprites[tileY]?.[tileX];
        if (bgSprite) {
            bgSprite.filters = bgSprite.filters ? [...bgSprite.filters, this.highlightFilter] : [this.highlightFilter];
            this.highlightedSprites.push(bgSprite);
        }

        // Apply filter to floor sprite at this tile
        const floorSprite = this.floorSprites[tileY]?.[tileX];
        if (floorSprite) {
            floorSprite.filters = floorSprite.filters ? [...floorSprite.filters, this.highlightFilter] : [this.highlightFilter];
            this.highlightedSprites.push(floorSprite);
        }

        // Apply filter to any actors at this tile
        const actor = this.engine.entityManager?.getActorAt(tileX, tileY);
        if (actor && !actor.isDead) {
            if (actor.spriteBase) {
                actor.spriteBase.filters = actor.spriteBase.filters ? [...actor.spriteBase.filters, this.highlightFilter] : [this.highlightFilter];
                this.highlightedSprites.push(actor.spriteBase);
            }
            if (actor.spriteTop) {
                actor.spriteTop.filters = actor.spriteTop.filters ? [...actor.spriteTop.filters, this.highlightFilter] : [this.highlightFilter];
                this.highlightedSprites.push(actor.spriteTop);
            }
        }

        // Apply filter to any items at this tile
        const item = this.engine.entityManager?.getItemAt(tileX, tileY);
        if (item && item.sprite) {
            item.sprite.filters = item.sprite.filters ? [...item.sprite.filters, this.highlightFilter] : [this.highlightFilter];
            this.highlightedSprites.push(item.sprite);
        }

        this.highlightEnabled = true;
    }

    /**
     * Hide the tile highlight by removing invert filter from highlighted sprites
     */
    hideTileHighlight() {
        if (this.highlightedSprites && this.highlightFilter) {
            for (const sprite of this.highlightedSprites) {
                if (sprite.filters) {
                    sprite.filters = sprite.filters.filter(f => f !== this.highlightFilter);
                    if (sprite.filters.length === 0) sprite.filters = null;
                }
            }
        }
        this.highlightedSprites = [];
        this.highlightEnabled = false;
    }

    /**
     * Show a line path highlight 
     * @param {number} startX - Starting tile X
     * @param {number} startY - Starting tile Y
     * @param {number} endX - Target tile X
     * @param {number} endY - Target tile Y
     * @returns {{path: Array, blockedAt: {x,y}|null}} The path and where it was blocked (if any)
     */
    showLinePath(startX, startY, endX, endY) {
        // Clear any existing path highlight
        this.hideLinePath();

        const tileWidth = this.engine.config.tileWidth;
        const tileHeight = this.engine.config.tileHeight;

        // Get the line path using Bresenham's algorithm
        const fullPath = getLinePath(startX, startY, endX, endY);

        // Track where path is blocked (skip start position)
        let blockedAt = null;
        const displayPath = [];

        for (let i = 1; i < fullPath.length; i++) {
            const point = fullPath[i];

            // Check for solid actors that would block the path
            const actor = this.engine.entityManager?.getActorAt(point.x, point.y);
            if (actor && !actor.isDead && actor.hasAttribute('solid')) {
                blockedAt = point;
                displayPath.push(point); // Include the blocked tile
                break;
            }

            displayPath.push(point);
        }

        // Create path overlay sprites
        this.linePathSprites = [];

        for (let i = 0; i < displayPath.length; i++) {
            const point = displayPath[i];
            const isBlocked = blockedAt && point.x === blockedAt.x && point.y === blockedAt.y;
            const isTarget = i === displayPath.length - 1;

            // Create a colored overlay
            const graphics = new PIXI.Graphics();

            if (isTarget || isBlocked) {
                // Target/blocked tile - brighter red, inverted
                graphics.beginFill(0xFF0000, 1);
                graphics.blendMode = PIXI.BLEND_MODES.MULTIPLY;
            } else {
                // Path tile - faint red
                graphics.beginFill(0xFF0000, 0.6);
                graphics.blendMode = PIXI.BLEND_MODES.MULTIPLY; 
            }

            graphics.drawRect(0, 0, tileWidth, tileHeight);
            graphics.endFill();

            graphics.x = point.x * tileWidth;
            graphics.y = point.y * tileHeight;
            graphics.zIndex = 8;

            this.uiContainer.addChild(graphics);
            this.linePathSprites.push(graphics);
        }

        return {
            path: displayPath,
            blockedAt: blockedAt
        };
    }

    /**
     * Hide the line path highlight
     */
    hideLinePath() {
        if (this.linePathSprites) {
            for (const sprite of this.linePathSprites) {
                this.uiContainer.removeChild(sprite);
                sprite.destroy();
            }
        }
        this.linePathSprites = [];
    }

    /**
     * Show a walk path highlight using A* pathfinding
     * Uses yellow-tinted overlay for path tiles
     * @param {number} startX - Starting tile X
     * @param {number} startY - Starting tile Y
     * @param {number} endX - Target tile X
     * @param {number} endY - Target tile Y
     * @returns {Array|null} The path array or null if no path exists
     */
    showWalkPath(startX, startY, endX, endY) {
        // Clear any existing walk path highlight
        this.hideWalkPath();

        const tileWidth = this.engine.config.tileWidth;
        const tileHeight = this.engine.config.tileHeight;

        // Create passability callback
        const isPassable = (x, y) => {
            // Check map boundaries
            if (x < 0 || y < 0 || x >= this.mapWidth || y >= this.mapHeight) {
                return false;
            }
            // Allow start and end tiles even if occupied
            if ((x === startX && y === startY) || (x === endX && y === endY)) {
                // Still need to check if there's floor
                const floorTile = this.engine.mapManager?.floorMap[y]?.[x];
                return floorTile && floorTile.tileId > 0;
            }
            // Check for solid actors
            const actor = this.engine.entityManager?.getActorAt(x, y);
            if (actor && !actor.isDead && actor.hasAttribute('solid')) {
                return false;
            }
            // Check for hazardous actors - avoid unless player has matching immunity
            const damageType = actor?.getAttribute('damage_type');
            if (damageType && !actor.isDead) {
                const player = this.engine.entityManager?.player;
                if (!player?.hasAttribute(`${damageType}_immune`)) {
                    return false;
                }
            }
            // Check if tile is walkable (has floor)
            const floorTile = this.engine.mapManager?.floorMap[y]?.[x];
            return floorTile && floorTile.tileId > 0;
        };

        // Find path using A*
        const path = findPathAStar(startX, startY, endX, endY, isPassable, { topology: 8 });

        if (path.length === 0) {
            return null; // No path found
        }

        // Create path overlay sprites (skip first tile - that's the player's position)
        this.walkPathSprites = [];

        for (let i = 1; i < path.length; i++) {
            const point = path[i];
            const isTarget = i === path.length - 1;

            // Create a colored overlay
            const graphics = new PIXI.Graphics();

            if (isTarget) {
                // Target tile - brighter yellow
                graphics.beginFill(0xFADF63, 1);
                graphics.blendMode = PIXI.BLEND_MODES.MULTIPLY;
            } else {
                // Path tile - faint yellow
                graphics.beginFill(0xFADF63, 0.6);
                graphics.blendMode = PIXI.BLEND_MODES.MULTIPLY;
            }

            graphics.drawRect(0, 0, tileWidth, tileHeight);
            graphics.endFill();

            graphics.x = point.x * tileWidth;
            graphics.y = point.y * tileHeight;
            graphics.zIndex = 7; // Below line path (8) but above normal tiles

            this.uiContainer.addChild(graphics);
            this.walkPathSprites.push(graphics);
        }

        return path;
    }

    /**
     * Hide the walk path highlight
     */
    hideWalkPath() {
        if (this.walkPathSprites) {
            for (const sprite of this.walkPathSprites) {
                this.uiContainer.removeChild(sprite);
                sprite.destroy();
            }
        }
        this.walkPathSprites = [];
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

            // Render equipment sprites for each slot
            for (const slot of ['top', 'middle', 'lower']) {
                const equippedItem = actor.getEquippedItem(slot);
                if (equippedItem) {
                    actor.spriteEquipment[slot] = this.createEquipmentSprite(
                        actor,
                        equippedItem,
                        slot
                    );
                }
            }

            actorsRendered++;
        }

        console.log(`Rendered ${actorsRendered} actors`);
    }

    /**
     * Create sprites for a single actor (used when spawning actors dynamically)
     * @param {Actor} actor - The actor to create sprites for
     */
    createActorSprites(actor) {
        if (!actor.hasAttribute('visible')) return;

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

        // Render equipment sprites for each slot
        for (const slot of ['top', 'middle', 'lower']) {
            const equippedItem = actor.getEquippedItem(slot);
            if (equippedItem) {
                actor.spriteEquipment[slot] = this.createEquipmentSprite(
                    actor,
                    equippedItem,
                    slot
                );
            }
        }
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
                // Start on a random frame so multiple instances aren't in sync
                const startFrame = Math.floor(Math.random() * animFrames.length);
                animSprite.gotoAndPlay(startFrame);
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

    /**
     * Create a sprite for a decorative entity
     * @param {Entity} entity - The entity to create a sprite for
     */
    createEntitySprite(entity) {
        const tileset = PIXI.Loader.shared.resources.tiles;
        const x = entity.x * globalVars.TILE_WIDTH;
        const y = entity.y * globalVars.TILE_HEIGHT;
        const zIndex = 5; // Below actors (10) but above floor

        // If entity has a fill color, create a colored rectangle
        if (entity.fillColor !== null && entity.fillColor !== undefined) {
            const graphics = new PIXI.Graphics();
            graphics.beginFill(entity.fillColor);
            graphics.blendMode = PIXI.BLEND_MODES.MULTIPLY;
            graphics.drawRect(0, 0, globalVars.TILE_WIDTH, globalVars.TILE_HEIGHT);
            graphics.endFill();
            graphics.x = x;
            graphics.y = y;
            graphics.zIndex = zIndex;

            this.entityContainer.addChild(graphics);
            entity.sprite = graphics;
        }

        // If entity has a tile index, create a sprite on top of any fill
        if (entity.tileIndex) {
            const rect = new PIXI.Rectangle(
                entity.tileIndex.x * globalVars.TILE_WIDTH,
                entity.tileIndex.y * globalVars.TILE_HEIGHT,
                globalVars.TILE_WIDTH,
                globalVars.TILE_HEIGHT
            );
            const texture = new PIXI.Texture(tileset.texture.baseTexture, rect);
            const sprite = new PIXI.Sprite(texture);

            sprite.x = x;
            sprite.y = y;
            sprite.zIndex = zIndex + 1; // Slightly above fill
            sprite.tint = entity.tint;

            this.entityContainer.addChild(sprite);

            // If we already have a fill sprite, store tile sprite separately
            if (entity.sprite) {
                entity.tileSprite = sprite;
            } else {
                entity.sprite = sprite;
            }
        }
    }

    /**
     * Create a sprite for an equipped item displayed on an actor
     * @param {Actor} actor - The actor wearing the item
     * @param {Item} item - The equipped item
     * @param {string} slot - The equipment slot ('top', 'middle', or 'lower')
     * @returns {PIXI.Sprite|null} The created sprite or null
     */
    createEquipmentSprite(actor, item, slot) {
        const tileset = PIXI.Loader.shared.resources.tiles;
        if (!tileset || !item.tileIndex) return null;

        const rect = new PIXI.Rectangle(
            item.tileIndex.x * globalVars.TILE_WIDTH,
            item.tileIndex.y * globalVars.TILE_HEIGHT,
            globalVars.TILE_WIDTH,
            globalVars.TILE_HEIGHT
        );
        const texture = new PIXI.Texture(tileset.texture.baseTexture, rect);
        const sprite = new PIXI.Sprite(texture);

        // Position based on slot type
        // top: above actor's top tile (y - 2), for crowns, horns, halos
        // middle: on actor's top tile (y - 1), for helmets, masks
        // lower: on actor's base tile (y), for armor, cloaks
        const baseX = actor.x * globalVars.TILE_WIDTH;
        let y, zIndex;

        switch (slot) {
            case 'top':
                y = (actor.y - 2) * globalVars.TILE_HEIGHT;
                zIndex = 13; // Above everything
                break;
            case 'middle':
                y = (actor.y - 1) * globalVars.TILE_HEIGHT;
                zIndex = 12; // Above actor top sprite
                break;
            case 'lower':
                y = actor.y * globalVars.TILE_HEIGHT;
                zIndex = 12; // Above actor base sprite
                break;
            default:
                y = actor.y * globalVars.TILE_HEIGHT;
                zIndex = 12;
        }

        sprite.x = baseX;
        sprite.y = y;
        sprite.zIndex = zIndex;
        sprite.tint = item.tint;

        this.entityContainer.addChild(sprite);
        return sprite;
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

                // Apply horizontal/vertical flip using anchor at center
                if (item.flipH || item.flipV) {
                    sprite.anchor.set(0.5, 0.5);
                    sprite.x += globalVars.TILE_WIDTH / 2;
                    sprite.y += globalVars.TILE_HEIGHT / 2;
                    sprite.scale.x = item.flipH ? -1 : 1;
                    sprite.scale.y = item.flipV ? -1 : 1;
                }

                this.entityContainer.addChild(sprite);
                item.sprite = sprite;

                itemsRendered++;
            }
        }

        console.log(`Rendered ${itemsRendered} items`);
    }

    /**
     * Create a sprite for a single item (used when items are added dynamically)
     * @param {Item} item - The item to create a sprite for
     */
    createItemSprite(item) {
        if (!item.hasAttribute('visible')) return;
        if (item.sprite) return; // Already has a sprite

        const tileset = PIXI.Loader.shared.resources.tiles;
        if (!tileset || !item.tileIndex) return;

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

        // Apply horizontal/vertical flip using anchor at center
        if (item.flipH || item.flipV) {
            sprite.anchor.set(0.5, 0.5);
            sprite.x += globalVars.TILE_WIDTH / 2;
            sprite.y += globalVars.TILE_HEIGHT / 2;
            sprite.scale.x = item.flipH ? -1 : 1;
            sprite.scale.y = item.flipV ? -1 : 1;
        }

        this.entityContainer.addChild(sprite);
        item.sprite = sprite;
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
        this.highlightFilter = null;
        this.highlightedSprites = [];
        this.highlightEnabled = false;
        this.linePathSprites = [];
        this.walkPathSprites = [];
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

        for (let y = 0; y < lightingManager.height; y++) {
            for (let x = 0; x < lightingManager.width; x++) {
                const darkSprite = this.darknessSprites[y]?.[x];
                const lightColorSprite = this.lightColorSprites[y]?.[x];

                // Apply colored light overlay
                if (lightColorSprite) {
                    const colorOverlay = lightingManager.getLightColorOverlay(x, y);
                    lightColorSprite.tint = colorOverlay.tint;
                    lightColorSprite.alpha = colorOverlay.alpha;
                }

                // Update darkness overlay
                if (darkSprite) {
                    const darkness = lightingManager.getDarknessAlpha(x, y, fogOfWar);
                    darkSprite.texture = darkness.useSolidTexture ? this.solidDarkTexture : this.darkTexture;
                    darkSprite.alpha = darkness.alpha;
                }
            }
        }

        // Update actor and item tints based on lighting
        this.updateEntityLighting(lightingManager);
    }

    updateEntityLighting(lightingManager) {
        const fogOfWar = this.engine.currentPrototype?.config?.mechanics?.fog_of_war;

        for (const actor of this.engine.entityManager.actors) {
            // Skip dead actors - their sprites should stay hidden
            if (actor.isDead) continue;

            const vis = lightingManager.getEntityVisibility(actor.x, actor.y, fogOfWar);

            if (actor.spriteBase) actor.spriteBase.visible = vis.showBase;
            if (actor.spriteTop) actor.spriteTop.visible = vis.showTop;

            // Update equipment sprite visibility
            // top: uses showEquipmentTop (at y-2, above actor's head) - lit same as actor
            // middle: uses showTop (on actor's top tile)
            // lower: uses showBase (on actor's base tile)
            if (actor.spriteEquipment.top) actor.spriteEquipment.top.visible = vis.showEquipmentTop;
            if (actor.spriteEquipment.middle) actor.spriteEquipment.middle.visible = vis.showTop;
            if (actor.spriteEquipment.lower) actor.spriteEquipment.lower.visible = vis.showBase;

            this.setAnimationPlaying(actor.spriteBase, vis.animateBase);
            this.setAnimationPlaying(actor.spriteTop, vis.animateTop);

            if (!vis.showBase && !vis.showTop) continue;

            // Light sources keep their own tint
            if (actor.hasAttribute('light_source')) continue;

            if (actor.spriteBase) {
                actor.spriteBase.tint = this.blendTints(actor.tint, vis.baseTint);
            }
            if (actor.spriteTop) {
                actor.spriteTop.tint = this.blendTints(actor.tint, vis.topTint);
            }

            // Update equipment sprite tints
            for (const slot of ['top', 'middle', 'lower']) {
                if (actor.spriteEquipment[slot]) {
                    const equippedItem = actor.getEquippedItem(slot);
                    if (equippedItem) {
                        // top uses equipmentTopTint (same as actor), middle uses topTint, lower uses baseTint
                        let tintToUse;
                        if (slot === 'top') {
                            tintToUse = vis.equipmentTopTint;
                        } else if (slot === 'lower') {
                            tintToUse = vis.baseTint;
                        } else {
                            tintToUse = vis.topTint;
                        }
                        actor.spriteEquipment[slot].tint = this.blendTints(equippedItem.tint, tintToUse);
                    }
                }
            }
        }

        for (const item of this.engine.entityManager.items) {
            const vis = lightingManager.getEntityVisibility(item.x, item.y, fogOfWar);

            if (item.sprite) item.sprite.visible = vis.showBase;
            this.setAnimationPlaying(item.sprite, vis.animateBase);

            if (!vis.showBase) continue;

            if (item.sprite) {
                item.sprite.tint = this.blendTints(item.tint, vis.baseTint);
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

        // Determine which prototype to load (priority order):
        // 1. URL parameter: ?prototype=labyrinth
        // 2. Data attribute on game container: <div id="game" data-prototype="labyrinth">
        // 3. Global config object: window.DUNGEON_CONFIG = { prototype: 'labyrinth' }
        // 4. Default: 'default'
        const urlParams = new URLSearchParams(window.location.search);
        const urlPrototype = urlParams.get('prototype');
        const dataPrototype = gameContainer.dataset.prototype;
        const configPrototype = window.DUNGEON_CONFIG?.prototype;

        // Normalize prototype name - extract just the name if a full path was provided
        const normalizePrototypeName = (name) => {
            if (!name) return null;
            // Remove leading slashes and any path prefix, keep only the last segment
            return name.replace(/^\/+/, '').split('/').pop();
        };

        const rawPrototype = urlPrototype || dataPrototype || configPrototype || 'default';
        const firstPrototype = normalizePrototypeName(rawPrototype);
        console.log(`Loading prototype: ${firstPrototype} (source: ${urlPrototype ? 'URL' : dataPrototype ? 'data-attribute' : configPrototype ? 'config' : 'default'})`);

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