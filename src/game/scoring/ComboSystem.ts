// ─────────────────────────────────────────────────────────────────────────────
// ComboSystem.ts
//
// Pure TypeScript — NO Phaser imports.
//
// Tracks the cascade depth that Board reports via onCombo(count), computes
// the current multiplier, and maps the count to a named ComboTier.
//
// The multiplier model:
//   multiplier = min(1 + (count - 1) × INCREMENT, CAP)
//
//   count 1 → 1.00×   (first match, no cascade)
//   count 2 → 1.30×   nice
//   count 3 → 1.60×   great
//   count 4 → 1.90×   combo
//   count 5 → 2.20×   combo
//   count 6 → 2.50×   super
//   count 8 → 3.10×   ultra
//   count 10 → 3.70×  (capped at 5.00)
//
// ComboSystem is designed to be unit-testable without a scene:
//   const cs = new ComboSystem();
//   cs.update(3);
//   expect(cs.getMultiplier()).toBe(1.6);
//
// Extension: ComboSystem accepts an optional listener callback so the caller
// (GameScene) gets strongly-typed events rather than raw EventEmitter strings.
// ─────────────────────────────────────────────────────────────────────────────

import {
  SCORING_CONFIG,
  COMBO_TIERS,
  ComboTier,
  ScreenFeedbackLevel,
} from './ScoringConfig';

// ── Public types ──────────────────────────────────────────────────────────────

export interface ComboState {
  /** Current cascade depth (1 = first match, 2 = first cascade, …). */
  count:          number;
  /** Computed combo multiplier at this count. */
  multiplier:     number;
  /** Human-readable tier for this count. */
  tier:           ComboTier;
  /** Visual feedback intensity for this tier. */
  feedback:       ScreenFeedbackLevel;
  /** Text to show in the announcement banner. */
  tierLabel:      string;
  /** Formatted multiplier string (e.g. "×1.9"). */
  multiplierFmt:  string;
  /** Colour associated with this tier. */
  tierColor:      number;
  /** Font size (px) for the announcement label. */
  announcePx:     number;
  /** Highest cascade count seen in this board session. */
  peakCount:      number;
}

export interface ComboEventListener {
  onCascade:     (state: ComboState) => void;
  onReset:       (peakCount: number) => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// ComboSystem
// ══════════════════════════════════════════════════════════════════════════════

export class ComboSystem {
  private _count:     number = 1;
  private _peakCount: number = 1;
  private _listener:  Partial<ComboEventListener> = {};

  constructor(listener?: Partial<ComboEventListener>) {
    if (listener) this._listener = listener;
  }

  // ── Board callback integration ────────────────────────────────────────────

  /**
   * Call this from `BoardCallbacks.onCombo(count)`.
   * Returns the current ComboState for immediate use.
   */
  update(cascadeCount: number): ComboState {
    this._count = cascadeCount;
    if (cascadeCount > this._peakCount) {
      this._peakCount = cascadeCount;
    }
    const state = this.getState();
    this._listener.onCascade?.(state);
    return state;
  }

  /**
   * Call this from `BoardCallbacks.onBoardStable()`.
   * Resets the cascade counter; peak is preserved for the session summary.
   */
  reset(): void {
    const peak = this._peakCount;
    this._count = 1;
    this._listener.onReset?.(peak);
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  /**
   * Returns the multiplier to apply when scoring the CURRENT cascade round.
   * Use this value inside `onMatch` — it reflects the active cascade depth.
   */
  getMultiplier(): number {
    return ComboSystem.computeMultiplier(this._count);
  }

  getTier(): ComboTier {
    return ComboSystem.computeTier(this._count);
  }

  getCount(): number {
    return this._count;
  }

  getPeakCount(): number {
    return this._peakCount;
  }

  getState(): ComboState {
    const tier  = ComboSystem.computeTier(this._count);
    const entry = COMBO_TIERS.find(t => t.tier === tier)!;
    return {
      count:         this._count,
      multiplier:    this.getMultiplier(),
      tier,
      feedback:      entry.feedback,
      tierLabel:     entry.label,
      multiplierFmt: entry.multiplierFmt,
      tierColor:     entry.color,
      announcePx:    entry.announcePx,
      peakCount:     this._peakCount,
    };
  }

  // ── Session summary ───────────────────────────────────────────────────────

  /** Returns a snapshot suitable for end-of-level analytics / achievements. */
  getSessionSummary(): { peakCount: number; peakTier: ComboTier; peakMultiplier: number } {
    return {
      peakCount:      this._peakCount,
      peakTier:       ComboSystem.computeTier(this._peakCount),
      peakMultiplier: ComboSystem.computeMultiplier(this._peakCount),
    };
  }

  /** Full reset — call between levels (resets peak too). */
  fullReset(): void {
    this._count     = 1;
    this._peakCount = 1;
  }

  // ── Static helpers ────────────────────────────────────────────────────────

  static computeMultiplier(count: number): number {
    const raw = 1 + (count - 1) * SCORING_CONFIG.COMBO_MULTIPLIER_INCREMENT;
    return Math.min(raw, SCORING_CONFIG.COMBO_MULTIPLIER_CAP);
  }

  static computeTier(count: number): ComboTier {
    // Walk tiers in reverse (highest first), return first whose minCount ≤ count
    for (let i = COMBO_TIERS.length - 1; i >= 0; i--) {
      if (count >= COMBO_TIERS[i]!.minCount) {
        return COMBO_TIERS[i]!.tier;
      }
    }
    return 'none';
  }

  // ── Debug ─────────────────────────────────────────────────────────────────

  describe(): string {
    const s = this.getState();
    return `Combo ×${s.count} | ${s.tier.toUpperCase()} | mult=${s.multiplier.toFixed(2)}`;
  }
}
