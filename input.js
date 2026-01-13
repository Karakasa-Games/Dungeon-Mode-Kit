
// ============================================================================
// INPUT MANAGER
// ============================================================================

class InputManager {
    constructor(engine) {
        this.engine = engine;
        this.enabled = true;

        // Mouse tracking
        this.hoveredTile = { x: -1, y: -1 };
        this.descriptionElement = document.getElementById('description');
        this.currentCanvas = null;
        this.boundMouseMove = null;
        this.boundMouseLeave = null;

        // Message stacking for turn-based events
        this.messageStack = [];

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
            'i': 'player_info',
            'I': 'player_info'
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

        // Setup mouse listeners once the canvas is available
        this.setupMouseListeners();
    }

    setupMouseListeners() {
        // Wait for the canvas to be available
        const checkCanvas = () => {
            const canvas = this.engine.app?.view;
            if (canvas && canvas !== this.currentCanvas) {
                // Remove listeners from old canvas if exists
                if (this.currentCanvas) {
                    this.currentCanvas.removeEventListener('mousemove', this.boundMouseMove);
                    this.currentCanvas.removeEventListener('mouseleave', this.boundMouseLeave);
                }

                // Store bound handlers so we can remove them later
                this.boundMouseMove = (e) => this.handleMouseMove(e);
                this.boundMouseLeave = () => this.handleMouseLeave();

                canvas.addEventListener('mousemove', this.boundMouseMove);
                canvas.addEventListener('mouseleave', this.boundMouseLeave);
                this.currentCanvas = canvas;
            }

            // Keep checking periodically in case canvas changes (prototype reload)
            setTimeout(checkCanvas, 500);
        };
        checkCanvas();
    }

    handleMouseMove(event) {
        if (!this.enabled) return;

        const canvas = this.engine.app?.view;
        if (!canvas) return;

        // Get mouse position relative to canvas
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        // Account for canvas scaling (canvas is displayed at half size)
        const scaleX = this.engine.canvasWidth / rect.width;
        const scaleY = this.engine.canvasHeight / rect.height;

        // Convert to tile coordinates
        const tileX = Math.floor((mouseX * scaleX) / this.engine.config.tileWidth);
        const tileY = Math.floor((mouseY * scaleY) / this.engine.config.tileHeight);

        // Only update if tile changed
        if (tileX !== this.hoveredTile.x || tileY !== this.hoveredTile.y) {
            this.hoveredTile.x = tileX;
            this.hoveredTile.y = tileY;

            this.updateDescription(tileX, tileY);
        }
    }

    handleMouseLeave() {
        this.hoveredTile.x = -1;
        this.hoveredTile.y = -1;
    }

    updateDescription(tileX, tileY) {
        if (!this.descriptionElement) return;

        // Clear any stacked messages when hovering (new context)
        this.messageStack = [];

        const lightingManager = this.engine.lightingManager;
        const entityManager = this.engine.entityManager;
        if (!entityManager) return;

        // Determine visibility state
        // If no lightingManager (darkness disabled), treat all tiles as visible
        const isVisible = lightingManager ? lightingManager.isVisible(tileX, tileY) : true;
        const isExplored = lightingManager ? lightingManager.isExplored(tileX, tileY) : true;
        const fogOfWar = this.engine.currentPrototype?.config?.mechanics?.fog_of_war || false;

        // Determine if this is a "remembered" tile (explored but not currently visible, with fog of war on)
        const isRemembered = !isVisible && fogOfWar && isExplored;

        // If not visible and not remembered, keep current description
        if (!isVisible && !isRemembered) {
            return;
        }

        const entities = [];

        // Check for actors at this position (excluding dead ones)
        // Actor's base is at (x, y), top sprite is at (x, y-1)
        // So if hovering over y, check for actor at y (base) or y+1 (whose top is here)
        let actor = entityManager.getActorAt(tileX, tileY);
        if (!actor || actor.isDead) {
            // Check if we're hovering over an actor's top sprite (actor is at y+1)
            const actorBelow = entityManager.getActorAt(tileX, tileY + 1);
            if (actorBelow && !actorBelow.isDead && actorBelow.height === 2) {
                actor = actorBelow;
            }
        }

        if (actor && !actor.isDead && actor.hasAttribute('visible')) {
            entities.push(this.getEntityDescription(actor));
        }

        // Check for items at this position
        const item = entityManager.getItemAt(tileX, tileY);
        if (item && item.hasAttribute('visible')) {
            entities.push(this.getEntityDescription(item));
        }

        // Update the description element
        if (entities.length > 0) {
            // Build natural sentence based on visibility state
            const description = this.formatEntityList(entities, isRemembered);

            // Find the summary element within the details
            const summary = this.descriptionElement.querySelector('summary');
            if (summary) {
                // Update the content after the summary
                // Remove existing description text (everything after summary)
                const existingText = Array.from(this.descriptionElement.childNodes)
                    .filter(node => node !== summary);
                existingText.forEach(node => node.remove());

                // Add new description
                const textNode = document.createTextNode('\n' + description);
                this.descriptionElement.appendChild(textNode);
            }
            // Open the details element to show the description
            this.descriptionElement.open = true;
        }
    }

    formatEntityList(entities, isRemembered = false) {
        // Format a list of entities into a natural sentence
        // Currently visible: "You see a Skeleton."
        // Remembered (fog of war): "You remember seeing a Skeleton."
        const prefix = isRemembered ? 'You remember seeing' : 'You see';

        if (entities.length === 1) {
            return `${prefix} ${entities[0]}.`;
        } else if (entities.length === 2) {
            return `${prefix} ${entities[0]} and ${entities[1]}.`;
        } else {
            const allButLast = entities.slice(0, -1).join(', ');
            const last = entities[entities.length - 1];
            return `${prefix} ${allButLast}, and ${last}.`;
        }
    }

    clearDescription() {
        if (!this.descriptionElement) return;

        const summary = this.descriptionElement.querySelector('summary');
        if (summary) {
            // Remove existing description text (everything after summary)
            const existingText = Array.from(this.descriptionElement.childNodes)
                .filter(node => node !== summary);
            existingText.forEach(node => node.remove());
        }
        // Close the details element when nothing to show
        this.descriptionElement.open = false;
    }

    /**
     * Add a message to the stack (will be displayed together with other messages from the same turn)
     * @param {string} message - The message to display
     */
    showMessage(message) {
        if (!this.descriptionElement) return;

        // Add to message stack
        this.messageStack.push(message);

        // Display all stacked messages
        this.displayMessages();
    }

    /**
     * Clear the message stack (call at the start of a new turn/action)
     */
    clearMessageStack() {
        this.messageStack = [];
    }

    /**
     * Display all messages in the stack
     */
    displayMessages() {
        if (!this.descriptionElement) return;

        const summary = this.descriptionElement.querySelector('summary');
        if (summary) {
            // Remove existing description text (everything after summary)
            const existingText = Array.from(this.descriptionElement.childNodes)
                .filter(node => node !== summary);
            existingText.forEach(node => node.remove());

            // Add messages with proper line breaks
            if (this.messageStack.length > 0) {
                const combinedMessage = this.messageStack.join('\n');
                // Split by newlines and insert <br> elements between lines
                const lines = combinedMessage.split('\n');
                lines.forEach((line, index) => {
                    if (index > 0) {
                        this.descriptionElement.appendChild(document.createElement('br'));
                    }
                    this.descriptionElement.appendChild(document.createTextNode(line));
                });
            }
        }
        // Open the details element to show the messages
        this.descriptionElement.open = this.messageStack.length > 0;
    }

    getEntityDescription(entity) {
        // Returns the entity name with appropriate article
        // Use getDisplayName() for items (identification-aware), fall back to name
        const displayName = entity.getDisplayName ? entity.getDisplayName() : entity.name;

        // Check for 'mass_noun' attribute (lava, sewage, water, etc.) - no article needed
        if (entity.hasAttribute('mass_noun')) {
            return displayName.toLowerCase();
        }
        const article = this.getIndefiniteArticle(displayName);
        return `${article} ${displayName}`;
    }

    getIndefiniteArticle(name) {
        // Returns 'a' or 'an' based on the first letter of the name
        const firstLetter = name.charAt(0).toLowerCase();
        const vowels = ['a', 'e', 'i', 'o', 'u'];
        return vowels.includes(firstLetter) ? 'an' : 'a';
    }

    handleKeyDown(event) {
        if (!this.enabled) return;

        // Check if confirmation dialog wants to handle this key first
        if (this.engine.interfaceManager?.handleConfirmKey(event.key)) {
            event.preventDefault();
            return;
        }

        // Check if interface manager wants to handle this key (inventory interaction)
        if (this.engine.interfaceManager?.handleInventoryKey(event.key)) {
            event.preventDefault();
            return;
        }

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

        // Ignore key repeat events to prevent stacking inputs when holding keys
        //if (event.repeat) return;

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
        // Clear message stack at the start of each player action
        this.clearMessageStack();

        // Handle movement actions
        if (this.directions[action]) {
            const dir = this.directions[action];
            const targetX = player.x + dir.dx;
            const targetY = player.y + dir.dy;

            // Check for hazards that need confirmation
            const hazardCheck = this.checkMovementHazard(player, targetX, targetY);
            if (hazardCheck) {
                // Show confirmation dialog
                this.engine.interfaceManager?.showConfirmDialog(
                    hazardCheck.message,
                    () => {
                        // On confirm - execute the move
                        const result = player.moveBy(dir.dx, dir.dy);
                        if (result.moved) {
                            this.engine.playSoundVaried('feets', 0.4, 0.1, 1.0, 0.06);
                        }
                        if (result.actionTaken) {
                            this.onPlayerAction();
                        }
                    },
                    () => {
                        // On cancel - do nothing
                    }
                );
                return;
            }

            const result = player.moveBy(dir.dx, dir.dy);
            if (result.moved) {
                this.engine.playSoundVaried('feets', 0.4, 0.1, 1.0, 0.06);
            } else if (!result.actionTaken) {
                // Bumped into a wall or obstacle with no effect
                this.engine.playSound('tap1');
            }
            if (result.actionTaken) {
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
                    const pickedUp = player.pickUpItem(item);
                    if (pickedUp) {
                        this.engine.playSound('pickup');
                        this.onPlayerAction();
                    } else {
                        // Inventory full - show message
                        this.engine.interfaceManager?.showTextBox(
                            'inventory_full',
                            "You can't carry any more things!",
                            { dismissOnMove: true }
                        );
                    }
                } else {
                    console.log('Nothing to pick up here.');
                }
                break;

            case 'player_info':
                if (this.engine.interfaceManager) {
                    this.engine.interfaceManager.togglePlayerInfo(player);
                }
                break;
        }
    }

    onPlayerAction() {
        // Called after player takes an action - unlock the turn engine to let AI act
        if (this.engine.turnEngine && this.engine.turnEngine._lock) {
            this.engine.turnEngine.unlock();
        }
    }

    /**
     * Check if moving to a position would trigger a hazard warning
     * @param {Actor} player - The player actor
     * @param {number} targetX - Target X coordinate
     * @param {number} targetY - Target Y coordinate
     * @returns {{message: string}|null} Hazard info or null if safe
     */
    checkMovementHazard(player, targetX, targetY) {
        const entityManager = this.engine.entityManager;

        // Check for solid actors at target (walls, closed doors, etc.)
        // If blocked by a solid actor, no hazard warning needed - the move will just fail
        for (const actor of entityManager.actors) {
            if (actor.x === targetX && actor.y === targetY && !actor.isDead && actor.hasAttribute('solid')) {
                return null; // Blocked by solid actor, no warning needed
            }
        }

        // Check for void (no floor)
        if (!player.hasFloorAt(targetX, targetY)) {
            return { message: "Dive into the depths?" };
        }

        // Check for lava_behavior actors at target position
        if (!player.hasAttribute('fireproof')) {
            for (const actor of entityManager.actors) {
                if (actor.x !== targetX || actor.y !== targetY) continue;
                if (actor.isDead) continue;

                // Check if actor has lava_behavior personality
                if (actor.personality?.name === 'Lava') {
                    return { message: `Really step into ${actor.name}?` };
                }
            }
        }

        return null; // No hazard
    }

    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
    }
}
