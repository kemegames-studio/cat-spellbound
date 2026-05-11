// ─────────────────────────────────────────────────────────────────────────────
// ScoringConfig.ts
//
// Every scoring-related number lives here.  Nowhere else hardcodes points.
//
// Tuning flow:
//   1.  Edit values here.
//   2.  Run game — all derived systems pick up the change automatically.
//   3.  No file other than ScoringConfig.ts needs to change for a balance pass.
//
// This file has ZERO imports — it is safe to import from any module.
// ─────────────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
// 1. CORE MATCH SCORING
// ══════════════════════════════════════════════════════════════════════════════

export const SCORING_CONFIG = {

  // ── Per-tile base value ───────────────────────────────────────────────────
  BASE_PER_TILE: 80,

  // ── Size multipliers  (applied to BASE × tileCount) ──────────────────────
  // Keep these as a plain record — MatchClassifier interpolates missing sizes.
  SIZE_MULTIPLIER: {
    3: 1.00,
    4: 1.60,
    5: 2.80,
    6: 4.50,
    7: 7.00,
  } as Record<number, number>,

  // ── Flat bonus added on top of BASE × size × SIZE_MULTIPLIER ────────────
  SIZE_BONUS: {
    3:   0,
    4: 100,
    5: 300,
    6: 700,
    7: 1400,
  } as Record<number, number>,

  // ── Combo cascade multiplier ──────────────────────────────────────────────
  // multiplier = 1 + (comboCount - 1) × INCREMENT, capped at CAP
  COMBO_MULTIPLIER_INCREMENT: 0.30,
  COMBO_MULTIPLIER_CAP:       5.00,

  // ── Spell / ability bonus scores ─────────────────────────────────────────
  SPELL_CLEAR_PER_TILE:  25,   // each tile cleared by a spell
  SPELL_CAST_FLAT:      150,   // flat bonus for casting any spell

  // ── Objective bonus ───────────────────────────────────────────────────────
  OBJECTIVE_COMPLETE_BONUS: 500,  // awarded when an objective type is finished

  // ── Star calculation (score as fraction of level target) ─────────────────
  STAR_3_THRESHOLD: 1.50,   // 150% of target → 3 stars
  STAR_2_THRESHOLD: 1.00,   // 100% of target → 2 stars
  // 1 star = level passed (score target met, objectives met)

  // ── Score milestones (triggers special celebration) ───────────────────────
  MILESTONES: [250, 500, 1000, 2500, 5000, 10000] as number[],

  // ── Telemetry / debug ─────────────────────────────────────────────────────
  TELEMETRY_ENABLED: false,  // set true to log match events to console

} as const;

// ══════════════════════════════════════════════════════════════════════════════
// 2. COMBO TIER TABLE
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Ordered from lowest to highest — ComboSystem walks this array in reverse
 * to find the highest qualifying tier.
 */
export const COMBO_TIERS = [
  {
    minCount:      1,
    tier:          'none'  as const,
    label:         '',
    multiplierFmt: '',
    color:         0xffd700,
    feedback:      'none'    as const,
    announcePx:    0,
  },
  {
    minCount:      2,
    tier:          'nice'  as const,
    label:         'NICE!',
    multiplierFmt: '×1.3',
    color:         0xffd700,
    feedback:      'subtle'  as const,
    announcePx:    28,
  },
  {
    minCount:      3,
    tier:          'great' as const,
    label:         'GREAT!',
    multiplierFmt: '×1.6',
    color:         0xffaa00,
    feedback:      'light'   as const,
    announcePx:    32,
  },
  {
    minCount:      4,
    tier:          'combo' as const,
    label:         'COMBO!',
    multiplierFmt: '×1.9',
    color:         0xff6600,
    feedback:      'medium'  as const,
    announcePx:    34,
  },
  {
    minCount:      6,
    tier:          'super' as const,
    label:         'SUPER COMBO!',
    multiplierFmt: '×2.5+',
    color:         0xff44aa,
    feedback:      'strong'  as const,
    announcePx:    28,
  },
  {
    minCount:      8,
    tier:          'ultra' as const,
    label:         'ULTRA!!',
    multiplierFmt: '×3.1+',
    color:         0x00eeff,
    feedback:      'heavy'   as const,
    announcePx:    38,
  },
  {
    minCount:      10,
    tier:          'max'   as const,
    label:         'MAX COMBO!!',
    multiplierFmt: '×5.0',
    color:         0xffffff,
    feedback:      'extreme' as const,
    announcePx:    30,
  },
] as const;

// Derived types from the table above (no duplication)
export type ComboTier           = typeof COMBO_TIERS[number]['tier'];
export type ScreenFeedbackLevel = typeof COMBO_TIERS[number]['feedback'];

// ══════════════════════════════════════════════════════════════════════════════
// 3. MATCH TYPE CLASSIFICATION
// ══════════════════════════════════════════════════════════════════════════════

/** Popup label and colour for each match size class. */
export const MATCH_LABELS = {
  normal: { label: '',          color: 0xffd700,  vfx: 1 },
  special: { label: 'GREAT!',   color: 0xffaa00,  vfx: 2 },
  mega:    { label: 'AMAZING!', color: 0xff6600,  vfx: 3 },
  ultra:   { label: 'INSANE!',  color: 0xff44cc,  vfx: 4 },
  cross:   { label: 'CROSS!',   color: 0x00eeff,  vfx: 5 },
} as const;

export type MatchType = keyof typeof MATCH_LABELS;
