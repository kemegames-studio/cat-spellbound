// ─────────────────────────────────────────────────────────────────────────────
// GravitySystem.ts
//
// Extracted gravity + column-settle logic from Board.
//
// Responsibilities:
//   1. Shift existing non-null tiles down to fill gaps (gravity).
//   2. Delegate new-tile spawning (refill) to RefillSystem.
//   3. Track all in-flight fall tweens and fire `onComplete` exactly once
//      when the last tween settles.
//
// Design decisions:
//   • Column-by-column processing prevents race conditions.
//   • Fall duration scales with drop distance: base + distance × 0.4
//     — farther falls feel appropriately weightier.
//   • `onComplete` is guaranteed to fire even when the column is already
//     full (falling === 0 branch).
//   • Object pooling TODO: tile creation is currently handled via the
//     createTile callback.  Phase 4 will replace that callback with a
//     TilePool.acquire() call for zero-GC fills on mobile.
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { BOARD_OFFSET_Y, TILE_SIZE, TILE_GAP, ANIM } from '../../config/Constants';
import { Tile } from './Tile';
import { RefillSystem } from './RefillSystem';

/** Function signature the Board provides to spawn a brand-new tile. */
export type CreateTileFn = (col: number, row: number) => Tile;

/** Function signature the Board provides to convert grid → world coords. */
export type GridToWorldFn = (col: number, row: number) => { x: number; y: number };

export class GravitySystem {
  /**
   * Apply gravity to every column then refill empty cells from the top.
   *
   * @param scene       Active Phaser scene (needed for delayedCall / tweens).
   * @param grid        Row-major grid: grid[row][col].
   * @param rows        Board height.
   * @param cols        Board width.
   * @param gridToWorld Converts (col, row) → world {x, y}.
   * @param createTile  Factory that constructs a new positioned Tile.
   * @param onComplete  Fired once ALL fall animations have finished.
   */
  static apply(
    scene:       Phaser.Scene,
    grid:        (Tile | null)[][],
    rows:        number,
    cols:        number,
    gridToWorld: GridToWorldFn,
    createTile:  CreateTileFn,
    onComplete:  () => void,
  ): void {
    let falling = 0;

    const done = () => {
      falling--;
      if (falling <= 0) onComplete();
    };

    for (let col = 0; col < cols; col++) {
      // ── Step 1: compact existing tiles toward the bottom ────────────────
      let writeRow = rows - 1;

      for (let row = rows - 1; row >= 0; row--) {
        const tile = grid[row][col];
        if (tile && !tile.isMatched) {
          if (row !== writeRow) {
            // Move in grid
            grid[writeRow][col] = tile;
            grid[row][col]      = null;
            tile.updateGridPosition(col, writeRow);

            // Animate fall
            const { y: targetY } = gridToWorld(col, writeRow);
            const fallDist = writeRow - row;
            falling++;
            tile.playFallAnimation(targetY, fallDist, done);
          }
          writeRow--;
        }
      }

      // ── Step 2: spawn new tiles into empty slots at the top ─────────────
      // writeRow is now the index of the lowest EMPTY row (or -1 if column full)
      for (let row = writeRow; row >= 0; row--) {
        const type = RefillSystem.safeRandomType(grid, col, row, rows, cols);
        const tile = createTile(col, row);

        // Position tile above the board so it falls in
        const { y: targetY } = gridToWorld(col, row);
        const slotsAbove     = writeRow - row + 1;
        tile.y = BOARD_OFFSET_Y - slotsAbove * (TILE_SIZE + TILE_GAP);

        grid[row][col] = tile;
        const fallDist = writeRow - row;

        falling++;
        tile.playFallAnimation(targetY, fallDist, done);
      }
    }

    // All columns were full — fire immediately
    if (falling === 0) {
      scene.time.delayedCall(50, onComplete);
    }
  }
}
