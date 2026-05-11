// ─────────────────────────────────────────────────────────────────────────────
// ComponentTypes.ts
//
// Charge Up match-3 type vocabulary.
//
// Relationship to Cat Spellbound names:
//   TileType    → ComponentType
//   EnergyType  → PowerType
//   SpellType   → AbilityType
//   MatchGroup  → ChainGroup
//
// Phase 0 (rename pass) will swap the old names throughout every scene.
// Until then both vocabularies coexist — nothing in this file imports the
// old names, so it is safe to import here from any module.
// ─────────────────────────────────────────────────────────────────────────────

// ── Circuit component tile types ─────────────────────────────────────────────

/** The five circuit-component tile variants on the board. */
export type ComponentType =
  | 'capacitor'   // stores charge  → yellow-gold
  | 'resistor'    // limits heat    → orange
  | 'transistor'  // amplifies signal → cyan
  | 'relay'       // switches power → purple
  | 'diode'       // one-way flow   → pink
  ;

export const ALL_COMPONENT_TYPES: ComponentType[] = [
  'capacitor',
  'resistor',
  'transistor',
  'relay',
  'diode',
];

/** Pick a random component type uniformly. */
export function randomComponentType(): ComponentType {
  return ALL_COMPONENT_TYPES[
    Math.floor(Math.random() * ALL_COMPONENT_TYPES.length)
  ] as ComponentType;
}

// ── Power types (energy meter categories) ────────────────────────────────────

/** Three power-accumulation meters shown in the HUD. */
export type PowerType = 'charge' | 'heat' | 'signal';

/** Which power meter each component feeds into. */
export const COMPONENT_TO_POWER: Record<ComponentType, PowerType> = {
  capacitor:  'charge',
  resistor:   'heat',
  transistor: 'signal',
  relay:      'charge',
  diode:      'signal',
};

// ── Ability types (activated from power meters) ───────────────────────────────

/** Six circuit-themed board abilities, one per power-meter fusion pair. */
export type AbilityType =
  | 'arc_discharge'  // clear a full column        (↔ lightning_storm)
  | 'power_cell'     // restore moves / board heal  (↔ healing_burst)
  | 'signal_sweep'   // clear a full row            (↔ portal_vortex)
  | 'emp_blast'      // 2-radius area clear         (↔ meteor)
  | 'overcharge'     // clear all of one type       (↔ rainbow)
  | 'bot_swarm'      // wildcard tile fill          (↔ cat_summon)
  ;

/** Which two power meters fuse to unlock each ability. */
export const ABILITY_FUSIONS: Array<{
  a: PowerType;
  b: PowerType;
  ability: AbilityType;
}> = [
  { a: 'charge', b: 'heat',   ability: 'arc_discharge' },
  { a: 'heat',   b: 'signal', ability: 'signal_sweep'  },
  { a: 'charge', b: 'signal', ability: 'emp_blast'     },
];

// ── Colours ───────────────────────────────────────────────────────────────────

export const COMPONENT_COLORS: Record<ComponentType, number> = {
  capacitor:  0xffd700,
  resistor:   0xff6644,
  transistor: 0x00eeff,
  relay:      0xaa33ff,
  diode:      0xff44cc,
};

export const POWER_COLORS: Record<PowerType, number> = {
  charge: 0xffd700,
  heat:   0xff6644,
  signal: 0x00eeff,
};

// ── Tile states ───────────────────────────────────────────────────────────────
// TileState is defined in Tile.ts and includes all base + Charge Up states.
// Re-exported here for convenience so ComponentTypes is a self-contained import.
export type { TileState } from './Tile';

// ── Chain group (match result) ────────────────────────────────────────────────

/**
 * Describes one matched run of ≥ CHAIN_MIN tiles of the same ComponentType.
 * Produced by MatchLogic.findAll() — pure data, no Phaser references.
 */
export interface ChainGroup {
  /** Grid positions of every tile in the chain. */
  tiles:      Array<{ col: number; row: number }>;
  type:       ComponentType;
  size:       number;
  /** true when size ≥ 4 → triggers a special visual + bonus score. */
  isSpecial:  boolean;
  /** true when size ≥ 5 → triggers a mega effect. */
  isMegaChain: boolean;
}

// ── Charged power snapshot (mirrors ChargedEnergy for Charge Up) ──────────────

/** Current accumulated power per meter — passed to the HUD. */
export type ChargedPower = Record<PowerType, number>;

/** A fully charged ability ready to fire. */
export interface FusedAbility {
  ability:    AbilityType;
  powerA:     PowerType;
  powerB:     PowerType;
  definition: AbilityDefinition;
}

export interface AbilityDefinition {
  name:   string;
  icon:   string;
  color:  number;
  description: string;
}

export const ABILITY_DEFINITIONS: Record<AbilityType, AbilityDefinition> = {
  arc_discharge: {
    name:        'Arc Discharge',
    icon:        '⚡',
    color:       0xffd700,
    description: 'Vaporises an entire column in a lightning burst.',
  },
  power_cell: {
    name:        'Power Cell',
    icon:        '🔋',
    color:       0x00ff88,
    description: 'Restores 3 moves and heals corrupted tiles.',
  },
  signal_sweep: {
    name:        'Signal Sweep',
    icon:        '📡',
    color:       0x00eeff,
    description: 'Sweeps a full row clean in a wave of signal pulses.',
  },
  emp_blast: {
    name:        'EMP Blast',
    icon:        '💥',
    color:       0xff6644,
    description: 'Detonates in a 2-tile radius, clearing everything nearby.',
  },
  overcharge: {
    name:        'Overcharge',
    icon:        '🌀',
    color:       0xaa33ff,
    description: 'Overloads and clears every tile of one component type.',
  },
  bot_swarm: {
    name:        'Bot Swarm',
    icon:        '🤖',
    color:       0xff44cc,
    description: 'Deploys micro-bots that convert random tiles to wildcards.',
  },
};
