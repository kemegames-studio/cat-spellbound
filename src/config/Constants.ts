export const PALETTE = {
  bgDeep:       0x0a0418,
  bgMid:        0x1a0a3a,
  bgLight:      0x2d1b69,
  purple:       0x4a1484,
  purpleLight:  0x7b2fff,
  purplePale:   0x9d6fff,
  gold:         0xffd700,
  goldDark:     0xffa500,
  goldPale:     0xffe566,
  green:        0x00ff88,
  greenDark:    0x00cc66,
  cyan:         0x00eeff,
  pink:         0xff44aa,
  white:        0xffffff,
  dark:         0x110633,
  shadow:       0x00000088,
} as const;

export const TILE_COLORS: Record<string, number> = {
  star:    0xffd700,
  potion:  0xaa33ff,
  gem:     0x00eeff,
  book:    0xff6644,
  crystal: 0xff44cc,
  portal:  0x00ff88,
};

export const ENERGY_COLORS: Record<string, number> = {
  light:  0xffd700,
  mana:   0x7b2fff,
  arcane: 0x00eeff,
};

export const GAME_WIDTH  = 390;
export const GAME_HEIGHT = 844;

export const BOARD_COLS = 7;
export const BOARD_ROWS = 8;
export const TILE_SIZE  = 50;
export const TILE_GAP   = 4;

export const BOARD_OFFSET_X = (GAME_WIDTH - (BOARD_COLS * (TILE_SIZE + TILE_GAP) - TILE_GAP)) / 2;
export const BOARD_OFFSET_Y = 220;

export const MATCH_MIN = 3;

/** Charge Up alias — used by the modular board layer. */
export const CHAIN_MIN = MATCH_MIN;

export const SPELL_CHARGE_NEEDED = 12;

/** Charge Up alias — used by the ability/power layer. */
export const COMPONENT_CHARGE_NEEDED = SPELL_CHARGE_NEEDED;

export const DEPTHS = {
  bg:         0,
  board:      10,
  tiles:      20,
  effects:    30,
  ui:         40,
  overlay:    50,
  companion:  60,
  hud:        70,
  popup:      80,
} as const;

export const ANIM = {
  // ── Core board ───────────────────────────────
  tileSwap:       200,   // swap slide duration (ms)
  tileFall:       280,   // gravity drop base duration
  tileDestroy:    180,   // match pop + fade out
  tileSpawn:      280,   // refill tile drop-in
  // ── Cascade / combo ──────────────────────────
  cascadeDelay:   100,   // pause between cascade rounds
  comboDelay:     120,   // stagger between individual tile clears
  comboFlash:     400,   // full-screen combo flash
  // ── Spells / abilities ───────────────────────
  spellCast:      600,   // ability cast buildup
  // ── Scene ────────────────────────────────────
  screenShake:    300,
} as const;

export const LEVELS = [
  { id: 1,  moves: 22, target: 800,   objectives: [{ type: 'star',   count: 15 }] },
  { id: 2,  moves: 20, target: 1200,  objectives: [{ type: 'potion', count: 12 }, { type: 'star', count: 10 }] },
  { id: 3,  moves: 18, target: 1600,  objectives: [{ type: 'gem',    count: 10 }, { type: 'book', count: 8  }] },
  { id: 4,  moves: 24, target: 2000,  objectives: [{ type: 'star',   count: 20 }, { type: 'gem',  count: 15 }] },
  { id: 5,  moves: 16, target: 2400,  objectives: [{ type: 'potion', count: 18 }, { type: 'crystal', count: 10 }] },
  { id: 6,  moves: 20, target: 3000,  objectives: [{ type: 'star',   count: 25 }, { type: 'book', count: 12 }] },
  { id: 7,  moves: 18, target: 3500,  objectives: [{ type: 'gem',    count: 20 }, { type: 'crystal', count: 15 }] },
  { id: 8,  moves: 15, target: 4000,  objectives: [{ type: 'potion', count: 20 }, { type: 'star', count: 18 }] },
  { id: 9,  moves: 22, target: 4500,  objectives: [{ type: 'star',   count: 30 }, { type: 'gem',  count: 20 }] },
  { id: 10, moves: 20, target: 5000,  objectives: [{ type: 'crystal',count: 20 }, { type: 'book', count: 15 }] },
  { id: 11, moves: 18, target: 5500,  objectives: [{ type: 'star',   count: 28 }, { type: 'potion', count: 22 }] },
  { id: 12, moves: 16, target: 6000,  objectives: [{ type: 'gem',    count: 25 }, { type: 'crystal', count: 18 }] },
] as const;

export type TileType    = 'star' | 'potion' | 'gem' | 'book' | 'crystal';
export type EnergyType  = 'light' | 'mana' | 'arcane';
export type SpellType   = 'lightning_storm' | 'healing_burst' | 'portal_vortex' | 'meteor' | 'rainbow' | 'cat_summon';

export const TILE_TO_ENERGY: Record<TileType, EnergyType> = {
  star:    'light',
  potion:  'mana',
  gem:     'arcane',
  book:    'light',
  crystal: 'arcane',
};

export const SPELL_FUSIONS: Array<{ a: EnergyType; b: EnergyType; spell: SpellType }> = [
  { a: 'light',  b: 'mana',   spell: 'healing_burst' },
  { a: 'mana',   b: 'arcane', spell: 'portal_vortex' },
  { a: 'light',  b: 'arcane', spell: 'lightning_storm' },
];
