// ─────────────────────────────────────────────────────────────────────────────
// AbilityDefinitions.ts
//
// Data-driven ability catalog.  Every ability is fully described as a sequence
// of AbilityEffect steps — no board logic lives here, only descriptors.
//
// AbilityEffectHandler.ts reads these and dispatches to concrete handlers.
// AbilityExecutor.ts iterates the effects list and sums tiles cleared.
//
// To add a new ability for live-ops:
//   1. Add its AbilityType to ComponentTypes.ts.
//   2. Add a FullAbilityDef entry in ABILITY_CATALOG below.
//   3. Register a handler in AbilityEffectHandler if you need a new EffectType.
// ─────────────────────────────────────────────────────────────────────────────

import type { AbilityType, PowerType } from '../board/ComponentTypes';
import { ABILITY_DEFINITIONS }        from '../board/ComponentTypes';

// ── Effect type union ─────────────────────────────────────────────────────────

export type EffectType =
  | 'clear_column'    // clearColumn(col) for N random columns
  | 'clear_row'       // clearRow(row) for N random rows
  | 'clear_radius'    // clearRadius(col, row, radius) at a random center
  | 'clear_type'      // clearAllOfType(mostCommon|specified)
  | 'chain_reaction'  // stagger-clear N individual random tiles
  | 'restore_moves'   // award N extra moves to the player
  | 'board_modifier'  // apply a board-state change (reserved for Phase 3+)
  | 'screen_effect'   // purely visual — camera flash/shake, no tile change
  | 'score_bonus'     // flat score award (no tile clear; for future combos)
  | 'spawn_special';  // place a special tile (reserved for Phase 3+)

// ── Effect descriptor ─────────────────────────────────────────────────────────

export interface AbilityEffect {
  type:   EffectType;
  /**
   * Loose params bag — each handler picks the keys it needs.
   *
   * Common keys by effect type:
   *   clear_column    → { count: number }
   *   clear_row       → { count: number }
   *   clear_radius    → { radius: number }
   *   clear_type      → { mode: 'most_common' | string }
   *   chain_reaction  → { count: number, staggerMs: number }
   *   restore_moves   → { count: number }
   *   screen_effect   → { kind: 'flash'|'shake', color?: number, alpha?: number, duration?: number }
   *   score_bonus     → { points: number }
   *   spawn_special   → { tileType: string, count: number }
   *   board_modifier  → { kind: string, params: unknown }
   */
  params: Record<string, unknown>;
}

// ── Full ability definition ───────────────────────────────────────────────────

export type UnlockMode = 'fusion' | 'single';

export interface FullAbilityDef {
  id:          AbilityType;
  name:        string;
  description: string;
  icon:        string;
  color:       number;

  unlockMode:  UnlockMode;
  /** Primary power meter (always required). */
  powerA:      PowerType;
  /** Secondary meter for fusion abilities; omitted for single-power ones. */
  powerB?:     PowerType;

  /** Ordered list of effects to execute on cast. */
  effects:     AbilityEffect[];

  /** Total cast animation budget in ms; caller waits this long before refill. */
  castDuration: number;

  /**
   * Cooldown policy:
   *   'moves'        — N player moves must pass before the slot can refill.
   *   'energy_reset' — the meter simply refills from zero (default, no gate).
   *   'none'         — slot becomes available immediately after cast.
   */
  cooldownMode:  'moves' | 'energy_reset' | 'none';
  /** Move count for 'moves' mode; ignored otherwise. */
  cooldownValue: number;

  /** Visual tier for future badge rendering: 1 = common, 3 = legendary. */
  tier: 1 | 2 | 3;

  /** Searchable tags used by live-ops, analytics, and A/B testing. */
  tags:    string[];
  /** Semver string for tracking definition changes across game versions. */
  version: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Ability catalog
// ══════════════════════════════════════════════════════════════════════════════

export const ABILITY_CATALOG: Record<AbilityType, FullAbilityDef> = {

  // ── Tier-1 fusion abilities ─────────────────────────────────────────────────

  arc_discharge: {
    id: 'arc_discharge',
    ...ABILITY_DEFINITIONS.arc_discharge,
    unlockMode:  'fusion',
    powerA:      'charge',
    powerB:      'heat',
    effects: [
      {
        type:   'screen_effect',
        params: { kind: 'flash', color: 0xffd700, alpha: 0.28, duration: 200 },
      },
      {
        type:   'clear_column',
        params: { count: 2 },
      },
    ],
    castDuration:  800,
    cooldownMode:  'energy_reset',
    cooldownValue: 0,
    tier:    1,
    tags:    ['column', 'lightning', 'aoe'],
    version: '1.0',
  },

  signal_sweep: {
    id: 'signal_sweep',
    ...ABILITY_DEFINITIONS.signal_sweep,
    unlockMode:  'fusion',
    powerA:      'heat',
    powerB:      'signal',
    effects: [
      {
        type:   'screen_effect',
        params: { kind: 'flash', color: 0x00eeff, alpha: 0.22, duration: 180 },
      },
      {
        type:   'clear_row',
        params: { count: 2 },
      },
    ],
    castDuration:  750,
    cooldownMode:  'energy_reset',
    cooldownValue: 0,
    tier:    1,
    tags:    ['row', 'signal', 'sweep', 'aoe'],
    version: '1.0',
  },

  emp_blast: {
    id: 'emp_blast',
    ...ABILITY_DEFINITIONS.emp_blast,
    unlockMode:  'fusion',
    powerA:      'charge',
    powerB:      'signal',
    effects: [
      {
        type:   'screen_effect',
        params: { kind: 'flash', color: 0xff6644, alpha: 0.32, duration: 250 },
      },
      {
        type:   'clear_radius',
        params: { radius: 2 },
      },
    ],
    castDuration:  900,
    cooldownMode:  'energy_reset',
    cooldownValue: 0,
    tier:    2,
    tags:    ['radius', 'explosion', 'emp', 'aoe'],
    version: '1.0',
  },

  // ── Single-power abilities ──────────────────────────────────────────────────

  power_cell: {
    id: 'power_cell',
    ...ABILITY_DEFINITIONS.power_cell,
    unlockMode:  'single',
    powerA:      'heat',
    effects: [
      {
        type:   'screen_effect',
        params: { kind: 'flash', color: 0x00ff88, alpha: 0.18, duration: 200 },
      },
      {
        type:   'clear_radius',
        params: { radius: 1 },
      },
      {
        type:   'restore_moves',
        params: { count: 3 },
      },
    ],
    castDuration:  700,
    cooldownMode:  'moves',
    cooldownValue: 5,
    tier:    2,
    tags:    ['heal', 'moves', 'utility', 'support'],
    version: '1.0',
  },

  overcharge: {
    id: 'overcharge',
    ...ABILITY_DEFINITIONS.overcharge,
    unlockMode:  'single',
    powerA:      'charge',
    effects: [
      {
        type:   'screen_effect',
        params: { kind: 'flash', color: 0xaa33ff, alpha: 0.28, duration: 300 },
      },
      {
        type:   'clear_type',
        params: { mode: 'most_common' },
      },
    ],
    castDuration:  800,
    cooldownMode:  'energy_reset',
    cooldownValue: 0,
    tier:    2,
    tags:    ['type_clear', 'overload', 'board_sweep'],
    version: '1.0',
  },

  bot_swarm: {
    id: 'bot_swarm',
    ...ABILITY_DEFINITIONS.bot_swarm,
    unlockMode:  'single',
    powerA:      'signal',
    effects: [
      {
        type:   'screen_effect',
        params: { kind: 'flash', color: 0xff44cc, alpha: 0.22, duration: 200 },
      },
      {
        type:   'chain_reaction',
        params: { count: 6, staggerMs: 80 },
      },
    ],
    castDuration:  1000,
    cooldownMode:  'moves',
    cooldownValue: 3,
    tier:    1,
    tags:    ['chain', 'random', 'swarm', 'stagger'],
    version: '1.0',
  },
};
