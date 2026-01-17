// ============================================================================
// INTERFACE MANAGER
// ============================================================================
// Handles UI elements like boxes, menus, and overlays using the uiContainer

class InterfaceManager {
    constructor(engine) {
        this.engine = engine;
        this.boxes = new Map(); // Track active UI boxes by ID
        this.textBoxStack = []; // Stack of text box IDs in display order (top to bottom)
        this.maxTextBoxes = 4; // Maximum visible text boxes
        this.dismissOnMoveBoxes = new Set(); // Text boxes to dismiss on player move
        this.autoDisposeTimers = new Map(); // Timers for auto-disposing boxes

        // Inventory interaction state
        this.inventoryMode = false; // True when player info is showing and accepting item selection
        this.currentPlayer = null; // Reference to player when inventory is open
        this.selectedItemIndex = null; // Currently selected item index (for action menu)

        // Confirmation dialog state
        this.confirmDialog = null; // { message, onConfirm, onCancel }

        // Throw aiming mode state
        this.throwAimingMode = false;
        this.throwItem = null; // Item being thrown

        // Throw menu mode state (T key menu)
        this.throwMenuMode = false;
    }

    get container() {
        return this.engine.renderer?.uiContainer;
    }

    get spriteLibrary() {
        return this.engine.spriteLibrary;
    }

    get tileset() {
        return PIXI.Loader.shared.resources.tiles;
    }

    /**
     * Create a UI box with border and solid background
     * @param {string} id - Unique identifier for this box
     * @param {number} x - X position in tiles
     * @param {number} y - Y position in tiles
     * @param {number} width - Width in tiles
     * @param {number} height - Height in tiles
     * @param {object} options - Optional settings (fillColor, borderTint)
     * @returns {PIXI.Container} The box container
     */
    createBox(id, x, y, width, height, options = {}) {
        if (!this.container) {
            console.error('UI container not available');
            return null;
        }

        // Remove existing box with same ID
        if (this.boxes.has(id)) {
            this.removeBox(id);
        }

        const fillColor = options.fillColor ?? 0xFFFFFF;
        const borderTint = options.borderTint ?? 0xFFFFFF;

        // Create container for this box
        const boxContainer = new PIXI.Container();
        boxContainer.x = x * globalVars.TILE_WIDTH;
        boxContainer.y = y * globalVars.TILE_HEIGHT;

        // Create solid fill background
        const fill = new PIXI.Graphics();
        fill.beginFill(fillColor);
        fill.drawRect(0, 0, width * globalVars.TILE_WIDTH, height * globalVars.TILE_HEIGHT);
        fill.endFill();
        boxContainer.addChild(fill);

        // Draw border tiles
        this.drawBoxBorder(boxContainer, width, height, borderTint);

        this.container.addChild(boxContainer);
        this.boxes.set(id, boxContainer);

        return boxContainer;
    }

    /**
     * Draw box border using box-drawing characters
     */
    drawBoxBorder(container, width, height, tint) {
        const tiles = {
            topLeft: this.spriteLibrary.getTileByName('BOX_TOP_LEFT'),
            topRight: this.spriteLibrary.getTileByName('BOX_TOP_RIGHT'),
            bottomLeft: this.spriteLibrary.getTileByName('BOX_BOTTOM_LEFT'),
            bottomRight: this.spriteLibrary.getTileByName('BOX_BOTTOM_RIGHT'),
            horizontal: this.spriteLibrary.getTileByName('BOX_HORIZONTAL'),
            vertical: this.spriteLibrary.getTileByName('BOX_VERTICAL')
        };

        // Top-left corner
        this.addBorderTile(container, tiles.topLeft, 0, 0, tint);

        // Top-right corner
        this.addBorderTile(container, tiles.topRight, width - 1, 0, tint);

        // Bottom-left corner
        this.addBorderTile(container, tiles.bottomLeft, 0, height - 1, tint);

        // Bottom-right corner
        this.addBorderTile(container, tiles.bottomRight, width - 1, height - 1, tint);

        // Top and bottom edges
        for (let i = 1; i < width - 1; i++) {
            this.addBorderTile(container, tiles.horizontal, i, 0, tint);
            this.addBorderTile(container, tiles.horizontal, i, height - 1, tint);
        }

        // Left and right edges
        for (let i = 1; i < height - 1; i++) {
            this.addBorderTile(container, tiles.vertical, 0, i, tint);
            this.addBorderTile(container, tiles.vertical, width - 1, i, tint);
        }
    }

    /**
     * Add a single border tile sprite
     */
    addBorderTile(container, tileCoords, tileX, tileY, tint) {
        if (!tileCoords || !this.tileset) return;

        const rect = new PIXI.Rectangle(
            tileCoords.x * globalVars.TILE_WIDTH,
            tileCoords.y * globalVars.TILE_HEIGHT,
            globalVars.TILE_WIDTH,
            globalVars.TILE_HEIGHT
        );

        const texture = new PIXI.Texture(this.tileset.texture.baseTexture, rect);
        const sprite = new PIXI.Sprite(texture);

        sprite.x = tileX * globalVars.TILE_WIDTH;
        sprite.y = tileY * globalVars.TILE_HEIGHT;
        sprite.tint = tint;

        container.addChild(sprite);
    }

    /**
     * Remove a UI box by ID
     * @param {string} id - Box identifier
     */
    removeBox(id) {
        const box = this.boxes.get(id);
        if (box) {
            this.container.removeChild(box);
            box.destroy({ children: true });
            this.boxes.delete(id);
        }
    }

    /**
     * Hide a box without destroying it
     * @param {string} id - Box identifier
     */
    hideBox(id) {
        const box = this.boxes.get(id);
        if (box) {
            box.visible = false;
        }
    }

    /**
     * Show a hidden box
     * @param {string} id - Box identifier
     */
    showBox(id) {
        const box = this.boxes.get(id);
        if (box) {
            box.visible = true;
        }
    }

    /**
     * Get a box container by ID (for adding content)
     * @param {string} id - Box identifier
     * @returns {PIXI.Container|null}
     */
    getBox(id) {
        return this.boxes.get(id) || null;
    }

    /**
     * Remove all UI boxes
     */
    clear() {
        for (const [, box] of this.boxes) {
            this.container.removeChild(box);
            box.destroy({ children: true });
        }
        this.boxes.clear();
    }

    /**
     * Get the tile name for a character
     * @param {string} char - Single character
     * @returns {string|null} Tile name or null if not found
     */
    getTileNameForChar(char) {
        if (char === ' ') return 'SPACE';
        if (char === '!') return 'EXCLAMATION_MARK';
        if (char === '"') return 'QUOTATION_MARK';
        if (char === '#') return 'NUMBER_SIGN';
        if (char === '$') return 'DOLLAR_SIGN';
        if (char === '%') return 'PERCENT_SIGN';
        if (char === '&') return 'AMPERSAND';
        if (char === "'") return 'APOSTROPHE';
        if (char === '(') return 'LEFT_PARENTHESIS';
        if (char === ')') return 'RIGHT_PARENTHESIS';
        if (char === '*') return 'ASTERISK';
        if (char === '+') return 'PLUS_SIGN';
        if (char === ',') return 'COMMA';
        if (char === '-') return 'HYPHEN_MINUS';
        if (char === '.') return 'FULL_STOP';
        if (char === '/') return 'SOLIDUS';
        if (char === ':') return 'COLON';
        if (char === ';') return 'SEMICOLON';
        if (char === '<') return 'LESS_THAN_SIGN';
        if (char === '=') return 'EQUALS_SIGN';
        if (char === '>') return 'GREATER_THAN_SIGN';
        if (char === '?') return 'QUESTION_MARK';
        if (char === '@') return 'COMMERCIAL_AT';
        if (char === '[') return 'LEFT_SQUARE_BRACKET';
        if (char === '\\') return 'REVERSE_SOLIDUS';
        if (char === ']') return 'RIGHT_SQUARE_BRACKET';
        if (char === '^') return 'CIRCUMFLEX_ACCENT';
        if (char === '_') return 'LOW_LINE';

        // Digits
        if (char >= '0' && char <= '9') {
            return `DIGIT_${char}`;
        }

        // Uppercase letters
        if (char >= 'A' && char <= 'Z') {
            return `LATIN_CAPITAL_LETTER_${char}`;
        }

        // Lowercase letters
        if (char >= 'a' && char <= 'z') {
            return `LATIN_SMALL_LETTER_${char.toUpperCase()}`;
        }

        return null;
    }

    /**
     * Check if a stat should be rendered as a thermometer bar
     * @param {string} key - Stat key name
     * @returns {boolean} True if stat should use thermometer display
     */
    isThermometerStat(key) {
        return key === 'health' || key === 'nutrition';
    }

    /**
     * Render a thermometer bar using FULL_BLOCK for fill and LIGHT_SHADE for background
     * @param {PIXI.Container} container - Container to add sprites to
     * @param {number} current - Current stat value
     * @param {number} max - Maximum stat value
     * @param {number} x - X position in pixels
     * @param {number} y - Y position in pixels
     */
    renderThermometerBar(container, current, max, x, y) {
        const totalTiles = Math.ceil(max / 10);
        const filledTiles = Math.ceil(current / 10);

        const fullBlockCoords = this.spriteLibrary.getTileByName('FULL_BLOCK');
        const lightShadeCoords = this.spriteLibrary.getTileByName('LIGHT_SHADE');

        if (!fullBlockCoords || !lightShadeCoords || !this.tileset) return;

        for (let i = 0; i < totalTiles; i++) {
            const tileCoords = i < filledTiles ? fullBlockCoords : lightShadeCoords;

            const rect = new PIXI.Rectangle(
                tileCoords.x * globalVars.TILE_WIDTH,
                tileCoords.y * globalVars.TILE_HEIGHT,
                globalVars.TILE_WIDTH,
                globalVars.TILE_HEIGHT
            );

            const texture = new PIXI.Texture(this.tileset.texture.baseTexture, rect);
            const sprite = new PIXI.Sprite(texture);

            sprite.x = x + (i * globalVars.TILE_WIDTH);
            sprite.y = y;

            container.addChild(sprite);
        }
    }

    /**
     * Render an item's tile sprite at a position
     * @param {PIXI.Container} container - Container to add sprite to
     * @param {Item} item - The item to render
     * @param {number} x - X position in pixels
     * @param {number} y - Y position in pixels
     */
    renderItemTile(container, item, x, y) {
        if (!item.tileIndex || !this.tileset) return;

        const rect = new PIXI.Rectangle(
            item.tileIndex.x * globalVars.TILE_WIDTH,
            item.tileIndex.y * globalVars.TILE_HEIGHT,
            globalVars.TILE_WIDTH,
            globalVars.TILE_HEIGHT
        );

        const texture = new PIXI.Texture(this.tileset.texture.baseTexture, rect);
        const sprite = new PIXI.Sprite(texture);

        sprite.x = x;
        sprite.y = y;

        // Apply item tint if present
        if (item.tint !== undefined && item.tint !== null) {
            sprite.tint = item.tint;
        }

        // Apply horizontal/vertical flip using anchor at center
        if (item.flipH || item.flipV) {
            sprite.anchor.set(0.5, 0.5);
            sprite.x += globalVars.TILE_WIDTH / 2;
            sprite.y += globalVars.TILE_HEIGHT / 2;
            sprite.scale.x = item.flipH ? -1 : 1;
            sprite.scale.y = item.flipV ? -1 : 1;
        }

        container.addChild(sprite);
    }

    /**
     * Create a text sprite for a single character
     * @param {string} char - Single character
     * @param {number} x - X position in pixels
     * @param {number} y - Y position in pixels
     * @param {number} tint - Color tint
     * @returns {PIXI.Sprite|null}
     */
    createCharSprite(char, x, y, tint = 0x000000) {
        const tileName = this.getTileNameForChar(char);
        if (!tileName) return null;

        const tileCoords = this.spriteLibrary.getTileByName(tileName);
        if (!tileCoords || !this.tileset) return null;

        const rect = new PIXI.Rectangle(
            tileCoords.x * globalVars.TILE_WIDTH,
            tileCoords.y * globalVars.TILE_HEIGHT,
            globalVars.TILE_WIDTH,
            globalVars.TILE_HEIGHT
        );

        const texture = new PIXI.Texture(this.tileset.texture.baseTexture, rect);
        const sprite = new PIXI.Sprite(texture);

        sprite.x = x;
        sprite.y = y;
        sprite.tint = tint;

        return sprite;
    }

    /**
     * Word-wrap text to fit within a maximum width
     * @param {string} text - Text to wrap
     * @param {number} maxWidth - Maximum width in characters
     * @returns {string[]} Array of lines
     */
    wrapText(text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        for (const word of words) {
            if (currentLine.length === 0) {
                currentLine = word;
            } else if (currentLine.length + 1 + word.length <= maxWidth) {
                currentLine += ' ' + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }

        if (currentLine.length > 0) {
            lines.push(currentLine);
        }

        return lines;
    }

    /**
     * Display a text box with auto-sizing and word wrap, stacked from top
     * @param {string} id - Unique identifier for this text box
     * @param {string} text - Text message to display
     * @param {object} options - Optional settings
     * @param {number} options.maxWidth - Max width in tiles (default: map width - 4)
     * @param {number} options.padding - Padding inside box in tiles (default: 1)
     * @param {number} options.textTint - Text color (default: black)
     * @param {number} options.fillColor - Background color (default: white)
     * @param {number} options.borderTint - Border color (default: black)
     * @param {boolean} options.dismissOnMove - Remove box when player moves (default: false)
     * @returns {PIXI.Container} The text box container
     */
    showTextBox(id, text, options = {}) {
        const mapWidth = this.engine.mapManager?.width || 30;

        const padding = options.padding ?? 1;
        const maxContentWidth = (options.maxWidth ?? (mapWidth - 4)) - (padding * 2) - 2; // -2 for borders
        const textTint = options.textTint ?? 0x000000;
        const fillColor = options.fillColor ?? 0xFFFFFF;
        const borderTint = options.borderTint ?? 0x000000;
        const dismissOnMove = options.dismissOnMove ?? false;

        // If this box already exists, remove it from stack first
        const existingIndex = this.textBoxStack.indexOf(id);
        if (existingIndex !== -1) {
            this.textBoxStack.splice(existingIndex, 1);
            this.removeBox(id);
        }

        // Clear any existing timer for this id
        this.clearAutoDisposeTimer(id);

        // If at max capacity, remove the oldest box
        if (this.textBoxStack.length >= this.maxTextBoxes) {
            const oldestId = this.textBoxStack.shift();
            this.removeBox(oldestId);
        }

        // Wrap text and calculate dimensions
        const lines = this.wrapText(text, maxContentWidth);
        const contentWidth = Math.max(...lines.map(line => line.length), 1);
        const contentHeight = lines.length;

        // Box dimensions (content + padding + borders)
        const boxWidth = contentWidth + (padding * 2) + 2;
        const boxHeight = contentHeight + (padding * 2) + 2;

        // Calculate Y position based on existing boxes in stack
        let yPosition = 0;
        for (const stackedId of this.textBoxStack) {
            const stackedBox = this.boxes.get(stackedId);
            if (stackedBox && stackedBox._boxHeight) {
                yPosition += stackedBox._boxHeight;
            }
        }

        // Center horizontally
        const x = Math.floor((mapWidth - boxWidth) / 2);
        const y = yPosition;

        // Create the box
        const boxContainer = this.createBox(id, x, y, boxWidth, boxHeight, {
            fillColor,
            borderTint
        });

        if (!boxContainer) return null;

        // Store box height for stacking calculations
        boxContainer._boxHeight = boxHeight;

        // Add to stack
        this.textBoxStack.push(id);

        // Handle dismissOnMove option
        if (dismissOnMove) {
            // Check if there's a player-controlled actor
            const hasPlayer = this.engine.entityManager?.actors.some(
                a => a.hasAttribute('controlled') && !a.isDead
            );

            if (hasPlayer) {
                // Dismiss on next player move
                this.dismissOnMoveBoxes.add(id);
            } else {
                // No player - auto dispose after timer (3 seconds + 1 second per line)
                const delay = 3000 + (lines.length * 1000);
                const timer = setTimeout(() => {
                    this.removeTextBox(id);
                }, delay);
                this.autoDisposeTimers.set(id, timer);
            }
        }

        // Add text sprites
        const textStartX = (padding + 1) * globalVars.TILE_WIDTH;
        const textStartY = (padding + 1) * globalVars.TILE_HEIGHT;

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            for (let charIndex = 0; charIndex < line.length; charIndex++) {
                const char = line[charIndex];
                const charX = textStartX + (charIndex * globalVars.TILE_WIDTH);
                const charY = textStartY + (lineIndex * globalVars.TILE_HEIGHT);

                const sprite = this.createCharSprite(char, charX, charY, textTint);
                if (sprite) {
                    boxContainer.addChild(sprite);
                }
            }
        }

        return boxContainer;
    }

    /**
     * Called when the player makes a move - dismisses relevant text boxes
     */
    onPlayerMove() {
        for (const id of [...this.dismissOnMoveBoxes]) {
            this.dismissOnMoveBoxes.delete(id);
            this.removeTextBox(id);
        }
    }

    /**
     * Clear an auto-dispose timer for a box
     */
    clearAutoDisposeTimer(id) {
        const timer = this.autoDisposeTimers.get(id);
        if (timer) {
            clearTimeout(timer);
            this.autoDisposeTimers.delete(id);
        }
    }

    /**
     * Remove a text box and reposition remaining stacked boxes
     * @param {string} id - Text box identifier
     */
    removeTextBox(id) {
        const index = this.textBoxStack.indexOf(id);
        if (index !== -1) {
            this.textBoxStack.splice(index, 1);
            this.removeBox(id);
            this.repositionTextBoxStack();
        } else {
            // Not a stacked text box, just remove normally
            this.removeBox(id);
        }
    }

    /**
     * Reposition all text boxes in the stack to fill gaps
     */
    repositionTextBoxStack() {
        let yPosition = 0;
        for (const id of this.textBoxStack) {
            const box = this.boxes.get(id);
            if (box) {
                box.y = yPosition * globalVars.TILE_HEIGHT;
                if (box._boxHeight) {
                    yPosition += box._boxHeight;
                }
            }
        }
    }

    /**
     * Clear all text boxes from the stack
     */
    clearTextBoxes() {
        for (const id of [...this.textBoxStack]) {
            this.removeBox(id);
        }
        this.textBoxStack = [];
    }

    /**
     * Toggle the player info box (show if hidden, hide if shown)
     * @param {Actor} player - The player actor
     * @returns {boolean} True if box is now visible, false if hidden
     */
    togglePlayerInfo(player) {
        const infoBoxId = 'player_info';

        // If already showing, hide it (resets inventory mode)
        if (this.boxes.has(infoBoxId)) {
            this.hidePlayerInfo();
            return false;
        }

        // Show player info and enable inventory mode
        this.showPlayerInfo(player);
        return true;
    }

    /**
     * Show the player info box
     * @param {Actor} player - The player actor
     */
    showPlayerInfo(player) {
        if (!player) return;

        this.clearTargetingHighlights();

        const infoBoxId = 'player_info';

        // Remove existing if present
        if (this.boxes.has(infoBoxId)) {
            this.removeBox(infoBoxId);
        }

        // Gather stats, separating thermometer stats from regular stats
        const regularStats = [];
        const thermometerStats = []; // { key, current, max, lineIndex }
        if (player.stats) {
            for (const [key, value] of Object.entries(player.stats)) {
                if (this.isThermometerStat(key)) {
                    // Get current and max values (handle both object and simple number formats)
                    const max = typeof value === 'object' ? value.max : value;
                    const current = typeof value === 'object' ? value.current : value;
                    // Skip thermometer stats with max <= 1 (1-hit death prototypes)
                    if (max > 1) {
                        thermometerStats.push({ key, current, max });
                    }
                } else {
                    // Regular stat - display as text
                    const displayValue = typeof value === 'object' ? value.current : value;
                    regularStats.push(`${this.capitalize(key)}: ${displayValue}`);
                }
            }
        }

        // Gather inventory items with letter prefixes
        const inventoryItems = []; // { text, item }
        if (player.inventory && player.inventory.length > 0) {
            for (let i = 0; i < player.inventory.length; i++) {
                const item = player.inventory[i];
                const letter = String.fromCharCode(97 + i); // 'a', 'b', 'c', etc.
                // Use getDisplayName() for identification-aware display, truncated for UI
                let displayName = item.getDisplayName ? item.getDisplayName() : item.name;
                displayName = this.truncateText(displayName, 16);
                let itemText = `${letter})  ${displayName}`; // Extra space for tile
                // Mark equipped items
                if (player.isItemEquipped(item)) {
                    itemText += ' (worn)';
                }
                inventoryItems.push({ text: itemText, item });
            }
        }

        // Build lines for the info box
        const lines = [];
        const thermometerLineIndices = []; // Track which lines have thermometer bars
        lines.push(player.name);
        lines.push('');

        const hasStats = thermometerStats.length > 0 || regularStats.length > 0;
        if (hasStats) {
            lines.push('Stats:');
            // Add thermometer stats first
            for (const stat of thermometerStats) {
                const label = `  ${this.capitalize(stat.key)}: `;
                thermometerLineIndices.push({ lineIndex: lines.length, label, stat });
                lines.push(label); // Placeholder - bar will be rendered separately
            }
            // Add regular stats
            for (const stat of regularStats) {
                lines.push('  ' + stat);
            }
        }

        const inventoryLineIndices = []; // Track which lines have item tiles
        if (inventoryItems.length > 0) {
            if (hasStats) lines.push('');
            lines.push('Inventory:');
            for (const { text, item } of inventoryItems) {
                inventoryLineIndices.push({ lineIndex: lines.length, item });
                lines.push('  ' + text);
            }
        } else {
            if (hasStats) lines.push('');
            lines.push('Inventory: (empty)');
        }

        // Calculate dimensions - account for thermometer bar widths
        const padding = 1;
        let maxLineLength = Math.max(...lines.map(l => l.length), 10);
        // Check if any thermometer bars would be wider
        for (const { label, stat } of thermometerLineIndices) {
            const barWidth = Math.ceil(stat.max / 10);
            const totalWidth = label.length + barWidth;
            if (totalWidth > maxLineLength) {
                maxLineLength = totalWidth;
            }
        }
        const contentWidth = maxLineLength;
        const contentHeight = lines.length;
        const boxWidth = contentWidth + (padding * 2) + 2;
        const boxHeight = contentHeight + (padding * 2) + 2;

        // Position box on opposite side from player to avoid covering them
        const mapWidth = this.engine.mapManager?.width || 30;
        const playerX = player.x || 0;
        const mapMidpoint = mapWidth / 2;

        // If player is on the right side, put box on left; otherwise put on right
        const x = playerX >= mapMidpoint ? 1 : mapWidth - boxWidth - 1;
        const y = 1;

        // Create the box
        const boxContainer = this.createBox(infoBoxId, x, y, boxWidth, boxHeight, {
            fillColor: 0xFFFFFF,
            borderTint: 0x000000
        });

        if (!boxContainer) return;

        // Store box position for item action menu positioning
        boxContainer._boxX = x;
        boxContainer._boxWidth = boxWidth;

        // Add text sprites
        const textStartX = (padding + 1) * globalVars.TILE_WIDTH;
        const textStartY = (padding + 1) * globalVars.TILE_HEIGHT;

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            for (let charIndex = 0; charIndex < line.length; charIndex++) {
                const char = line[charIndex];
                const charX = textStartX + (charIndex * globalVars.TILE_WIDTH);
                const charY = textStartY + (lineIndex * globalVars.TILE_HEIGHT);

                const sprite = this.createCharSprite(char, charX, charY, 0x000000);
                if (sprite) {
                    boxContainer.addChild(sprite);
                }
            }
        }

        // Render thermometer bars for health/nutrition stats
        for (const { lineIndex, label, stat } of thermometerLineIndices) {
            const barX = textStartX + (label.length * globalVars.TILE_WIDTH);
            const barY = textStartY + (lineIndex * globalVars.TILE_HEIGHT);
            this.renderThermometerBar(boxContainer, stat.current, stat.max, barX, barY);
        }

        // Render item tiles in inventory list
        // Format is "  a) [tile] Item Name" - tile goes after ") " which is at offset 5 (2 spaces + letter + ) + space)
        for (const { lineIndex, item } of inventoryLineIndices) {
            const tileX = textStartX + (5 * globalVars.TILE_WIDTH); // Position after "  a) "
            const tileY = textStartY + (lineIndex * globalVars.TILE_HEIGHT);
            this.renderItemTile(boxContainer, item, tileX, tileY);
        }

        // Enable inventory selection mode
        this.inventoryMode = true;
        this.currentPlayer = player;
        this.selectedItemIndex = null;
    }

    /**
     * Hide the player info box if it's showing
     */
    hidePlayerInfo() {
        this.removeBox('player_info');
        this.removeBox('item_action_menu');
        this.inventoryMode = false;
        this.currentPlayer = null;
        this.selectedItemIndex = null;
    }

    /**
     * Update the player info box if it's currently visible
     * Call this after turns complete to reflect stat changes
     */
    updatePlayerInfo() {
        if (this.inventoryMode && this.currentPlayer && this.boxes.has('player_info')) {
            // Re-render the player info box with updated stats
            this.showPlayerInfo(this.currentPlayer);
        }
    }

    /**
     * Check if the player info box is currently visible
     * @returns {boolean}
     */
    isPlayerInfoVisible() {
        return this.boxes.has('player_info');
    }

    /**
     * Show the item action menu for a selected inventory item
     * @param {number} itemIndex - Index of the item in player's inventory
     */
    showItemActionMenu(itemIndex) {
        if (!this.currentPlayer || !this.inventoryMode) return;
        if (itemIndex < 0 || itemIndex >= this.currentPlayer.inventory.length) return;

        this.clearTargetingHighlights();

        const item = this.currentPlayer.inventory[itemIndex];
        this.selectedItemIndex = itemIndex;

        // Remove existing action menu if present
        this.removeBox('item_action_menu');

        // Build menu lines
        const lines = [];
        lines.push(item.name);
        lines.push(''); // blank line

        // Add description if available
        const description = item.getAttribute('description');
        if (description) {
            // Word wrap description to fit in menu
            const wrappedDesc = this.wrapText(description, 20);
            for (const line of wrappedDesc) {
                lines.push(line);
            }
            lines.push(''); // blank line after description
        }

        // Add action options with number keys
        lines.push('Actions:');
        let actionNum = 1;

        // Check if item is currently equipped
        const isEquipped = this.currentPlayer.isItemEquipped(item);

        // Drop is always available
        lines.push(`  ${actionNum}) Drop`);
        actionNum++;

        // Wear option if item is wearable and not currently worn
        if (item.hasAttribute('wearable') && !isEquipped) {
            lines.push(`  ${actionNum}) Wear`);
            actionNum++;
        }

        // Remove option if item is currently worn
        if (isEquipped) {
            lines.push(`  ${actionNum}) Remove`);
            actionNum++;
        }

        // Use verb if available
        const useVerb = item.getAttribute('use_verb');
        if (useVerb) {
            lines.push(`  ${actionNum}) ${this.capitalize(useVerb)}`);
            actionNum++;
        }

        // Throw is always available
        lines.push(`  ${actionNum}) Throw`);
        actionNum++;

        // Calculate dimensions
        const padding = 1;
        const maxLineLength = Math.max(...lines.map(l => l.length), 12);
        const contentWidth = maxLineLength;
        const contentHeight = lines.length;
        const boxWidth = contentWidth + (padding * 2) + 2;
        const boxHeight = contentHeight + (padding * 2) + 2;

        // Position next to player info box
        const playerInfoBox = this.boxes.get('player_info');
        const mapWidth = this.engine.mapManager?.width || 30;
        let x;

        if (playerInfoBox && playerInfoBox._boxX !== undefined) {
            // Position adjacent to player info box
            const playerInfoRight = playerInfoBox._boxX + playerInfoBox._boxWidth;
            const playerInfoLeft = playerInfoBox._boxX;

            // Try to place on the opposite side from player info
            if (playerInfoLeft > boxWidth) {
                // Place to the left of player info
                x = playerInfoLeft - boxWidth;
            } else if (playerInfoRight + boxWidth < mapWidth) {
                // Place to the right of player info
                x = playerInfoRight;
            } else {
                // Fallback: overlap slightly
                x = Math.max(0, mapWidth - boxWidth - 1);
            }
        } else {
            // Fallback positioning
            x = Math.floor((mapWidth - boxWidth) / 2);
        }

        const y = 1;

        // Create the box
        const boxContainer = this.createBox('item_action_menu', x, y, boxWidth, boxHeight, {
            fillColor: 0xFFFFFF,
            borderTint: 0x000000
        });

        if (!boxContainer) return;

        // Add text sprites
        const textStartX = (padding + 1) * globalVars.TILE_WIDTH;
        const textStartY = (padding + 1) * globalVars.TILE_HEIGHT;

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            for (let charIndex = 0; charIndex < line.length; charIndex++) {
                const char = line[charIndex];
                const charX = textStartX + (charIndex * globalVars.TILE_WIDTH);
                const charY = textStartY + (lineIndex * globalVars.TILE_HEIGHT);

                const sprite = this.createCharSprite(char, charX, charY, 0x000000);
                if (sprite) {
                    boxContainer.addChild(sprite);
                }
            }
        }
    }

    /**
     * Close the item action menu
     */
    closeItemActionMenu() {
        this.removeBox('item_action_menu');
        this.selectedItemIndex = null;
    }

    /**
     * Handle keyboard input for inventory interaction
     * @param {string} key - The key that was pressed
     * @returns {boolean} True if the key was handled
     */
    handleInventoryKey(key) {
        if (!this.inventoryMode || !this.currentPlayer) return false;

        // If action menu is open, handle number keys for actions
        if (this.selectedItemIndex !== null) {
            if (key === 'Escape') {
                this.closeItemActionMenu();
                return true;
            }

            // Handle action selection (1, 2, 3, etc.)
            const actionNum = parseInt(key, 10);
            if (!isNaN(actionNum) && actionNum >= 1) {
                return this.executeItemAction(actionNum);
            }

            return false;
        }

        // Handle letter keys for item selection (a-z)
        if (key.length === 1 && key >= 'a' && key <= 'z') {
            const itemIndex = key.charCodeAt(0) - 97; // 'a' = 0, 'b' = 1, etc.
            if (itemIndex < this.currentPlayer.inventory.length) {
                this.showItemActionMenu(itemIndex);
                return true;
            }
        }

        // Escape closes the player info entirely
        if (key === 'Escape') {
            this.hidePlayerInfo();
            return true;
        }

        return false;
    }

    /**
     * Execute an item action based on the numbered option
     * @param {number} actionNum - The action number (1-based)
     * @returns {boolean} True if action was executed
     */
    executeItemAction(actionNum) {
        if (this.selectedItemIndex === null || !this.currentPlayer) return false;

        const item = this.currentPlayer.inventory[this.selectedItemIndex];
        if (!item) return false;

        // Build the action list to determine which action corresponds to which number
        let currentAction = 1;

        // Check if item is currently equipped
        const isEquipped = this.currentPlayer.isItemEquipped(item);

        // Action 1 is always Drop
        if (actionNum === currentAction) {
            this.executeDropItem(item);
            return true;
        }
        currentAction++;

        // Wear (if wearable and not worn)
        if (item.hasAttribute('wearable') && !isEquipped) {
            if (actionNum === currentAction) {
                this.executeWearItem(item);
                return true;
            }
            currentAction++;
        }

        // Remove (if worn)
        if (isEquipped) {
            if (actionNum === currentAction) {
                this.executeRemoveItem(item);
                return true;
            }
            currentAction++;
        }

        // Use verb action
        const useVerb = item.getAttribute('use_verb');
        if (useVerb) {
            if (actionNum === currentAction) {
                this.executeUseItem(item);
                return true;
            }
            currentAction++;
        }

        // Throw action (always available)
        if (actionNum === currentAction) {
            this.enterThrowAimingMode(item);
            return true;
        }
        currentAction++;

        return false;
    }

    /**
     * Drop an item from inventory
     */
    executeDropItem(item) {
        if (!this.currentPlayer) return;

        // Remove from inventory
        const index = this.currentPlayer.inventory.indexOf(item);
        if (index > -1) {
            this.currentPlayer.inventory.splice(index, 1);

            // Place item at player's position
            item.x = this.currentPlayer.x;
            item.y = this.currentPlayer.y;
            this.engine.entityManager.addEntity(item);

            console.log(`${this.currentPlayer.name} dropped ${item.name}`);
        }

        // Close menus and refresh
        this.closeItemActionMenu();
        this.showPlayerInfo(this.currentPlayer);
    }

    /**
     * Wear/equip an item
     */
    executeWearItem(item) {
        if (!this.currentPlayer) return;

        this.currentPlayer.equipItem(item);

        // Close menus and refresh
        this.closeItemActionMenu();
        this.showPlayerInfo(this.currentPlayer);
    }

    /**
     * Remove/unequip a worn item
     */
    executeRemoveItem(item) {
        if (!this.currentPlayer) return;

        this.currentPlayer.unequipItem(item);

        // Close menus and refresh
        this.closeItemActionMenu();
        this.showPlayerInfo(this.currentPlayer);
    }

    /**
     * Use an item (execute its use_verb action)
     */
    executeUseItem(item) {
        if (!this.currentPlayer) return;

        if (this.currentPlayer.useItem) {
            this.currentPlayer.useItem(item);
        }

        // Close menus and refresh
        this.closeItemActionMenu();
        this.showPlayerInfo(this.currentPlayer);
    }

    /**
     * Capitalize first letter of a string
     */
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Truncate text to a maximum length, adding ellipsis if needed
     * @param {string} text - The text to truncate
     * @param {number} maxLength - Maximum length before truncation
     * @returns {string} Truncated text with ellipsis if needed
     */
    truncateText(text, maxLength) {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength - 1) + '~';
    }

    /**
     * Clear targeting highlights (walk path, line path, tile highlight)
     * Called when opening UI boxes to avoid visual clutter
     */
    clearTargetingHighlights() {
        this.engine.renderer?.hideWalkPath();
        this.engine.renderer?.hideLinePath();
        this.engine.renderer?.hideTileHighlight();
    }

    /**
     * Show a confirmation dialog with Yes/No options
     * @param {string} message - The question to display
     * @param {function} onConfirm - Callback when user confirms (Y)
     * @param {function} onCancel - Callback when user cancels (N/Escape)
     */
    showConfirmDialog(message, onConfirm, onCancel) {
        // Remove any existing confirm dialog
        this.closeConfirmDialog();

        this.clearTargetingHighlights();

        // Store callbacks
        this.confirmDialog = { message, onConfirm, onCancel };

        // Build dialog lines
        const lines = [];

        // Word wrap the message
        const wrappedMessage = this.wrapText(message, 24);
        for (const line of wrappedMessage) {
            lines.push(line);
        }
        lines.push('');
        lines.push('  (Y)es  /  (N)o');

        // Calculate dimensions
        const padding = 1;
        const maxLineLength = Math.max(...lines.map(l => l.length), 16);
        const contentWidth = maxLineLength;
        const contentHeight = lines.length;
        const boxWidth = contentWidth + (padding * 2) + 2;
        const boxHeight = contentHeight + (padding * 2) + 2;

        // Center the dialog
        const mapWidth = this.engine.mapManager?.width || 30;
        const mapHeight = this.engine.mapManager?.height || 20;
        const x = Math.floor((mapWidth - boxWidth) / 2);
        const y = Math.floor((mapHeight - boxHeight) / 2);

        // Create the box
        const boxContainer = this.createBox('confirm_dialog', x, y, boxWidth, boxHeight, {
            fillColor: 0xFFFFFF,
            borderTint: 0x000000
        });

        if (!boxContainer) return;

        // Add text sprites
        const textStartX = (padding + 1) * globalVars.TILE_WIDTH;
        const textStartY = (padding + 1) * globalVars.TILE_HEIGHT;

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            for (let charIndex = 0; charIndex < line.length; charIndex++) {
                const char = line[charIndex];
                const charX = textStartX + (charIndex * globalVars.TILE_WIDTH);
                const charY = textStartY + (lineIndex * globalVars.TILE_HEIGHT);

                const sprite = this.createCharSprite(char, charX, charY, 0x000000);
                if (sprite) {
                    boxContainer.addChild(sprite);
                }
            }
        }
    }

    /**
     * Close the confirmation dialog
     */
    closeConfirmDialog() {
        this.removeBox('confirm_dialog');
        this.confirmDialog = null;
    }

    /**
     * Handle keyboard input for confirmation dialog
     * @param {string} key - The key that was pressed
     * @returns {boolean} True if the key was handled
     */
    handleConfirmKey(key) {
        if (!this.confirmDialog) return false;

        if (key === 'y' || key === 'Y') {
            const onConfirm = this.confirmDialog.onConfirm;
            this.closeConfirmDialog();
            if (onConfirm) onConfirm();
            return true;
        }

        if (key === 'n' || key === 'N' || key === 'Escape') {
            const onCancel = this.confirmDialog.onCancel;
            this.closeConfirmDialog();
            if (onCancel) onCancel();
            return true;
        }

        return true; // Consume all keys while dialog is open
    }

    /**
     * Check if a confirmation dialog is currently showing
     * @returns {boolean}
     */
    hasConfirmDialog() {
        return this.confirmDialog !== null;
    }

    // ========================================================================
    // THROW AIMING MODE
    // ========================================================================

    /**
     * Enter throw aiming mode for an item
     * @param {Item} item - The item to throw
     */
    enterThrowAimingMode(item) {
        this.throwAimingMode = true;
        this.throwItem = item;

        // Close the menus but keep player reference
        this.closeItemActionMenu();
        this.removeBox('player_info');

        // Show instruction message
        this.showTextBox('throw_instructions', 'Aim with mouse, click to throw. Esc to cancel.', {
            dismissOnMove: false
        });

        // Update the throw path based on current mouse position
        this.updateThrowPath();
    }

    /**
     * Exit throw aiming mode without throwing
     */
    exitThrowAimingMode() {
        this.throwAimingMode = false;
        this.throwItem = null;

        // Hide the line path
        this.engine.renderer?.hideLinePath();

        // Remove instruction message
        this.removeTextBox('throw_instructions');

        // Re-enable normal tile highlight
        this.engine.renderer?.hideTileHighlight();
    }

    /**
     * Update the throw path line based on current mouse position
     */
    updateThrowPath() {
        if (!this.throwAimingMode || !this.currentPlayer) return;

        const inputManager = this.engine.inputManager;
        if (!inputManager) return;

        const targetX = inputManager.hoveredTile.x;
        const targetY = inputManager.hoveredTile.y;

        // Don't draw path if mouse is off-screen or on player
        if (targetX < 0 || targetY < 0) {
            this.engine.renderer?.hideLinePath();
            return;
        }

        if (targetX === this.currentPlayer.x && targetY === this.currentPlayer.y) {
            this.engine.renderer?.hideLinePath();
            return;
        }

        // Show the line path from player to target
        this.engine.renderer?.showLinePath(
            this.currentPlayer.x,
            this.currentPlayer.y,
            targetX,
            targetY
        );
    }

    /**
     * Execute the throw at the current target position
     */
    executeThrow() {
        if (!this.throwAimingMode || !this.currentPlayer || !this.throwItem) return;

        const inputManager = this.engine.inputManager;
        if (!inputManager) return;

        const targetX = inputManager.hoveredTile.x;
        const targetY = inputManager.hoveredTile.y;

        // Don't throw if mouse is off-screen or on player
        if (targetX < 0 || targetY < 0) return;
        if (targetX === this.currentPlayer.x && targetY === this.currentPlayer.y) return;

        // Get the actual landing position (may be blocked by solid actor)
        const pathResult = this.engine.renderer?.showLinePath(
            this.currentPlayer.x,
            this.currentPlayer.y,
            targetX,
            targetY
        );

        if (!pathResult || pathResult.path.length === 0) return;

        // Store references before exiting aiming mode
        const item = this.throwItem;
        const player = this.currentPlayer;
        const path = pathResult.path;

        // Unequip item if it's being worn
        if (player.isItemEquipped(item)) {
            player.unequipItem(item);
        }

        // Remove item from inventory
        const index = player.inventory.indexOf(item);
        if (index > -1) {
            player.inventory.splice(index, 1);
        }

        // Exit aiming mode (hides line path)
        this.exitThrowAimingMode();

        // Determine if we'll hit something (for sound selection)
        const landingPoint = path[path.length - 1];
        const hitActor = this.engine.entityManager?.getActorAt(landingPoint.x, landingPoint.y);
        const willHit = hitActor && !hitActor.isDead && hitActor.hasAttribute('solid');

        // Play sound before animation starts so they sync better
        if (willHit) {
            const collisionSound = item.getAttribute('collision_sound') || 'arrow_hit';
            this.engine.playSound(collisionSound);
        } else {
            this.engine.playSound('arrow_miss');
        }

        // Animate the projectile, then apply effects
        this.animateProjectile(item, path, () => {
            this.completeThrow(item, player, path, willHit);
        });
    }

    /**
     * Animate a projectile moving along a path
     * @param {Item} item - The item being thrown
     * @param {Array} path - Array of {x, y} points
     * @param {Function} onComplete - Callback when animation finishes
     */
    animateProjectile(item, path, onComplete) {
        const renderer = this.engine.renderer;
        if (!renderer || path.length === 0) {
            onComplete();
            return;
        }

        const tileWidth = this.engine.config.tileWidth;
        const tileHeight = this.engine.config.tileHeight;
        const tileset = PIXI.Loader.shared.resources.tiles;

        if (!tileset || !item.tileIndex) {
            onComplete();
            return;
        }

        // Create projectile sprite
        const rect = new PIXI.Rectangle(
            item.tileIndex.x * tileWidth,
            item.tileIndex.y * tileHeight,
            tileWidth,
            tileHeight
        );
        const texture = new PIXI.Texture(tileset.texture.baseTexture, rect);
        const projectileSprite = new PIXI.Sprite(texture);

        // Apply item tint if present
        if (item.tint !== undefined && item.tint !== null) {
            projectileSprite.tint = item.tint;
        }

        // Apply flip if present
        if (item.flipH || item.flipV) {
            projectileSprite.anchor.set(0.5, 0.5);
            projectileSprite.scale.x = item.flipH ? -1 : 1;
            projectileSprite.scale.y = item.flipV ? -1 : 1;
        }

        projectileSprite.zIndex = 100; // Above everything
        renderer.uiContainer.addChild(projectileSprite);

        // Animate through path
        let currentIndex = 0;
        const frameDelay = 25; // milliseconds per tile

        const animateFrame = () => {
            if (currentIndex >= path.length) {
                // Animation complete - remove sprite and call callback
                renderer.uiContainer.removeChild(projectileSprite);
                projectileSprite.destroy();
                onComplete();
                return;
            }

            const point = path[currentIndex];

            // Position sprite (account for anchor if flipped)
            if (item.flipH || item.flipV) {
                projectileSprite.x = point.x * tileWidth + tileWidth / 2;
                projectileSprite.y = point.y * tileHeight + tileHeight / 2;
            } else {
                projectileSprite.x = point.x * tileWidth;
                projectileSprite.y = point.y * tileHeight;
            }

            currentIndex++;
            setTimeout(animateFrame, frameDelay);
        };

        // Start animation
        animateFrame();
    }

    /**
     * Complete the throw after animation - apply effects and place item
     * @param {Item} item - The thrown item
     * @param {Actor} player - The player who threw it
     * @param {Array} path - The path the item traveled
     * @param {boolean} willHit - Whether the throw hits a solid actor
     */
    completeThrow(item, player, path, willHit) {
        const landingPoint = path[path.length - 1];
        const isExplosive = item.hasAttribute('explosive');

        // Handle explosive items - they create a cloud and are always destroyed
        if (isExplosive) {
            this.createExplosiveCloud(item, landingPoint.x, landingPoint.y);
            const displayName = item.getDisplayName ? item.getDisplayName() : item.name;
            this.engine.inputManager?.showMessage(`The ${displayName} explodes!`);

            // This counts as a player action
            this.engine.inputManager?.onPlayerAction();
            return;
        }

        if (willHit) {
            // Get the actor we're hitting
            const hitActor = this.engine.entityManager?.getActorAt(landingPoint.x, landingPoint.y);

            if (hitActor) {
                // Apply collision effect if the item has one
                const collisionEffect = item.getAttribute('collision_effect');
                if (collisionEffect) {
                    // Apply effects manually (similar to applyCollisionEffects but simpler)
                    for (const [key, rawValue] of Object.entries(collisionEffect)) {
                        // Resolve attribute references
                        const value = player.resolveAttributeValue(rawValue, player);

                        if (hitActor.stats && hitActor.stats[key] !== undefined) {
                            const stat = hitActor.stats[key];
                            if (typeof stat === 'object' && stat.current !== undefined) {
                                stat.current = Math.max(0, stat.current + value);
                                if (key === 'health' && stat.current <= 0) {
                                    hitActor.die();
                                }
                            }
                        }
                    }
                    hitActor.flash?.();
                }

                // Show hit message
                const displayName = item.getDisplayName ? item.getDisplayName() : item.name;
                this.engine.inputManager?.showMessage(`The ${displayName} hits the ${hitActor.name}!`);
            }

            // Item lands at the tile before the hit (or destroyed if breakable)
            // Items are breakable_on_throw by default (like Brogue) unless explicitly set to false
            const breakable = item.getAttribute('breakable_on_throw') !== false;
            if (breakable) {
                // Item is destroyed on impact
                const displayName = item.getDisplayName ? item.getDisplayName() : item.name;
                this.engine.inputManager?.showMessage(`The ${displayName} shatters!`);
            } else if (path.length > 1) {
                // Land one tile before the blocked tile
                const landBeforeHit = path[path.length - 2];
                item.x = landBeforeHit.x;
                item.y = landBeforeHit.y;
                this.engine.entityManager.addEntity(item);
            } else {
                // Path was only 1 tile, land at player's feet
                item.x = player.x;
                item.y = player.y;
                this.engine.entityManager.addEntity(item);
            }
        } else {
            // No hit - item lands at target
            item.x = landingPoint.x;
            item.y = landingPoint.y;
            this.engine.entityManager.addEntity(item);

            const displayName = item.getDisplayName ? item.getDisplayName() : item.name;
            this.engine.inputManager?.showMessage(`You throw the ${displayName}.`);
        }

        // This counts as a player action
        this.engine.inputManager?.onPlayerAction();
    }

    /**
     * Create an explosive cloud from a thrown item
     * Spawns a cloud actor with the item's tint and use_effect as collision_effect
     * @param {Item} item - The explosive item
     * @param {number} x - Landing X coordinate
     * @param {number} y - Landing Y coordinate
     */
    createExplosiveCloud(item, x, y) {
        const entityManager = this.engine.entityManager;
        if (!entityManager) return;

        // Spawn the origin cloud
        const cloud = entityManager.spawnActor('cloud', x, y);
        if (!cloud) return;

        // Set cloud properties from the item
        cloud.tint = item.tint;

        // Use the item's use_effect as the cloud's collision_effect
        const useEffect = item.getAttribute('use_effect');
        if (useEffect && typeof useEffect === 'object') {
            cloud.setAttribute('collision_effect', useEffect);
        }

        // Mark as origin cloud so it spreads
        cloud.isCloudOrigin = true;
        cloud.cloudOriginX = x;
        cloud.cloudOriginY = y;

        // Get lifetime from item, or fall back to cloud actor's default lifetime
        cloud.cloudLifetime = item.getAttribute('cloud_lifetime') || cloud.lifetime || 10;

        // Update sprite tints
        if (cloud.spriteBase) cloud.spriteBase.tint = item.tint;
        if (cloud.spriteTop) cloud.spriteTop.tint = item.tint;
    }

    /**
     * Handle keyboard input during throw aiming mode
     * @param {string} key - The key pressed
     * @returns {boolean} True if key was handled
     */
    handleThrowKey(key) {
        if (!this.throwAimingMode) return false;

        if (key === 'Escape') {
            this.exitThrowAimingMode();
            return true;
        }

        return true; // Consume all keys while in throw mode
    }

    /**
     * Handle mouse click during throw aiming mode
     * @returns {boolean} True if click was handled
     */
    handleThrowClick() {
        if (!this.throwAimingMode) return false;

        this.executeThrow();
        return true;
    }

    /**
     * Check if in throw aiming mode
     * @returns {boolean}
     */
    isThrowAiming() {
        return this.throwAimingMode;
    }

    // ========================================================================
    // THROW ITEM MENU (T key)
    // ========================================================================

    /**
     * Show a menu to select an item to throw
     * @param {Actor} player - The player actor
     */
    showThrowItemMenu(player) {
        if (!player || !player.inventory || player.inventory.length === 0) {
            // No items to throw
            this.showTextBox('throw_menu_empty', 'You have nothing to throw.', {
                dismissOnMove: true
            });
            return;
        }

        this.clearTargetingHighlights();

        this.currentPlayer = player;
        this.throwMenuMode = true;

        const menuId = 'throw_item_menu';

        // Remove existing if present
        if (this.boxes.has(menuId)) {
            this.removeBox(menuId);
        }

        // Build menu lines
        const lines = [];
        lines.push('Throw which item?');
        lines.push('');

        // List all inventory items with letter keys
        for (let i = 0; i < player.inventory.length; i++) {
            const item = player.inventory[i];
            const letter = String.fromCharCode(97 + i); // 'a', 'b', 'c', etc.
            let displayName = item.getDisplayName ? item.getDisplayName() : item.name;
            displayName = this.truncateText(displayName, 16);
            let itemText = `${letter})  ${displayName}`;
            // Mark equipped items
            if (player.isItemEquipped(item)) {
                itemText += ' (worn)';
            }
            lines.push('  ' + itemText);
        }

        lines.push('');
        lines.push('Esc to cancel');

        // Calculate dimensions
        const padding = 1;
        const maxLineLength = Math.max(...lines.map(l => l.length), 16);
        const contentWidth = maxLineLength;
        const contentHeight = lines.length;
        const boxWidth = contentWidth + (padding * 2) + 2;
        const boxHeight = contentHeight + (padding * 2) + 2;

        // Center the dialog
        const mapWidth = this.engine.mapManager?.width || 30;
        const mapHeight = this.engine.mapManager?.height || 20;
        const x = Math.floor((mapWidth - boxWidth) / 2);
        const y = Math.floor((mapHeight - boxHeight) / 2);

        // Create the box
        const boxContainer = this.createBox(menuId, x, y, boxWidth, boxHeight, {
            fillColor: 0xFFFFFF,
            borderTint: 0x000000
        });

        if (!boxContainer) return;

        // Add text sprites
        const textStartX = (padding + 1) * globalVars.TILE_WIDTH;
        const textStartY = (padding + 1) * globalVars.TILE_HEIGHT;

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            for (let charIndex = 0; charIndex < line.length; charIndex++) {
                const char = line[charIndex];
                const charX = textStartX + (charIndex * globalVars.TILE_WIDTH);
                const charY = textStartY + (lineIndex * globalVars.TILE_HEIGHT);

                const sprite = this.createCharSprite(char, charX, charY, 0x000000);
                if (sprite) {
                    boxContainer.addChild(sprite);
                }
            }
        }

        // Render item tiles (offset for "  a) " = 5 chars)
        for (let i = 0; i < player.inventory.length; i++) {
            const item = player.inventory[i];
            const lineIndex = i + 2; // Account for header and blank line
            const tileX = textStartX + (5 * globalVars.TILE_WIDTH);
            const tileY = textStartY + (lineIndex * globalVars.TILE_HEIGHT);
            this.renderItemTile(boxContainer, item, tileX, tileY);
        }
    }

    /**
     * Close the throw item menu
     */
    closeThrowItemMenu() {
        this.removeBox('throw_item_menu');
        this.throwMenuMode = false;
    }

    /**
     * Handle keyboard input for throw item menu
     * @param {string} key - The key pressed
     * @returns {boolean} True if key was handled
     */
    handleThrowMenuKey(key) {
        if (!this.throwMenuMode || !this.currentPlayer) return false;

        if (key === 'Escape') {
            this.closeThrowItemMenu();
            return true;
        }

        // Handle letter keys for item selection (a-z)
        if (key.length === 1 && key >= 'a' && key <= 'z') {
            const itemIndex = key.charCodeAt(0) - 97; // 'a' = 0, 'b' = 1, etc.
            if (itemIndex < this.currentPlayer.inventory.length) {
                const item = this.currentPlayer.inventory[itemIndex];
                this.closeThrowItemMenu();
                this.enterThrowAimingMode(item);
                return true;
            }
        }

        return true; // Consume all keys while menu is open
    }
}
