// ─────────────────────────────────────────────────────────────────────────────
// AbilityEffectHandler.ts
//
// Registry-based executor for individual AbilityEffect steps.
//
// Architecture:
//   • Each EffectType has one registered handler function.
//   • Handlers receive a typed context object — no global state.
//   • Returns estimated tile count cleared (for score system integration).
//   • register() lets future live-ops handlers override built-ins at runtime.
//
// Adding a new effect type:
//   1. Add it to EffectType in AbilityDefinitions.ts.
//   2. Call AbilityEffectHandler.register('my_effect', myHandler) once at init.
//   3. Reference it in any FullAbilityDef.effects array.
// ─────────────────────────────────────────────────────────────────────────────

import Phaser   from 'phaser';
import { BOARD_COLS, BOARD_ROWS, PALETTE } from '../../config/Constants';
import type { TileType }                   from '../../config/Constants';
import { Board }                           from '../board/Board';
import { EffectsManager }                  from '../effects/EffectsManager';
import type { AbilityEffect, EffectType }  from './AbilityDefinitions';

// ── Effect execution context ──────────────────────────────────────────────────

export interface AbilityEffectContext {
  scene:    Phaser.Scene;
  board:    Board;
  effects:  EffectsManager;
  /** Called when a restore_moves effect awards extra moves. */
  onMovesRestored?: (count: number) => void;
}

// ── Handler type ──────────────────────────────────────────────────────────────

/** Returns estimated tile count cleared (0 for visual-only effects). */
export type EffectHandler = (
  params:  Record<string, unknown>,
  context: AbilityEffectContext,
) => number;

// ══════════════════════════════════════════════════════════════════════════════
// AbilityEffectHandler
// ══════════════════════════════════════════════════════════════════════════════

export class AbilityEffectHandler {

  private static handlers = new Map<EffectType, EffectHandler>();

  /** Register a handler for an effect type.  Overwrites existing registration. */
  static register(type: EffectType, handler: EffectHandler): void {
    AbilityEffectHandler.handlers.set(type, handler);
  }

  /**
   * Execute a single effect.
   * @returns Estimated tiles cleared (0 for purely visual effects).
   */
  static execute(effect: AbilityEffect, context: AbilityEffectContext): number {
    const handler = AbilityEffectHandler.handlers.get(effect.type);
    if (!handler) {
      console.warn(`[AbilityEffectHandler] No handler for effect type: ${effect.type}`);
      return 0;
    }
    return handler(effect.params, context);
  }

  /** Register all built-in handlers.  Call once at application startup. */
  static registerBuiltIns(): void {
    AbilityEffectHandler.register('screen_effect',   handleScreenEffect);
    AbilityEffectHandler.register('clear_column',    handleClearColumn);
    AbilityEffectHandler.register('clear_row',       handleClearRow);
    AbilityEffectHandler.register('clear_radius',    handleClearRadius);
    AbilityEffectHandler.register('clear_type',      handleClearType);
    AbilityEffectHandler.register('chain_reaction',  handleChainReaction);
    AbilityEffectHandler.register('restore_moves',   handleRestoreMoves);
    AbilityEffectHandler.register('score_bonus',     handleScoreBonus);
    AbilityEffectHandler.register('board_modifier',  handleBoardModifier);
    AbilityEffectHandler.register('spawn_special',   handleSpawnSpecial);
  }
}

// ── Built-in handlers ─────────────────────────────────────────────────────────

function handleScreenEffect(
  params:  Record<string, unknown>,
  context: AbilityEffectContext,
): number {
  const { kind, color, alpha, duration } = params as {
    kind:      'flash' | 'shake';
    color:     number;
    alpha:     number;
    duration:  number;
  };

  if (kind === 'flash') {
    context.effects.screenFlash(color ?? PALETTE.white, duration ?? 300, alpha ?? 0.25);
  } else if (kind === 'shake') {
    context.effects.screenShake(8, duration ?? 400);
  }
  return 0;
}

function handleClearColumn(
  params:  Record<string, unknown>,
  context: AbilityEffectContext,
): number {
  const count = (params.count as number) ?? 1;
  const cols  = pickRandomInts(count, 0, BOARD_COLS - 1);

  cols.forEach((col, i) => {
    context.scene.time.delayedCall(i * 80, () => {
      context.board.clearColumn(col);
      // Lightning VFX down the column
      for (let r = 0; r < BOARD_ROWS - 1; r++) {
        const { x: x1, y: y1 } = context.board.gridToWorld(col, r);
        const { x: x2, y: y2 } = context.board.gridToWorld(col, r + 1);
        context.scene.time.delayedCall(r * 35, () =>
          context.effects.spawnLightningEffect(x1, y1, x2, y2),
        );
      }
    });
  });

  return count * BOARD_ROWS;
}

function handleClearRow(
  params:  Record<string, unknown>,
  context: AbilityEffectContext,
): number {
  const count = (params.count as number) ?? 1;
  const rows  = pickRandomInts(count, 0, BOARD_ROWS - 1);

  rows.forEach((row, i) => {
    context.scene.time.delayedCall(i * 80, () => {
      context.board.clearRow(row);
      // Signal sweep VFX across the row
      for (let c = 0; c < BOARD_COLS - 1; c++) {
        const { x: x1, y: y1 } = context.board.gridToWorld(c,     row);
        const { x: x2, y: y2 } = context.board.gridToWorld(c + 1, row);
        context.scene.time.delayedCall(c * 35, () =>
          context.effects.spawnLightningEffect(x1, y1, x2, y2),
        );
      }
    });
  });

  return count * BOARD_COLS;
}

function handleClearRadius(
  params:  Record<string, unknown>,
  context: AbilityEffectContext,
): number {
  const radius = (params.radius as number) ?? 1;
  const col    = Phaser.Math.Between(radius, BOARD_COLS - 1 - radius);
  const row    = Phaser.Math.Between(radius, BOARD_ROWS - 1 - radius);

  const { x, y } = context.board.gridToWorld(col, row);
  context.effects.spawnMatchBurst(x, y, PALETTE.goldPale, 8);
  context.board.clearRadius(col, row, radius);

  // Estimate cleared tiles in the radius square
  const side = radius * 2 + 1;
  return Math.min(side * side, BOARD_COLS * BOARD_ROWS);
}

function handleClearType(
  params:  Record<string, unknown>,
  context: AbilityEffectContext,
): number {
  const mode = (params.mode as string) ?? 'most_common';
  let type: TileType;

  if (mode === 'most_common') {
    type = findMostCommonType(context.board) ?? 'star';
  } else {
    type = mode as TileType;
  }

  context.board.clearAllOfType(type);
  context.effects.screenFlash(PALETTE.purpleLight, 400, 0.25);

  // Count how many tiles of that type appeared
  return countTypeOnBoard(context.board, type);
}

function handleChainReaction(
  params:  Record<string, unknown>,
  context: AbilityEffectContext,
): number {
  const count     = (params.count as number) ?? 6;
  const staggerMs = (params.staggerMs as number) ?? 80;
  const targets   = pickRandomCells(count, BOARD_COLS, BOARD_ROWS);

  targets.forEach(({ col, row }, i) => {
    context.scene.time.delayedCall(i * staggerMs, () => {
      const { x, y } = context.board.gridToWorld(col, row);
      context.board.clearRadius(col, row, 0);
      context.effects.spawnMatchBurst(x, y, PALETTE.pink, 4);
    });
  });

  return count;
}

function handleRestoreMoves(
  params:  Record<string, unknown>,
  context: AbilityEffectContext,
): number {
  const count = (params.count as number) ?? 3;
  context.onMovesRestored?.(count);
  return 0;
}

function handleScoreBonus(
  _params:  Record<string, unknown>,
  _context: AbilityEffectContext,
): number {
  // Score bonus is handled at the AbilitySystem level via 'ability:complete'.
  // This effect type is reserved for future chained bonuses.
  return 0;
}

function handleBoardModifier(
  params:  Record<string, unknown>,
  _context: AbilityEffectContext,
): number {
  // Phase 3+: apply overload / freeze / shield modifiers.
  console.warn('[AbilityEffectHandler] board_modifier is not yet implemented:', params);
  return 0;
}

function handleSpawnSpecial(
  params:  Record<string, unknown>,
  _context: AbilityEffectContext,
): number {
  // Phase 3+: spawn wildcard or circuit-specific tiles.
  console.warn('[AbilityEffectHandler] spawn_special is not yet implemented:', params);
  return 0;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return `count` distinct random integers in [min, max]. */
function pickRandomInts(count: number, min: number, max: number): number[] {
  const pool   = Array.from({ length: max - min + 1 }, (_, i) => i + min);
  const result: number[] = [];
  while (result.length < count && pool.length > 0) {
    const i = Phaser.Math.Between(0, pool.length - 1);
    result.push(pool.splice(i, 1)[0]!);
  }
  return result;
}

/** Return `count` distinct random {col, row} pairs from a cols×rows grid. */
function pickRandomCells(
  count: number,
  cols:  number,
  rows:  number,
): Array<{ col: number; row: number }> {
  const all: Array<{ col: number; row: number }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) all.push({ col: c, row: r });
  }
  const result: Array<{ col: number; row: number }> = [];
  while (result.length < count && all.length > 0) {
    const i = Phaser.Math.Between(0, all.length - 1);
    result.push(all.splice(i, 1)[0]!);
  }
  return result;
}

/** Inspect the current board snapshot and return the most-common TileType. */
function findMostCommonType(board: Board): TileType | null {
  const counts = new Map<TileType, number>();
  const snap   = board.getBoardSnapshot();
  for (const row of snap) {
    for (const cell of row) {
      counts.set(cell.type, (counts.get(cell.type) ?? 0) + 1);
    }
  }
  let best: TileType | null = null;
  let max  = 0;
  counts.forEach((n, t) => { if (n > max) { max = n; best = t; } });
  return best;
}

/** Count tiles of a given type on the current board snapshot. */
function countTypeOnBoard(board: Board, type: TileType): number {
  let n = 0;
  for (const row of board.getBoardSnapshot()) {
    for (const cell of row) {
      if (cell.type === type) n++;
    }
  }
  return n;
}
