// ─────────────────────────────────────────────────────────────────────────────
// MatchClassifier.ts
//
// Pure, stateless match classification.  No Phaser imports.
//
// Given a MatchGroup (or a set of groups for cross detection), returns a
// MatchClassification that encodes everything needed for:
//   • score calculation   (baseScore, sizeMultiplier, bonusPoints)
//   • visual feedback     (color, vfxIntensity, label)
//   • combo announcements (announcementLabel)
//   • telemetry           (matchType)
//   • future achievements (matchType, size)
//
// Extension: add new MatchType values to ScoringConfig.MATCH_LABELS and add
// a case in classifyType() — no other file needs to change.
// ─────────────────────────────────────────────────────────────────────────────

import {
  SCORING_CONFIG,
  MATCH_LABELS,
  MatchType,
} from './ScoringConfig';
import type { MatchGroup } from '../board/TileTypes';

// ── Result type ───────────────────────────────────────────────────────────────

export interface MatchClassification {
  /** Categorical type — drives visuals and bonus logic. */
  matchType:          MatchType;
  /** Human-readable label shown in score popup above the points. */
  label:              string;
  /** Points BEFORE the combo multiplier is applied. */
  baseScore:          number;
  /** The exact multiplier applied to BASE × size. */
  sizeMultiplier:     number;
  /** Flat bonus added after the size calc. */
  bonusPoints:        number;
  /** Hex colour for score popup text and particle tint. */
  color:              number;
  /** 1-5 scale that drives the particle budget (1 = minimal, 5 = maximum). */
  vfxIntensity:       number;
  /** Total PRE-combo score for this group. */
  totalPreCombo:      number;
}

// ── Cross-match detection helper data ────────────────────────────────────────

/** Lightweight position record used inside the classifier. */
type GridPos = { col: number; row: number };

// ══════════════════════════════════════════════════════════════════════════════
// Classifier
// ══════════════════════════════════════════════════════════════════════════════

export class MatchClassifier {

  // ── Primary entry point ────────────────────────────────────────────────────

  /**
   * Classify a single MatchGroup and return its scoring metadata.
   *
   * @param group        The match to classify.
   * @param isCrossMatch Pass `true` when this group shares a cell with another
   *                     group in the same cascade round (detected externally).
   */
  static classify(group: MatchGroup, isCrossMatch = false): MatchClassification {
    const type  = isCrossMatch ? 'cross' : MatchClassifier.classifyType(group.size);
    const entry = MATCH_LABELS[type];

    const sizeMultiplier = MatchClassifier.getSizeMultiplier(group.size);
    const baseScore      = Math.round(group.size * SCORING_CONFIG.BASE_PER_TILE * sizeMultiplier);
    const bonusPoints    = MatchClassifier.getSizeBonus(group.size);
    const totalPreCombo  = baseScore + bonusPoints;

    return {
      matchType:      type,
      label:          entry.label,
      baseScore,
      sizeMultiplier,
      bonusPoints,
      color:          entry.color,
      vfxIntensity:   entry.vfx,
      totalPreCombo,
    };
  }

  // ── Batch classification with cross-match detection ───────────────────────

  /**
   * Classify an entire batch of groups from one cascade round.
   * Automatically detects cross-matches (two groups sharing a tile).
   *
   * @returns Array of classifications in the same order as `groups`.
   */
  static classifyBatch(groups: MatchGroup[]): MatchClassification[] {
    const crossSet = MatchClassifier.findCrossPositions(groups);

    return groups.map(g => {
      const hasCross = g.tiles.some(t => crossSet.has(`${t.col},${t.row}`));
      return MatchClassifier.classify(g, hasCross);
    });
  }

  // ── Static helpers ────────────────────────────────────────────────────────

  /** Map a run length to a MatchType. */
  static classifyType(size: number): MatchType {
    if (size >= 7) return 'ultra';
    if (size >= 5) return 'mega';
    if (size >= 4) return 'special';
    return 'normal';
  }

  /**
   * Interpolate the size multiplier for chain lengths not explicitly listed.
   * Uses the nearest lower entry for sizes beyond the table.
   */
  static getSizeMultiplier(size: number): number {
    const table = SCORING_CONFIG.SIZE_MULTIPLIER;
    const keys  = Object.keys(table).map(Number).sort((a, b) => a - b);

    // Find the highest key ≤ size
    let multiplier = table[keys[0]!] ?? 1.0;
    for (const k of keys) {
      if (k <= size) multiplier = table[k] ?? multiplier;
    }
    return multiplier;
  }

  /** Flat bonus for a given size (0 for size < 4). */
  static getSizeBonus(size: number): number {
    const table = SCORING_CONFIG.SIZE_BONUS;
    const keys  = Object.keys(table).map(Number).sort((a, b) => b - a);
    for (const k of keys) {
      if (k <= size) return table[k] ?? 0;
    }
    return 0;
  }

  // ── Cross-match detection ─────────────────────────────────────────────────

  /**
   * Returns the set of grid-position keys that are shared between two or more
   * match groups in the same round.  A non-empty set means an L/T/+ shape.
   */
  static findCrossPositions(groups: MatchGroup[]): Set<string> {
    const seen  = new Set<string>();
    const cross = new Set<string>();

    for (const group of groups) {
      for (const { col, row } of group.tiles) {
        const key = `${col},${row}`;
        if (seen.has(key)) {
          cross.add(key);
        } else {
          seen.add(key);
        }
      }
    }
    return cross;
  }

  /**
   * Quick boolean check: do any two groups in this batch share a tile?
   */
  static hasCrossMatch(groups: MatchGroup[]): boolean {
    return MatchClassifier.findCrossPositions(groups).size > 0;
  }

  // ── Scoring arithmetic helpers ────────────────────────────────────────────

  /**
   * Apply the combo multiplier to a pre-combo score.
   * Clamps to integer.
   */
  static applyComboMultiplier(preComboScore: number, multiplier: number): number {
    return Math.round(preComboScore * multiplier);
  }

  /**
   * Calculate the total score awarded for a batch of matches in one cascade
   * round, with cross-match detection applied.
   */
  static batchTotal(groups: MatchGroup[], comboMultiplier: number): number {
    return MatchClassifier.classifyBatch(groups).reduce((sum, c) =>
      sum + MatchClassifier.applyComboMultiplier(c.totalPreCombo, comboMultiplier), 0,
    );
  }

  // ── Debug ─────────────────────────────────────────────────────────────────

  /** Returns a human-readable description of a classification (for dev tools). */
  static describe(c: MatchClassification): string {
    return [
      `[${c.matchType.toUpperCase()}]`,
      `size×${SCORING_CONFIG.BASE_PER_TILE}×${c.sizeMultiplier.toFixed(2)}`,
      `+${c.bonusPoints}`,
      `= ${c.totalPreCombo} pre-combo`,
    ].join(' ');
  }
}
