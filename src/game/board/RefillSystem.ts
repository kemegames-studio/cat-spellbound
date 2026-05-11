// ─────────────────────────────────────────────────────────────────────────────
// RefillSystem.ts
//
// Safe tile-type selection for newly spawned tiles.
//
// Goal: guarantee that no new tile creates an instant match when it lands.
// Algorithm: look left (horizontal) and up (vertical) for a same-type run of
// length (MATCH_MIN - 1), then exclude that type from the candidate pool.
//
// This is identical to the original `safeRandomType` in Board, extracted so
// it can be called by GravitySystem without a circular dependency.
//
// Future extension points:
//   • Weighted random: give rare types a lower spawn probability.
//   • Level-configured type pools: certain levels exclude a tile type.
//   • Object pool hook: replace `randomTileType()` with pool.acquire(type).
// ─────────────────────────────────────────────────────────────────────────────

import { TileType, ALL_TILE_TYPES, randomTileType } from './TileTypes';
import { Tile } from './Tile';

export class RefillSystem {
  /**
   * Pick a tile type that will not immediately form a match given the
   * neighbours already present in the grid.
   *
   * @param grid  Row-major grid (may contain nulls for pending-fill slots).
   * @param col   Column of the new tile.
   * @param row   Row of the new tile.
   * @param rows  Board height.
   * @param cols  Board width.
   */
  static safeRandomType(
    grid: (Tile | null)[][],
    col:  number,
    row:  number,
    rows: number,
    cols: number,
  ): TileType {
    const forbidden = new Set<TileType>();

    // Check horizontal run to the left
    if (col >= 2) {
      const a = grid[row]?.[col - 1]?.tileType;
      const b = grid[row]?.[col - 2]?.tileType;
      if (a && a === b) forbidden.add(a);
    }

    // Check vertical run above
    if (row >= 2) {
      const a = grid[row - 1]?.[col]?.tileType;
      const b = grid[row - 2]?.[col]?.tileType;
      if (a && a === b) forbidden.add(a);
    }

    if (forbidden.size === 0) return randomTileType();

    const available = ALL_TILE_TYPES.filter(t => !forbidden.has(t));
    if (available.length === 0) return randomTileType(); // fallback (all forbidden — very rare)

    return available[Math.floor(Math.random() * available.length)] as TileType;
  }

  // ── TODO: Phase 4 — Tile pool integration ────────────────────────────────
  //
  // Replace the above with a TilePool that pre-allocates N tiles per type.
  // TilePool.acquire(type, col, row)  → repositions + resets a pooled tile.
  // TilePool.release(tile)            → returns tile to pool (call from Board).
  //
  // Expected performance gain on mobile: eliminates GC pressure from the
  // ~50 new Tile objects created per cascade on a 7×8 board.
}
