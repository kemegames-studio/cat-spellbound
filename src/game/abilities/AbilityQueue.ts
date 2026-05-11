// ─────────────────────────────────────────────────────────────────────────────
// AbilityQueue.ts
//
// Manages up to MAX_SLOTS (3) queued ability slots.
// Pure TypeScript — no Phaser imports, no rendering.
//
// Responsibilities:
//   • Prevent double-queuing the same ability.
//   • Track slot fill time + next-available move (for cooldown display).
//   • Provide a FusedSpell[] adapter so HUD.addSpellToSlot() works unchanged.
// ─────────────────────────────────────────────────────────────────────────────

import type { SpellType, EnergyType } from '../../config/Constants';
import type { AbilityType }           from '../board/ComponentTypes';
import type { FusedSpell }            from '../spells/SpellSystem';
import type { SpellDefinition }       from '../spells/SpellTypes';
import { ABILITY_CATALOG, FullAbilityDef } from './AbilityDefinitions';
import { ABILITY_TO_SPELL }           from './AbilityConfig';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QueuedAbility {
  abilityType:      AbilityType;
  def:              FullAbilityDef;
  /** Phaser scene time (ms) when this slot was filled; used for cooldown bar. */
  queuedAt:         number;
  /**
   * Move number after which this slot is available again.
   * Set to `currentMove + cooldownValue` when using 'moves' mode;
   * `0` for 'energy_reset' and 'none'.
   */
  availableAtMove:  number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_SLOTS = 3;

// ══════════════════════════════════════════════════════════════════════════════
// AbilityQueue
// ══════════════════════════════════════════════════════════════════════════════

export class AbilityQueue {

  private slots: Array<QueuedAbility | null> = new Array(MAX_SLOTS).fill(null);

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Add an ability to the next free slot.
   *
   * @returns Slot index (0–2) on success, -1 if full or already queued.
   */
  enqueue(
    abilityType:  AbilityType,
    currentTime:  number,
    currentMove:  number,
  ): number {
    // No double-queuing
    if (this.slots.some(s => s?.abilityType === abilityType)) return -1;

    const idx = this.slots.findIndex(s => s === null);
    if (idx === -1) return -1;

    const def = ABILITY_CATALOG[abilityType];
    this.slots[idx] = {
      abilityType,
      def,
      queuedAt:        currentTime,
      availableAtMove: currentMove,   // cooldown applied *after* cast, not before
    };
    return idx;
  }

  /**
   * Remove and return the queued ability matching `abilityType`.
   * Returns null if the ability is not in the queue.
   */
  dequeue(abilityType: AbilityType): QueuedAbility | null {
    const idx = this.slots.findIndex(s => s?.abilityType === abilityType);
    if (idx === -1) return null;

    const item       = this.slots[idx]!;
    this.slots[idx]  = null;
    return item;
  }

  has(abilityType: AbilityType): boolean {
    return this.slots.some(s => s?.abilityType === abilityType);
  }

  isFull(): boolean {
    return this.slots.every(s => s !== null);
  }

  getSlotCount(): number {
    return this.slots.filter(s => s !== null).length;
  }

  getQueue(): ReadonlyArray<QueuedAbility | null> {
    return this.slots;
  }

  /**
   * Returns a FusedSpell array compatible with HUD.addSpellToSlot().
   * Filters out empty slots — order matches slot order.
   */
  getSpellsForHUD(): FusedSpell[] {
    return this.slots
      .filter((s): s is QueuedAbility => s !== null)
      .map(toFusedSpell);
  }

  clear(): void {
    this.slots = new Array(MAX_SLOTS).fill(null);
  }
}

// ── HUD adapter helper ────────────────────────────────────────────────────────

function toFusedSpell(queued: QueuedAbility): FusedSpell {
  const { def, abilityType } = queued;
  const spellType: SpellType = ABILITY_TO_SPELL[abilityType];

  const definition: SpellDefinition = {
    type:        spellType,
    name:        def.name,
    description: def.description,
    color:       def.color,
    icon:        def.icon,
    // energyA/B are used only for flair text in old UI; 'light' is a safe default.
    energyA:     'light' as EnergyType,
    energyB:     'light' as EnergyType,
  };

  return { spell: spellType, definition };
}
