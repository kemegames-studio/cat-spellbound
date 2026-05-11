// ─────────────────────────────────────────────────────────────────────────────
// EffectPresets.ts
//
// Central configuration for every visual effect in the game.
// No Phaser imports — pure data that EffectsManager reads at runtime.
//
// Changing a number here (e.g. particle count, lifespan, shake intensity)
// takes effect everywhere without touching effect logic.
//
// Quality tiers let mobile devices automatically reduce particle budgets:
//   high   → 100 % (desktop / high-end phones)
//   medium →  60 % (mid-range phones, default)
//   low    →  30 % (older/budget devices, battery-saver mode)
// ─────────────────────────────────────────────────────────────────────────────

import { DEPTHS, PALETTE } from '../../config/Constants';

// ── Quality system ────────────────────────────────────────────────────────────

export type QualityTier = 'high' | 'medium' | 'low';

export const QUALITY_SCALE: Record<QualityTier, number> = {
  high:   1.00,
  medium: 0.60,
  low:    0.30,
} as const;

/** Scale a base particle count to the current quality tier. */
export function scaledCount(base: number, quality: QualityTier): number {
  return Math.max(1, Math.round(base * QUALITY_SCALE[quality]));
}

// ── Depth layers ──────────────────────────────────────────────────────────────
// Fine-grained sub-slots within the coarse DEPTHS bands from Constants.ts.

export const FX_DEPTH = {
  // Board-level effects (behind tiles)
  boardHighlight:  DEPTHS.effects - 1,   // 29  tile outline rings, sweeps

  // Normal effects (between tiles and overlay)
  particles:       DEPTHS.effects,       // 30
  particlesPlus:   DEPTHS.effects + 1,   // 31  extra sparks / star burst
  rings:           DEPTHS.effects + 2,   // 32  ring expansions, portal
  bolts:           DEPTHS.effects + 3,   // 33  lightning / arc
  projectiles:     DEPTHS.effects + 4,   // 34  meteor body
  spellBurst:      DEPTHS.effects + 5,   // 35  spell cast center burst

  // Overlay-level effects (above everything except HUD)
  screenFlash:     DEPTHS.overlay + 2,   // 52
  comboText:       DEPTHS.overlay,       // 50
  victoryBurst:    DEPTHS.overlay + 1,   // 51
  debug:           DEPTHS.popup + 10,    // far top for debug labels
} as const;

// ── Effect preset interfaces ──────────────────────────────────────────────────

export interface ParticlePreset {
  texture:    string;
  count:      number;
  speed:      { min: number; max: number };
  lifespan:   number;
  scale:      { start: number; end: number };
  alpha:      { start: number; end: number };
  depth:      number;
}

export interface RingPreset {
  lineWidth:  number;
  startR:     number;
  endScale:   number;
  alpha:      number;
  duration:   number;
}

export interface ShakePreset {
  intensity:  number;   // passed as camera.shake magnitude * 0.001
  duration:   number;
}

export interface FlashPreset {
  color:      number;
  alpha:      number;
  duration:   number;
}

// ── Match burst ───────────────────────────────────────────────────────────────

export const PRESET_MATCH_SPARK: ParticlePreset = {
  texture:  'particle_spark',
  count:    8,               // base; + matchSize * 3 added at call site
  speed:    { min: 60, max: 160 },
  lifespan: 420,
  scale:    { start: 0.9, end: 0 },
  alpha:    { start: 1,   end: 0 },
  depth:    FX_DEPTH.particles,
};

export const PRESET_MATCH_STAR: ParticlePreset = {
  texture:  'particle_star',
  count:    7,
  speed:    { min: 40, max: 130 },
  lifespan: 700,
  scale:    { start: 1.1, end: 0 },
  alpha:    { start: 1,   end: 0 },
  depth:    FX_DEPTH.particlesPlus,
};

/** matchSize threshold for the secondary star burst. */
export const MATCH_STAR_THRESHOLD = 4;

/** matchSize threshold that triggers a brief camera bump. */
export const MATCH_SHAKE_THRESHOLD = 5;

// ── Select / invalid ─────────────────────────────────────────────────────────

export const PRESET_SELECT: ParticlePreset = {
  texture:  'particle_orb',
  count:    7,
  speed:    { min: 30, max: 80 },
  lifespan: 350,
  scale:    { start: 0.7, end: 0 },
  alpha:    { start: 0.9, end: 0 },
  depth:    FX_DEPTH.particles,
};

export const PRESET_INVALID_RING: RingPreset = {
  lineWidth: 3,
  startR:    26,
  endScale:  1.6,
  alpha:     0,
  duration:  380,
};

// ── Portal teleport ───────────────────────────────────────────────────────────

export const PRESET_PORTAL: ParticlePreset = {
  texture:  'particle_orb',
  count:    12,
  speed:    { min: 20, max: 65 },
  lifespan: 600,
  scale:    { start: 1, end: 0 },
  alpha:    { start: 0.8, end: 0 },
  depth:    FX_DEPTH.particles,
};

// ── Spell cast ────────────────────────────────────────────────────────────────

export const PRESET_SPELL_BURST: ParticlePreset = {
  texture:  'particle_flare',
  count:    22,
  speed:    { min: 80, max: 320 },
  lifespan: 820,
  scale:    { start: 1.4, end: 0 },
  alpha:    { start: 1,   end: 0 },
  depth:    FX_DEPTH.spellBurst,
};

/** Number of expanding rings in spell cast. */
export const SPELL_RING_COUNT = 3;

// ── Meteor ────────────────────────────────────────────────────────────────────

export const PRESET_METEOR_TRAIL: ParticlePreset = {
  texture:  'particle_flare',
  count:    2,
  speed:    { min: 5, max: 30 },
  lifespan: 260,
  scale:    { start: 0.8, end: 0 },
  alpha:    { start: 0.7, end: 0 },
  depth:    FX_DEPTH.projectiles - 1,
};

export const METEOR_TRAVEL_MS = 420;

// ── Lightning ─────────────────────────────────────────────────────────────────

export const LIGHTNING_SEGMENTS  = 9;
export const LIGHTNING_JITTER    = 16;  // ± px offset per segment
export const LIGHTNING_FADE_MS   = 340;

// ── Shockwave (EMP / area blast) ─────────────────────────────────────────────

export interface ShockwavePreset {
  ringCount: number;
  baseR:     number;
  endScale:  number;
  duration:  number;
  gap:       number;   // ms between rings
}

export const PRESET_SHOCKWAVE: ShockwavePreset = {
  ringCount: 3,
  baseR:     18,
  endScale:  6,
  duration:  500,
  gap:       80,
};

// ── Screen feedback ───────────────────────────────────────────────────────────

export const SHAKE_LIGHT:  ShakePreset = { intensity: 2,  duration: 80  };
export const SHAKE_MEDIUM: ShakePreset = { intensity: 6,  duration: 200 };
export const SHAKE_HARD:   ShakePreset = { intensity: 12, duration: 380 };
export const SHAKE_MAX:    ShakePreset = { intensity: 18, duration: 480 };

export const FLASH_GOLD:   FlashPreset = { color: PALETTE.gold,        alpha: 0.3, duration: 200 };
export const FLASH_WHITE:  FlashPreset = { color: PALETTE.white,       alpha: 0.4, duration: 180 };
export const FLASH_RED:    FlashPreset = { color: 0xff2200,            alpha: 0.35, duration: 280 };
export const FLASH_CYAN:   FlashPreset = { color: PALETTE.cyan,        alpha: 0.25, duration: 220 };
export const FLASH_PURPLE: FlashPreset = { color: PALETTE.purpleLight, alpha: 0.3,  duration: 250 };

// ── Victory ───────────────────────────────────────────────────────────────────

export const PRESET_VICTORY: ParticlePreset = {
  texture:  'particle_star',
  count:    14,
  speed:    { min: 80, max: 220 },
  lifespan: 1100,
  scale:    { start: 1.2, end: 0 },
  alpha:    { start: 1,   end: 0 },
  depth:    FX_DEPTH.victoryBurst,
};

export const VICTORY_WAVE_COUNT  = 6;
export const VICTORY_WAVE_GAP_MS = 180;

// ── Board sweeps (ability feedback) ──────────────────────────────────────────

export const SWEEP_ALPHA   = 0.42;
export const SWEEP_FADE_MS = 320;
export const SWEEP_HOLD_MS = 60;

// ── Tile highlight (persistent glow ring) ────────────────────────────────────

export const HIGHLIGHT_LINE_W  = 3;
export const HIGHLIGHT_PULSE_D = 700;   // ms per pulse half-cycle
export const HIGHLIGHT_MIN_A   = 0.28;
export const HIGHLIGHT_MAX_A   = 0.92;
