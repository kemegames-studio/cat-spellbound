// ─────────────────────────────────────────────────────────────────────────────
// EnergySystem.ts
//
// Tracks the three power meters (charge / heat / signal) and emits events when
// fusion or single-power thresholds are crossed.
//
// Events emitted:
//   'energy:change'    PowerMeters   — fired on every addPower() call
//   'energy:ability'   AbilityType   — fired when a threshold is newly crossed
//
// HUD adapter:
//   getChargedEnergy() → ChargedEnergy   (maps charge→light, heat→mana, signal→arcane)
//   so HUD.updateEnergy() requires zero modification.
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import type { AbilityType, PowerType } from '../board/ComponentTypes';
import { ABILITY_FUSIONS }             from '../board/ComponentTypes';
import type { ChargedEnergy }          from '../spells/SpellSystem';
import {
  ABILITY_CHARGE_NEEDED,
  ABILITY_ENERGY_CAP,
  ABILITY_SINGLE_UNLOCKS,
} from './AbilityConfig';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PowerMeters = Record<PowerType, number>;

// ══════════════════════════════════════════════════════════════════════════════
// EnergySystem
// ══════════════════════════════════════════════════════════════════════════════

export class EnergySystem extends Phaser.Events.EventEmitter {

  private meters: PowerMeters = { charge: 0, heat: 0, signal: 0 };

  /**
   * Set of ability types that have been queued but whose energy has not yet
   * been deducted.  Prevents double-emitting 'energy:ability' before the
   * caller calls consumeForAbility().
   */
  private pendingAbilities = new Set<AbilityType>();

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Add power to a meter from a tile match.  Automatically checks thresholds
   * and emits 'energy:ability' for any newly unlocked ability.
   *
   * @param type   Which power meter to charge.
   * @param amount Raw tile count (scales against ABILITY_CHARGE_NEEDED).
   */
  addPower(type: PowerType, amount: number): void {
    this.meters[type] = Math.min(
      this.meters[type] + amount,
      ABILITY_ENERGY_CAP,
    );
    this.emit('energy:change', this.getSnapshot());
    this.checkFusion();
    this.checkSingle();
  }

  /**
   * Deduct the cost for an ability that just fired.
   * Call this immediately after the ability slot is allocated so subsequent
   * addPower() calls don't fire 'energy:ability' again for the same slot.
   */
  consumeForAbility(ability: AbilityType): void {
    const fusion = ABILITY_FUSIONS.find(f => f.ability === ability);
    if (fusion) {
      this.meters[fusion.a] = Math.max(0, this.meters[fusion.a] - ABILITY_CHARGE_NEEDED);
      this.meters[fusion.b] = Math.max(0, this.meters[fusion.b] - ABILITY_CHARGE_NEEDED);
    } else {
      const single = ABILITY_SINGLE_UNLOCKS.find(s => s.ability === ability);
      if (single) {
        const cost = Math.round(ABILITY_CHARGE_NEEDED * 1.5);
        this.meters[single.power] = Math.max(0, this.meters[single.power] - cost);
      }
    }
    this.pendingAbilities.delete(ability);
    this.emit('energy:change', this.getSnapshot());
  }

  /** Current meter levels as an immutable snapshot. */
  getSnapshot(): PowerMeters {
    return { ...this.meters };
  }

  /** Fractional fill 0–1 for one meter (capped at 1). */
  getPowerPercent(type: PowerType): number {
    return Math.min(this.meters[type] / ABILITY_CHARGE_NEEDED, 1);
  }

  /**
   * HUD compatibility adapter.
   * Returns { light, mana, arcane } so HUD.updateEnergy() works unmodified.
   *   charge → light
   *   heat   → mana
   *   signal → arcane
   */
  getChargedEnergy(): ChargedEnergy {
    return {
      light:  this.meters.charge,
      mana:   this.meters.heat,
      arcane: this.meters.signal,
    };
  }

  /** Full reset between levels. */
  reset(): void {
    this.meters           = { charge: 0, heat: 0, signal: 0 };
    this.pendingAbilities = new Set();
    this.emit('energy:change', this.getSnapshot());
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private checkFusion(): void {
    for (const { a, b, ability } of ABILITY_FUSIONS) {
      if (
        this.meters[a] >= ABILITY_CHARGE_NEEDED &&
        this.meters[b] >= ABILITY_CHARGE_NEEDED &&
        !this.pendingAbilities.has(ability)
      ) {
        this.pendingAbilities.add(ability);
        this.emit('energy:ability', ability);
      }
    }
  }

  private checkSingle(): void {
    const threshold = Math.round(ABILITY_CHARGE_NEEDED * 1.5);
    for (const { power, ability } of ABILITY_SINGLE_UNLOCKS) {
      if (
        this.meters[power] >= threshold &&
        !this.pendingAbilities.has(ability)
      ) {
        this.pendingAbilities.add(ability);
        this.emit('energy:ability', ability);
      }
    }
  }
}
