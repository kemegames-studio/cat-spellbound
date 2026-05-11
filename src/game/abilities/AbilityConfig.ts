// ─────────────────────────────────────────────────────────────────────────────
// AbilityConfig.ts
//
// Charge Up ability-layer constants and vocabulary mappings.
// Zero dependencies outside src/config/Constants.ts and ComponentTypes.ts.
//
// This file answers three questions:
//   1. How much charge fills one power meter?
//   2. Which board tile type charges which power meter?
//   3. How do power meters map back to the HUD's legacy EnergyType display?
// ─────────────────────────────────────────────────────────────────────────────

import { SPELL_CHARGE_NEEDED } from '../../config/Constants';
import type { EnergyType, SpellType } from '../../config/Constants';
import type { PowerType, AbilityType } from '../board/ComponentTypes';

// ── Charge thresholds ─────────────────────────────────────────────────────────

/** Tiles needed to completely fill one power meter (kept in sync with legacy SpellSystem). */
export const ABILITY_CHARGE_NEEDED = SPELL_CHARGE_NEEDED;

/** Multiplier for single-power (no fusion partner) unlock. */
export const ABILITY_SINGLE_MULTIPLIER = 1.5;

/** Actual tile count required for a single-power unlock. */
export const ABILITY_SINGLE_THRESHOLD = Math.round(
  ABILITY_CHARGE_NEEDED * ABILITY_SINGLE_MULTIPLIER,
);

/** Maximum energy stored in any one meter (caps excess charge). */
export const ABILITY_ENERGY_CAP = ABILITY_CHARGE_NEEDED * 2;

// ── Tile → Power mappings ─────────────────────────────────────────────────────

/**
 * Maps every tile vocabulary — both Cat Spellbound (TileType) and Charge Up
 * (ComponentType) — to the power meter it feeds.
 *
 * Stored as a plain string-keyed record so CircuitTile and regular Tile both
 * resolve correctly without importing each other's type unions.
 */
export const TILE_TO_POWER: Record<string, PowerType> = {
  // ── Cat Spellbound vocabulary (TileType) ──────────────────────────────────
  star:    'charge',
  book:    'charge',
  potion:  'heat',
  gem:     'signal',
  crystal: 'signal',

  // ── Charge Up vocabulary (ComponentType) ──────────────────────────────────
  capacitor:  'charge',
  relay:      'charge',
  resistor:   'heat',
  transistor: 'signal',
  diode:      'signal',
};

// ── Power ↔ HUD energy mapping ────────────────────────────────────────────────

/**
 * Maps Charge Up PowerType → legacy EnergyType so AbilitySystem can feed the
 * existing HUD (light/mana/arcane bars) without modifications to HUD.ts.
 *
 * Remove once HUD is ported to PowerType directly.
 */
export const POWER_TO_ENERGY: Record<PowerType, EnergyType> = {
  charge: 'light',
  heat:   'mana',
  signal: 'arcane',
};

/** Inverse of POWER_TO_ENERGY — used in EnergySystem.getChargedEnergy(). */
export const ENERGY_TO_POWER: Record<EnergyType, PowerType> = {
  light:  'charge',
  mana:   'heat',
  arcane: 'signal',
};

// ── Ability ↔ SpellType mapping (HUD backward-compat) ────────────────────────

/**
 * Translates Charge Up AbilityType → legacy SpellType so HUD's onSpellCast
 * callback still works.  Remove once HUD is ported to AbilityType.
 */
export const ABILITY_TO_SPELL: Record<AbilityType, SpellType> = {
  arc_discharge: 'lightning_storm',
  power_cell:    'healing_burst',
  signal_sweep:  'portal_vortex',
  emp_blast:     'meteor',
  overcharge:    'rainbow',
  bot_swarm:     'cat_summon',
};

/**
 * Inverse map — lets AbilitySystem.consumeBySpellType() locate the right queue
 * slot when the HUD fires a legacy SpellType string.
 */
export const SPELL_TO_ABILITY: Record<SpellType, AbilityType> = {
  lightning_storm: 'arc_discharge',
  healing_burst:   'power_cell',
  portal_vortex:   'signal_sweep',
  meteor:          'emp_blast',
  rainbow:         'overcharge',
  cat_summon:      'bot_swarm',
};

// ── Single-power (no fusion) unlock definitions ───────────────────────────────

/**
 * Abilities that fire from a single over-charged meter alone.
 * Triggered when `meters[power] >= ABILITY_SINGLE_THRESHOLD`.
 */
export const ABILITY_SINGLE_UNLOCKS: ReadonlyArray<{
  power:   PowerType;
  ability: AbilityType;
}> = [
  { power: 'charge', ability: 'emp_blast'  },
  { power: 'heat',   ability: 'overcharge' },
  { power: 'signal', ability: 'bot_swarm'  },
] as const;
