// ─────────────────────────────────────────────────────────────────────────────
// AbilitySystem.ts
//
// Top-level orchestrator for the Charge Up energy + ability pipeline.
//
// Responsibilities:
//   • Convert tile matches → power meter energy (via EnergySystem).
//   • Detect fusion/single-power thresholds and queue abilities (via AbilityQueue).
//   • Execute queued abilities against the board (via AbilityExecutor).
//   • Expose HUD-compatible adapters so HUD.ts requires zero modification.
//   • Emit typed events for GameScene to subscribe to.
//
// Events emitted:
//   'ability:ready'     FusedSpell        — new ability queued; pass to HUD.addSpellToSlot()
//   'ability:cast'      AbilityType       — cast started (board disabled by GameScene)
//   'ability:complete'  AbilityCompleteEvent — cast finished; GameScene scores + refills
//
// HUD compatibility adapters (drop-in replacements for SpellSystem methods):
//   getChargedEnergy()               → ChargedEnergy  (light/mana/arcane shape)
//   getAvailableSpells()             → FusedSpell[]
//   consumeBySpellType(SpellType)    → FusedSpell | null
//
// Drop-in replacement for SpellSystem in GameScene:
//   addEnergy(tileType, count)       ← replaces SpellSystem.addEnergy()
//   castAbility(spellType, context)  ← replaces GameScene.castSpell() internals
//   reset()                          ← replaces SpellSystem.reset()
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import type { TileType, SpellType } from '../../config/Constants';
import type { AbilityType }         from '../board/ComponentTypes';
import type { FusedSpell, ChargedEnergy } from '../spells/SpellSystem';

import { EnergySystem }             from './EnergySystem';
import { AbilityQueue }             from './AbilityQueue';
import { AbilityExecutor }          from './AbilityExecutor';
import type { AbilityEffectContext } from './AbilityEffectHandler';
import { TILE_TO_POWER, SPELL_TO_ABILITY } from './AbilityConfig';

// ── Event payload types ───────────────────────────────────────────────────────

export interface AbilityCompleteEvent {
  abilityType:   AbilityType;
  /** Estimated tiles cleared (used by GameScene.scoreSystem.addSpellBonus). */
  tilesCleared:  number;
  /** Human-readable name for score popup label. */
  abilityName:   string;
}

// ══════════════════════════════════════════════════════════════════════════════
// AbilitySystem
// ══════════════════════════════════════════════════════════════════════════════

export class AbilitySystem extends Phaser.Events.EventEmitter {

  private energySystem: EnergySystem;
  private queue:        AbilityQueue;
  private executor:     AbilityExecutor;

  /** Scene reference needed for time.delayedCall in castAbility. */
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    super();
    this.scene        = scene;
    this.energySystem = new EnergySystem();
    this.queue        = new AbilityQueue();
    this.executor     = new AbilityExecutor();

    // Wire EnergySystem → AbilityQueue when a threshold is crossed
    this.energySystem.on('energy:ability', (abilityType: AbilityType) => {
      this.onAbilityThresholdReached(abilityType);
    });

    // Forward energy changes upward for HUD updates
    this.energySystem.on('energy:change', () => {
      this.emit('energy:change', this.energySystem.getChargedEnergy());
    });
  }

  // ── Primary gameplay API ──────────────────────────────────────────────────

  /**
   * Award energy from a tile match.  Accepts both TileType and ComponentType
   * strings without requiring the caller to import both vocabularies.
   *
   * @param tileType  Any key present in TILE_TO_POWER (star/potion/capacitor/…)
   * @param count     Number of tiles matched (not the score; raw tile count)
   */
  addEnergy(tileType: string, count: number): void {
    const powerType = TILE_TO_POWER[tileType];
    if (!powerType) return;   // unknown tile type — silently ignore
    this.energySystem.addPower(powerType, count);
  }

  /**
   * Execute a queued ability.  Called from GameScene.castSpell() after the
   * cast animation starts.
   *
   * Sequence:
   *   1. Dequeue the ability.
   *   2. Execute all effects (synchronous + fire-and-forget stagger timers).
   *   3. After castDuration, emit 'ability:complete' so GameScene can
   *      call scoreSystem.addSpellBonus + board.triggerGravityRefill.
   *
   * @param spellType  Legacy SpellType string from HUD onSpellCast callback.
   * @param context    Board + EffectsManager + callbacks.
   */
  castAbility(spellType: SpellType, context: AbilityEffectContext): void {
    const abilityType = SPELL_TO_ABILITY[spellType];
    if (!abilityType) return;

    const queued = this.queue.dequeue(abilityType);
    if (!queued) return;

    this.emit('ability:cast', abilityType);

    // Execute all effects (VFX + clear calls fire immediately or with stagger)
    const tilesCleared = this.executor.cast(abilityType, context);
    const castDuration = this.executor.getCastDuration(abilityType);

    // Emit complete after full animation budget so board refill happens last
    this.scene.time.delayedCall(castDuration, () => {
      const payload: AbilityCompleteEvent = {
        abilityType,
        tilesCleared,
        abilityName: queued.def.name,
      };
      this.emit('ability:complete', payload);
    });
  }

  // ── HUD compatibility adapters ────────────────────────────────────────────

  /**
   * Returns { light, mana, arcane } for HUD.updateEnergy().
   * Maps charge→light, heat→mana, signal→arcane.
   */
  getChargedEnergy() {
    return this.energySystem.getChargedEnergy();
  }

  /** Returns FusedSpell[] for display (same shape HUD.addSpellToSlot expects). */
  getAvailableSpells(): FusedSpell[] {
    return this.queue.getSpellsForHUD();
  }

  /**
   * Consume and return the FusedSpell with this SpellType, or null if it is
   * not currently queued.  Used in GameScene.castSpell() to decide whether
   * to proceed.
   *
   * Note: this does NOT execute the ability — call castAbility() for that.
   */
  consumeBySpellType(spellType: SpellType): FusedSpell | null {
    const abilityType = SPELL_TO_ABILITY[spellType];
    if (!abilityType) return null;

    const spells = this.queue.getSpellsForHUD();
    const match  = spells.find(s => s.spell === spellType) ?? null;
    // Note: dequeue happens inside castAbility; this is just a peek + convert.
    return match;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Full reset between levels. */
  reset(): void {
    this.energySystem.reset();
    this.queue.clear();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private onAbilityThresholdReached(abilityType: AbilityType): void {
    // Deduct energy cost immediately to prevent re-trigger
    this.energySystem.consumeForAbility(abilityType);

    // Attempt to queue — might fail if 3 slots already full
    const slotIdx = this.queue.enqueue(
      abilityType,
      this.scene.time.now,
      0,   // move number is tracked in GameScene; 0 = available immediately
    );

    if (slotIdx === -1) return;   // slots full — energy was still consumed

    // Build FusedSpell for the HUD notification
    const spells = this.queue.getSpellsForHUD();
    const fused  = spells.find(
      s => SPELL_TO_ABILITY[s.spell] === abilityType,
    );
    if (fused) {
      this.emit('ability:ready', fused);
    }
  }
}
