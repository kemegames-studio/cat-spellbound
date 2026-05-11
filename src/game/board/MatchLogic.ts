// ─────────────────────────────────────────────────────────────────────────────
// MatchLogic.ts
//
// Pure, stateless chain-detection extracted from Board.
//
// Rules:
//   • Horizontal and vertical runs of ≥ minLen tiles of the same type.
//   • Tiles already flagged isMatched are skipped (they're mid-destruction).
//   • The same cell is never counted twice across groups in one scan
//     (visited Set prevents double-reporting).
//
// This module has NO Phaser imports and NO side effects — every method is
// a pure function over the grid array.  It can be called from unit tests
// without a running scene.
//
// Future extension points:
//   • L-shaped / T-shaped match detection: add a mergeGroups() pass.
//   • Diagonal matching: add diagonal sweep loops.
//   • Wildcard tiles: extend the type equality check.
// ─────────────────────────────────────────────────────────────────────────────

import { MatchGroup, TileType } from './TileTypes';
import { Tile } from './Tile';

/** Minimal interface so MatchLogic works with any tile-like object. */
interface GridTile {
  tileType:  TileType;
  isMatched: boolean;
  /** Grid column assigned to this tile (kept in sync by Board). */
  gridCol:   number;
  /** Grid row assigned to this tile (kept in sync by Board). */
  gridRow:   number;
}

export class MatchLogic {
  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Scan the entire grid and return every chain that qualifies.
   *
   * @param grid    Row-major 2-D array: grid[row][col].
   * @param rows    Board height in tiles.
   * @param cols    Board width in tiles.
   * @param minLen  Minimum run length to qualify (default 3).
   */
  static findAll(
    grid: (Tile | null)[][],
    rows: number,
    cols: number,
    minLen: number = 3,
  ): MatchGroup[] {
    const visited = new Set<string>();
    const matches: MatchGroup[] = [];

    // ── Horizontal sweep ────────────────────────────────────────────────────
    for (let row = 0; row < rows; row++) {
      let col = 0;
      while (col < cols) {
        const tile = grid[row][col];
        if (!tile || tile.isMatched) { col++; continue; }

        const type = tile.tileType;
        let len = 1;
        while (col + len < cols) {
          const next = grid[row][col + len];
          if (!next || next.tileType !== type || next.isMatched) break;
          len++;
        }

        if (len >= minLen) {
          const group = MatchLogic.buildGroup(type, len, visited, col, row, 'h');
          if (group.tiles.length >= minLen) matches.push(group);
        }
        col += len;
      }
    }

    // ── Vertical sweep ──────────────────────────────────────────────────────
    for (let col = 0; col < cols; col++) {
      let row = 0;
      while (row < rows) {
        const tile = grid[row][col];
        if (!tile || tile.isMatched) { row++; continue; }

        const type = tile.tileType;
        let len = 1;
        while (row + len < rows) {
          const next = grid[row + len][col];
          if (!next || next.tileType !== type || next.isMatched) break;
          len++;
        }

        if (len >= minLen) {
          const group = MatchLogic.buildGroup(type, len, visited, col, row, 'v');
          if (group.tiles.length >= minLen) matches.push(group);
        }
        row += len;
      }
    }

    return matches;
  }

  // ── Deadlock helpers ────────────────────────────────────────────────────────

  /**
   * Returns `true` when at least one valid swap exists across the whole board.
   * If `false`, the board is deadlocked and must be reshuffled.
   *
   * Performance: O(rows × cols) — checks every right + down neighbour pair.
   */
  static hasMoves(
    grid: (Tile | null)[][],
    rows: number,
    cols: number,
    minLen: number = 3,
  ): boolean {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (col < cols - 1 && MatchLogic.wouldMatch(grid, col, row, col + 1, row, rows, cols, minLen)) return true;
        if (row < rows - 1 && MatchLogic.wouldMatch(grid, col, row, col, row + 1, rows, cols, minLen)) return true;
      }
    }
    return false;
  }

  /**
   * Simulate swapping (c1,r1)↔(c2,r2), check for any chain, then undo.
   * Mutates grid temporarily but always restores it — safe to call any time
   * the board is not mid-animation.
   */
  static wouldMatch(
    grid: (Tile | null)[][],
    c1: number, r1: number,
    c2: number, r2: number,
    rows: number,
    cols: number,
    minLen: number = 3,
  ): boolean {
    const tA = grid[r1][c1];
    const tB = grid[r2][c2];
    if (!tA || !tB) return false;

    // Swap
    grid[r1][c1] = tB;
    grid[r2][c2] = tA;
    tA.updateGridPosition(c2, r2);
    tB.updateGridPosition(c1, r1);

    const hasChain = MatchLogic.findAll(grid, rows, cols, minLen).length > 0;

    // Undo
    grid[r1][c1] = tA;
    grid[r2][c2] = tB;
    tA.updateGridPosition(c1, r1);
    tB.updateGridPosition(c2, r2);

    return hasChain;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private static buildGroup(
    type:    TileType,
    len:     number,
    visited: Set<string>,
    startCol: number,
    startRow: number,
    axis:    'h' | 'v',
  ): MatchGroup {
    const tiles: Array<{ col: number; row: number }> = [];

    for (let i = 0; i < len; i++) {
      const col = axis === 'h' ? startCol + i : startCol;
      const row = axis === 'v' ? startRow + i : startRow;
      const key = `${col},${row}`;
      if (!visited.has(key)) {
        tiles.push({ col, row });
        visited.add(key);
      }
    }

    return {
      type,
      tiles,
      size: len,
      isSpecial:  len >= 4,
      isMegaMatch: len >= 5,
    };
  }
}
