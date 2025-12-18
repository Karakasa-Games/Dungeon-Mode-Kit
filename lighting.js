// ============================================================================
// LIGHTING MANAGER
// ============================================================================
// Handles FOV computation, visibility, and light source management
// using ROT.js PreciseShadowcasting

class LightingManager {
    constructor(engine) {
        this.engine = engine;
        this.width = 0;
        this.height = 0;

        this.lightMap = [];
        this.exploredMap = [];
        this.fov = null;
        this.currentSource = null;

        this.ambientLight = 0.0;
        this.playerLightRadius = 6;
    }

    initialize(width, height, config = {}) {
        this.width = width;
        this.height = height;

        this.ambientLight = config.ambient_light ?? 0.0;
        this.playerLightRadius = config.player_light_radius ?? 6;

        this.lightMap = Array.from({ length: height }, () =>
            Array.from({ length: width }, () => ({ intensity: 0, r: 0, g: 0, b: 0 }))
        );

        this.visibilityMap = Array.from({ length: height }, () =>
            Array.from({ length: width }, () => false)
        );

        this.exploredMap = Array.from({ length: height }, () =>
            Array.from({ length: width }, () => false)
        );

        this.fov = new ROT.FOV.PreciseShadowcasting((x, y) => this.lightPasses(x, y));
        this.visionFov = new ROT.FOV.PreciseShadowcasting((x, y) => this.visionPasses(x, y));
    }

    visionPasses(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return false;
        }

        const wallTile = this.engine.mapManager.wallMap[y][x];
        if (wallTile !== null) {
            return false;
        }

        const actorAtTile = this.engine.entityManager.getActorAt(x, y);
        if (actorAtTile && actorAtTile.hasAttribute('solid') && !actorAtTile.hasAttribute('controlled')) {
            return false;
        }

        return true;
    }

    lightPasses(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return false;
        }

        // Light source's own tile always passes light
        if (this.currentSource && x === this.currentSource.x && y === this.currentSource.y) {
            return true;
        }

        const wallTile = this.engine.mapManager.wallMap[y][x];
        if (wallTile !== null) {
            return false;
        }

        const actorAtTile = this.engine.entityManager.getActorAt(x, y);
        if (actorAtTile && actorAtTile.hasAttribute('solid')) {
            return false;
        }

        return true;
    }

    getLightSources() {
        const sources = [];

        for (const actor of this.engine.entityManager.actors) {
            if (actor.hasAttribute('light_source') && !actor.isDead) {
                sources.push({
                    x: actor.x,
                    y: actor.y,
                    radius: actor.lightRadius || 5,
                    intensity: actor.lightIntensity || 1.0,
                    color: actor.tint
                });
            }

            if (actor.hasAttribute('controlled')) {
                sources.push({
                    x: actor.x,
                    y: actor.y,
                    radius: this.playerLightRadius,
                    intensity: 1.0,
                    color: 0xFFFFFF
                });
            }
        }

        return sources;
    }

    computeLighting() {
        // Reset light and visibility maps
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.lightMap[y][x] = { intensity: this.ambientLight, r: 0, g: 0, b: 0 };
                this.visibilityMap[y][x] = false;
            }
        }

        // Compute visibility for all controlled actors
        this.computeVisibility();

        // Compute lighting from all light sources
        const sources = this.getLightSources();

        for (const source of sources) {
            this.currentSource = source;

            const sr = (source.color >> 16) & 0xFF;
            const sg = (source.color >> 8) & 0xFF;
            const sb = source.color & 0xFF;

            this.fov.compute(source.x, source.y, source.radius, (x, y, r, visibility) => {
                if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
                if (visibility <= 0) return;

                const falloff = Math.max(0, 1 - (r / source.radius));
                const lightLevel = falloff * source.intensity;

                const tile = this.lightMap[y][x];
                tile.intensity = Math.min(1, tile.intensity + lightLevel);
                tile.r = Math.min(255, tile.r + sr * lightLevel);
                tile.g = Math.min(255, tile.g + sg * lightLevel);
                tile.b = Math.min(255, tile.b + sb * lightLevel);
            });
        }
        this.currentSource = null;
    }

    computeVisibility() {
        const controlledActors = this.engine.entityManager.actors.filter(
            a => a.hasAttribute('controlled') && !a.isDead
        );

        for (const actor of controlledActors) {
            this.visionFov.compute(actor.x, actor.y, actor.visionRange, (x, y, r, visibility) => {
                if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
                if (visibility > 0) {
                    this.visibilityMap[y][x] = true;
                    this.exploredMap[y][x] = true;
                }
            });
        }
    }

    getLightLevel(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return { intensity: 0, r: 0, g: 0, b: 0 };
        }
        return this.lightMap[y][x];
    }

    isExplored(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return false;
        }
        return this.exploredMap[y][x];
    }

    isVisible(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return false;
        }
        return this.visibilityMap[y][x];
    }

    hasControlledActors() {
        return this.engine.entityManager.actors.some(
            a => a.hasAttribute('controlled') && !a.isDead
        );
    }

    reset() {
        this.lightMap = [];
        this.visibilityMap = [];
        this.exploredMap = [];
        this.fov = null;
        this.visionFov = null;
    }
}
