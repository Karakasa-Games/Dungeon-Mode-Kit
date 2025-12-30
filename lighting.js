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

    isTopVisible(x, y) {
        // A tile's "top" is visible if the tile itself is visible,
        // OR if there's an actor at (x, y+1) whose top renders here and whose BASE is visible
        if (this.isVisible(x, y)) {
            return true;
        }

        // Check if there's an actor below whose top would render at this position
        // The top should be visible if the actor's base tile (at y+1) is visible
        const actorBelow = this.engine.entityManager.getActorAt(x, y + 1);
        if (actorBelow && actorBelow.spriteTop && !actorBelow.isDead) {
            // Actor's top is visible if its base tile is visible
            if (this.isVisible(x, y + 1)) {
                return true;
            }
        }

        return false;
    }

    isEquipmentTopVisible(x, y) {
        // Check if equipment at y-2 (above actor's head) should be visible
        // This position is visible if:
        // 1. The tile at y-2 is directly visible, OR
        // 2. There's an actor at (x, y) with "top" slot equipment whose base is visible
        if (this.isVisible(x, y)) {
            return true;
        }

        // Check if there's an actor two tiles below whose equipment would render here
        const actorBelow = this.engine.entityManager.getActorAt(x, y + 2);
        if (actorBelow && actorBelow.spriteEquipment?.top && !actorBelow.isDead) {
            // Equipment is visible if the actor's base tile is visible
            if (this.isVisible(x, y + 2)) {
                return true;
            }
        }

        return false;
    }

    hasControlledActors() {
        return this.engine.entityManager.actors.some(
            a => a.hasAttribute('controlled') && !a.isDead
        );
    }

    getLightTint(light) {
        if (light.intensity > 0 && (light.r > 0 || light.g > 0 || light.b > 0)) {
            const maxComponent = Math.max(light.r, light.g, light.b, 1);
            const r = Math.floor((light.r / maxComponent) * 255);
            const g = Math.floor((light.g / maxComponent) * 255);
            const b = Math.floor((light.b / maxComponent) * 255);
            return (r << 16) | (g << 8) | b;
        }
        return 0xFFFFFF;
    }

    getDarknessAlpha(x, y, fogOfWar = false) {
        const hasControlled = this.hasControlledActors();
        const light = this.getLightLevel(x, y);
        const visible = this.isVisible(x, y);
        const topVisible = this.isTopVisible(x, y);
        const equipmentTopVisible = this.isEquipmentTopVisible(x, y);
        const explored = this.isExplored(x, y);

        if (!hasControlled) {
            if (light.intensity >= 1) {
                return { alpha: 0, useSolidTexture: false };
            } else if (light.intensity > 0) {
                return { alpha: 1.0 - light.intensity, useSolidTexture: false };
            } else {
                return { alpha: 1.0, useSolidTexture: true };
            }
        } else if (visible || topVisible || equipmentTopVisible) {
            if (light.intensity >= 1) {
                return { alpha: 0, useSolidTexture: false };
            } else if (light.intensity > 0) {
                return { alpha: 0.85 * (1.0 - light.intensity), useSolidTexture: false };
            } else {
                return { alpha: 0.85, useSolidTexture: false };
            }
        } else if (fogOfWar && explored) {
            return { alpha: 0.92, useSolidTexture: false };
        } else {
            return { alpha: 1.0, useSolidTexture: true };
        }
    }

    getEntityVisibility(x, y, fogOfWar = false) {
        // Get visibility for an entity at position (x, y)
        // The top sprite should have the same visibility as the base
        // Equipment in "top" slot (at y-2) should also match the actor's visibility
        const hasControlled = this.hasControlledActors();
        const light = this.getLightLevel(x, y);
        const visible = this.isVisible(x, y);
        const explored = this.isExplored(x, y);
        const lightTint = this.getLightTint(light);

        if (!hasControlled) {
            return {
                showBase: true,
                showTop: true,
                showEquipmentTop: true,
                baseTint: lightTint,
                topTint: lightTint,
                equipmentTopTint: lightTint,
                animateBase: true,
                animateTop: true
            };
        }

        const shouldShow = visible || (fogOfWar && explored);
        const tint = (!visible && fogOfWar && explored) ? 0x333333 : lightTint;

        return {
            showBase: shouldShow,
            showTop: shouldShow,
            showEquipmentTop: shouldShow,
            baseTint: tint,
            topTint: tint,
            equipmentTopTint: tint,
            animateBase: visible,
            animateTop: visible
        };
    }

    getLightColorOverlay(x, y) {
        const hasControlled = this.hasControlledActors();
        const light = this.getLightLevel(x, y);
        const visible = this.isVisible(x, y);
        const lightTint = this.getLightTint(light);

        if (light.intensity > 0 && lightTint !== 0xFFFFFF) {
            if (visible || !hasControlled) {
                return {
                    tint: lightTint,
                    alpha: Math.min(0.5, light.intensity * 0.5)
                };
            }
        }
        return { tint: 0xFFFFFF, alpha: 0 };
    }

    reset() {
        this.lightMap = [];
        this.visibilityMap = [];
        this.exploredMap = [];
        this.fov = null;
        this.visionFov = null;
    }
}
