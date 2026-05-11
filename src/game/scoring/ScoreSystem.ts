// ─────────────────────────────────────────────────────────────────────────────
// ScoreSystem.ts
//
// Event-driven scoring engine.  Extends Phaser.Events.EventEmitter so callers
// subscribe once and react to typed events rather than polling state.
//
// IMPORTANT — rendering independence:
//   ScoreSystem never creates Phaser GameObjects.  All it does is:
//     1.  Accept raw match/combo data.
//     2.  Compute points.
//     3.  Emit typed events.
//   UI (ScorePopup, ComboAnnouncement) listen to those events — they do NOT
//   live inside ScoreSystem.
//
// Events emitted:
//   'score:match'      ScoreMatchEvent   — one per MatchGroup per cascade
//   'score:combo'      ComboState        — re-emitted from ComboSystem.update()
//   'score:bonus'      ScoreBonusEvent   — spell clears, objective completion
//   'score:milestone'  MilestoneEvent    — score crossed a threshold
//   'score:reset'      { finalScore }    — level finished (for analytics)
//   'telemetry'        TelemetryFrame    — every processMatch (debug/analytics)
//
// Future achievements can subscribe to 'score:match', 'score:combo', and
// 'score:milestone' without any coupling to GameScene or Board.
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { SCORING_CONFIG }                    from './ScoringConfig';
import { MatchClassifier, MatchClassification } from './MatchClassifier';
import { ComboSystem, ComboState }           from './ComboSystem';
import type { MatchGroup }                   from '../board/TileTypes';
import type { TileType }                     from '../board/TileTypes';

// ── Event payload types ───────────────────────────────────────────────────────

export interface ScoreMatchEvent {
  /** Pre-combo score for this group only. */
  rawPoints:       number;
  /** Final points after combo multiplier. */
  multipliedPoints: number;
  /** Multiplier that was applied. */
  comboMultiplier:  number;
  /** Match classification for visual/VFX decisions. */
  classification:   MatchClassification;
  /** World position of the match center (for popup spawning). */
  position:         { x: number; y: number };
  /** Running total after this match. */
  totalScore:       number;
  /** Sequential match counter this session. */
  matchNumber:      number;
}

export interface ScoreBonusEvent {
  /** Human-readable source label. */
  source:     string;
  points:     number;
  totalScore: number;
}

export interface MilestoneEvent {
  /** The threshold that was just crossed. */
  threshold:  number;
  /** Display label, e.g. "500 pts!". */
  label:      string;
  totalScore: number;
  /** 0-based index in SCORING_CONFIG.MILESTONES. */
  index:      number;
}

export interface TelemetryFrame {
  timestamp:       number;
  matchNumber:     number;
  matchType:       string;
  matchSize:       number;
  rawPoints:       number;
  multipliedPoints: number;
  comboCount:      number;
  comboMultiplier: number;
  totalScore:      number;
}

// ── Session data (end-of-level analytics) ─────────────────────────────────────

export interface SessionScoreData {
  totalScore:           number;
  matchCount:           number;
  totalTilesCleared:    number;
  specialMatchCount:    number;
  megaMatchCount:       number;
  ultraMatchCount:      number;
  crossMatchCount:      number;
  peakComboCount:       number;
  peakComboMultiplier:  number;
  largestSingleMatch:   number;
  averageMatchScore:    number;
  milestoneReached:     number;
  bonusTotal:           number;
}

// ══════════════════════════════════════════════════════════════════════════════
// ScoreSystem
// ══════════════════════════════════════════════════════════════════════════════

export class ScoreSystem extends Phaser.Events.EventEmitter {

  // ── Score state ───────────────────────────────────────────────────────────
  private _total:        number = 0;
  private _matchCount:   number = 0;
  private _bonusTotal:   number = 0;

  // ── Session accumulators (for analytics) ──────────────────────────────────
  private _tilesCleared:    number = 0;
  private _specialCount:    number = 0;
  private _megaCount:       number = 0;
  private _ultraCount:      number = 0;
  private _crossCount:      number = 0;
  private _largestSingle:   number = 0;
  private _milestoneIndex:  number = -1;  // index of last crossed milestone

  // ── External references ───────────────────────────────────────────────────
  private comboSystem: ComboSystem;

  constructor(comboSystem: ComboSystem) {
    super();
    this.comboSystem = comboSystem;
  }

  // ── Primary scoring API ───────────────────────────────────────────────────

  /**
   * Score a MatchGroup.  Called once per group per cascade round.
   *
   * @param group       The matched group from Board.
   * @param allGroups   All groups in this cascade round (needed for cross detection).
   * @param centerWorld World position of the group center (for popup placement).
   */
  processMatch(
    group:       MatchGroup,
    allGroups:   MatchGroup[],
    centerWorld: { x: number; y: number },
  ): ScoreMatchEvent {
    // Cross-match detection across all groups in this cascade round
    const crossSet      = MatchClassifier.findCrossPositions(allGroups);
    const isCross       = group.tiles.some(t => crossSet.has(`${t.col},${t.row}`));
    const classification = MatchClassifier.classify(group, isCross);

    const comboMultiplier    = this.comboSystem.getMultiplier();
    const multipliedPoints   = MatchClassifier.applyComboMultiplier(
      classification.totalPreCombo, comboMultiplier,
    );

    this._total      += multipliedPoints;
    this._matchCount += 1;
    this._tilesCleared += group.tiles.length;
    this._largestSingle = Math.max(this._largestSingle, multipliedPoints);

    // Accumulate match type stats
    if (isCross)                                    this._crossCount++;
    else if (classification.matchType === 'ultra')  this._ultraCount++;
    else if (classification.matchType === 'mega')   this._megaCount++;
    else if (classification.matchType === 'special') this._specialCount++;

    const event: ScoreMatchEvent = {
      rawPoints:        classification.totalPreCombo,
      multipliedPoints,
      comboMultiplier,
      classification,
      position:         centerWorld,
      totalScore:       this._total,
      matchNumber:      this._matchCount,
    };

    this.emit('score:match', event);
    this.checkMilestones();

    if (SCORING_CONFIG.TELEMETRY_ENABLED) {
      this.emitTelemetry(event, group.size);
    }

    return event;
  }

  /**
   * Re-emit combo state (called when ComboSystem.update() fires its listener).
   * Keeps the combo event flow centralised through ScoreSystem for subscribers
   * that want a single EventEmitter to listen to.
   */
  processCombo(state: ComboState): void {
    this.emit('score:combo', state);
  }

  // ── Bonus scoring ─────────────────────────────────────────────────────────

  /**
   * Award a flat bonus from a non-match source (spell, objective complete, etc.).
   * Emits 'score:bonus'.
   */
  addBonus(points: number, source: string): ScoreBonusEvent {
    this._total       += points;
    this._bonusTotal  += points;

    const event: ScoreBonusEvent = {
      source,
      points,
      totalScore: this._total,
    };
    this.emit('score:bonus', event);
    this.checkMilestones();
    return event;
  }

  /**
   * Award spell-clear bonus:  flat cast bonus  +  per-tile cleared bonus.
   */
  addSpellBonus(tilesCleared: number, spellName: string): ScoreBonusEvent {
    const points = SCORING_CONFIG.SPELL_CAST_FLAT
                 + tilesCleared * SCORING_CONFIG.SPELL_CLEAR_PER_TILE;
    return this.addBonus(points, spellName);
  }

  /**
   * Award objective-complete bonus when all tiles of a type are collected.
   */
  addObjectiveBonus(type: TileType): ScoreBonusEvent {
    return this.addBonus(
      SCORING_CONFIG.OBJECTIVE_COMPLETE_BONUS,
      `Objective: ${type}`,
    );
  }

  // ── Star calculation ──────────────────────────────────────────────────────

  /**
   * Calculate star rating against the level target.
   * @param targetScore  The level's required score (from LEVELS config).
   */
  calculateStars(targetScore: number): 1 | 2 | 3 {
    const ratio = this._total / targetScore;
    if (ratio >= SCORING_CONFIG.STAR_3_THRESHOLD) return 3;
    if (ratio >= SCORING_CONFIG.STAR_2_THRESHOLD) return 2;
    return 1;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Full reset between levels. */
  reset(): void {
    const finalScore = this._total;
    this._total          = 0;
    this._matchCount     = 0;
    this._bonusTotal     = 0;
    this._tilesCleared   = 0;
    this._specialCount   = 0;
    this._megaCount      = 0;
    this._ultraCount     = 0;
    this._crossCount     = 0;
    this._largestSingle  = 0;
    this._milestoneIndex = -1;
    this.emit('score:reset', { finalScore });
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  getScore(): number    { return this._total; }
  getMatchCount(): number { return this._matchCount; }

  /** Returns a complete session summary for end-of-level screens / analytics. */
  getSessionData(): SessionScoreData {
    const combo = this.comboSystem.getSessionSummary();
    return {
      totalScore:          this._total,
      matchCount:          this._matchCount,
      totalTilesCleared:   this._tilesCleared,
      specialMatchCount:   this._specialCount,
      megaMatchCount:      this._megaCount,
      ultraMatchCount:     this._ultraCount,
      crossMatchCount:     this._crossCount,
      peakComboCount:      combo.peakCount,
      peakComboMultiplier: combo.peakMultiplier,
      largestSingleMatch:  this._largestSingle,
      averageMatchScore:   this._matchCount > 0
        ? Math.round(this._total / this._matchCount) : 0,
      milestoneReached:    this._milestoneIndex >= 0
        ? SCORING_CONFIG.MILESTONES[this._milestoneIndex] ?? 0 : 0,
      bonusTotal:          this._bonusTotal,
    };
  }

  /** Debug string — paste into console during playtesting. */
  getDebugStats(): string {
    const d = this.getSessionData();
    return [
      `Score: ${d.totalScore.toLocaleString()}`,
      `Matches: ${d.matchCount} | Tiles: ${d.totalTilesCleared}`,
      `Special: ${d.specialMatchCount} | Mega: ${d.megaMatchCount} | Ultra: ${d.ultraMatchCount}`,
      `Cross: ${d.crossMatchCount} | Peak combo: ×${d.peakComboCount}`,
      `Largest single: ${d.largestSingleMatch} | Avg: ${d.averageMatchScore}`,
      `Bonus total: ${d.bonusTotal}`,
    ].join('\n');
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private checkMilestones(): void {
    const milestones = SCORING_CONFIG.MILESTONES;
    for (let i = milestones.length - 1; i > this._milestoneIndex; i--) {
      if (this._total >= milestones[i]!) {
        this._milestoneIndex = i;
        const event: MilestoneEvent = {
          threshold:  milestones[i]!,
          label:      `${milestones[i]!.toLocaleString()} pts!`,
          totalScore: this._total,
          index:      i,
        };
        this.emit('score:milestone', event);
        break; // only fire the HIGHEST newly crossed milestone per tick
      }
    }
  }

  private emitTelemetry(event: ScoreMatchEvent, matchSize: number): void {
    const frame: TelemetryFrame = {
      timestamp:        Date.now(),
      matchNumber:      event.matchNumber,
      matchType:        event.classification.matchType,
      matchSize,
      rawPoints:        event.rawPoints,
      multipliedPoints: event.multipliedPoints,
      comboCount:       this.comboSystem.getCount(),
      comboMultiplier:  event.comboMultiplier,
      totalScore:       event.totalScore,
    };
    this.emit('telemetry', frame);
    if (SCORING_CONFIG.TELEMETRY_ENABLED) {
      console.table(frame);
    }
  }
}
