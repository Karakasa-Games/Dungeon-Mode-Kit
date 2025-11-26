let tiles = []; 
let tileMap = [];
let spritesheet;
let spritesheetData;
let baseColor;
let colors = []; 
let sounds = [];
// Function to convert x, y coordinates to an index
function xyToIndex(x, y) {
  return y * 23 + x;
}


const globalVars = {
  SPRITESHEET_PATH: '/assets/sprites/static-tiles.png',
  SPRITE_DATA_PATH: '/data/sprites/static-tiles.json',
  TILE_WIDTH: 40,
  TILE_HEIGHT: 30,
  TILE_HALF_WIDTH: 20,
  TILE_HALF_HEIGHT: 15,
  CANVAS_COLS: 65,
  CANVAS_ROWS: 60,
  SPRITESHEET_COLS: 23,
  SPRITESHEET_ROWS: 11,
  MAX_TILES: 65 * 60, // CANVAS_COLS * CANVAS_ROWS
};

// Attach to window
window.myAppGlobals = globalVars;