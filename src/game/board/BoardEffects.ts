// ─────────────────────────────────────────────────────────────────────────────
// BoardEffects.ts
//
// Decouples the board logic from the concrete VFX renderer.
//
// The board only ever calls methods on `BoardEffectHooks`.
// The adapter (EffectsAdapter) bridges those calls to the existing
// EffectsManager (which knows about particles, tweens, etc.).
//
// This makes it trivial to:
//   • Swap in a different VFX back-end (e.g. a stripped-down mobile build).
//   • Write unit tests for board logic without spawning Phaser objects.
//   • Add new hook stubs for Phase 3+ without touching Board.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { EffectsManager }           from '../effects/EffectsManager';
import { GAME_WIDTH, GAME_HEIGHT }  from '../../config/Constants';
import type { AbilityType }         from './ComponentTypes';

// ── Core hook interface ───────────────────────────────────────────────────────

/**
 * All visual side-effects the board is allowed to trigger.
 * The board layer ONLY calls these methods — it never touches EffectsManager
 * directly after the refactor.
 */
export interface BoardEffectHooks {
  // ── Tile interactions ─────────────────────────────────────────────────────

  /** Burst at tile position when a match is confirmed. */
  onMatchBurst(x: number, y: number, color: number, chainSize: number): void;

  /** Highlight ring at tile position when the player selects a tile. */
  onSelectBurst(x: number, y: number, color: number): void;

  /** Shake/flash indicator when a swap produces no match. */
  onInvalidSwap(x: number, y: number): void;

  // ── Special tile events ───────────────────────────────────────────────────

  /** Warp trail when a match sits adjacent to a portal cell. */
  onPortalTeleport(x: number, y: number, color: number): void;

  // ── Cascade / combo ───────────────────────────────────────────────────────

  /**
   * Screen flash / banner after a cascade produces a combo.
   * @param comboCount  1-indexed count of the current cascade round.
   */
  onComboFlash(comboCount: number): void;

  // ── Board-state events ────────────────────────────────────────────────────

  /** Called when the board is reshuffled due to deadlock. */
  onReshuffle(): void;

  // ── TODO: Phase 3 hooks (stub now, implement in Phase 3) ─────────────────
  // onAbilityCast(type: AbilityType, x: number, y: number): void;
  // onCompanionReact(emotion: 'happy' | 'excited' | 'worried' | 'idle'): void;
  // onPowerMeterFull(powerType: string): void;
}

// ── Null implementation ───────────────────────────────────────────────────────

/**
 * No-op implementation — useful for unit testing or headless simulations
 * where no renderer is attached.
 */
export class NullBoardEffects implements BoardEffectHooks {
  onMatchBurst()      {}
  onSelectBurst()     {}
  onInvalidSwap()     {}
  onPortalTeleport()  {}
  onComboFlash()      {}
  onReshuffle()       {}
}

// ── EffectsManager adapter ────────────────────────────────────────────────────

/**
 * Bridges `BoardEffectHooks` to the concrete `EffectsManager`.
 * Drop-in replacement whenever the board needs real particles and tweens.
 */
export class EffectsAdapter implements BoardEffectHooks {
  constructor(private fx: EffectsManager) {}

  onMatchBurst(x: number, y: number, color: number, chainSize: number): void {
    this.fx.spawnMatchBurst(x, y, color, chainSize);
  }

  onSelectBurst(x: number, y: number, color: number): void {
    this.fx.spawnSelectBurst(x, y, color);
  }

  onInvalidSwap(x: number, y: number): void {
    this.fx.spawnInvalidSwap(x, y);
  }

  onPortalTeleport(x: number, y: number, color: number): void {
    this.fx.spawnPortalTeleport(x, y, color);
  }

  onComboFlash(comboCount: number): void {
    // EffectsManager doesn't yet have a dedicated combo-flash method.
    // Re-use the match burst at the true screen centre as a placeholder.
    // Phase 3 will implement a proper full-screen flash overlay.
    if (comboCount >= 2) {
      this.fx.spawnMatchBurst(GAME_WIDTH / 2, GAME_HEIGHT / 2, 0xffd700, comboCount + 2);
    }
  }

  onReshuffle(): void {
    // Phase 3: full-board ripple animation.
    // Currently a no-op placeholder.
  }
}
