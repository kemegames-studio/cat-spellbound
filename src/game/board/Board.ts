// ─────────────────────────────────────────────────────────────────────────────
// Board.ts  —  Orchestrator (Phase 1 modular refactor)
//
// Board is now a thin coordinator.  All heavy logic lives in dedicated
// modules that can be tested and extended independently:
//
//   MatchLogic    – pure chain detection (horizontal + vertical)
//   GravitySystem – fall / settle after clears
//   RefillSystem  – safe random type selection for new tiles
//   BoardEffects  – VFX hooks decoupled from board logic
//
// External API (GameScene contract — UNCHANGED from pre-refactor):
//   constructor(scene, effects, callbacks)
//   clearColumn(col)
//   clearRow(row)
//   clearRadius(col, row, radius)
//   clearAllOfType(type)
//   triggerGravityRefill(onComplete)
//   hasMoves() → boolean
//   setInteractive(enabled)
//   gridToWorld(col, row) → {x, y}
//   destroy()
//
// Extension hooks (new in Phase 1):
//   triggerReshuffle()   – call when hasMoves() returns false
//   getBoardSnapshot()   – returns serialisable grid state for save / replay
//
// TODO Phase 2: replace hardcoded setupSpecialCells() with level-config data.
// TODO Phase 4: wire TilePool into createTile().
// TODO Phase 5: CircuitHUD — swap EffectsAdapter for ChargedEffectsAdapter.
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import {
  BOARD_COLS, BOARD_ROWS, TILE_SIZE, TILE_GAP,
  BOARD_OFFSET_X, BOARD_OFFSET_Y,
  DEPTHS, ANIM,
} from '../../config/Constants';
import { Tile }                        from './Tile';
import { TileType, MatchGroup }        from './TileTypes';
import { randomTileType }              from './TileTypes';
import { EffectsManager }              from '../effects/EffectsManager';
import { MatchLogic }                  from './MatchLogic';
import { GravitySystem }               from './GravitySystem';
import { RefillSystem }                from './RefillSystem';
import { BoardEffectHooks, EffectsAdapter } from './BoardEffects';

// ── Public callback interface ─────────────────────────────────────────────────

/**
 * Implemented by GameScene (or any future game controller).
 * The Board fires these events; the scene responds.
 */
export interface BoardCallbacks {
  /**
   * Fired once per matched chain group, before tiles are removed.
   * @param group        The matched group.
   * @param allGroups    All groups in this cascade round (for cross detection).
   * @param comboCount   Current cascade depth (1 = first match this move).
   */
  onMatch(group: MatchGroup, allGroups: MatchGroup[], comboCount: number): void;
  /** Fired when a cascade produces its Nth consecutive match (N ≥ 2). */
  onCombo(comboCount: number): void;
  /** Fired after all tiles of a given type have been cleared in one pass. */
  onTileCleared(type: TileType, count: number): void;
  /** Fired when the board settles (no more cascades, processing complete). */
  onBoardStable(): void;
}

// ── Snapshot type (Phase 2+ save / replay) ───────────────────────────────────

export interface TileSnapshot {
  col:      number;
  row:      number;
  type:     TileType;
  cursed:   boolean;
  sleeping: boolean;
}

// ── Board class ───────────────────────────────────────────────────────────────

export class Board {
  private scene:        Phaser.Scene;
  private grid:         (Tile | null)[][] = [];
  private fx:           BoardEffectHooks;
  private callbacks:    BoardCallbacks;
  private isProcessing: boolean = false;
  private selectedTile: Tile | null = null;
  private comboCount:   number = 0;

  // Special cell registries
  private portalPairs:      Array<[{ col: number; row: number }, { col: number; row: number }]> = [];
  private cursedCells:      Set<string> = new Set();
  private sleepingCatCells: Set<string> = new Set();

  constructor(
    scene:     Phaser.Scene,
    effects:   EffectsManager,
    callbacks: BoardCallbacks,
  ) {
    this.scene     = scene;
    this.fx        = new EffectsAdapter(effects);
    this.callbacks = callbacks;
    this.initGrid();
    this.setupSpecialCells();
  }

  // ── Initialisation ─────────────────────────────────────────────────────────

  private initGrid(): void {
    for (let row = 0; row < BOARD_ROWS; row++) {
      this.grid[row] = [];
      for (let col = 0; col < BOARD_COLS; col++) {
        const type = RefillSystem.safeRandomType(this.grid, col, row, BOARD_ROWS, BOARD_COLS);
        const tile = this.createTile(type, col, row, false);
        this.grid[row][col] = tile;
        // Stagger spawn so tiles cascade in from above
        tile.playSpawnAnimation(BOARD_OFFSET_Y - 60 - row * 20);
      }
    }
  }

  /**
   * Place special cells at fixed positions.
   * TODO Phase 2: read from LevelConfig instead of hardcoding.
   */
  private setupSpecialCells(): void {
    // Portal pair
    this.portalPairs.push([{ col: 1, row: 2 }, { col: 5, row: 6 }]);

    // Cursed tiles
    [{ col: 3, row: 4 }, { col: 2, row: 7 }].forEach(({ col, row }) => {
      const tile = this.grid[row]?.[col];
      if (tile) {
        tile.applyCurse();
        this.cursedCells.add(`${col},${row}`);
      }
    });

    // Sleeping cat
    const { col, row } = { col: 6, row: 1 };
    const catTile = this.grid[row]?.[col];
    if (catTile) {
      catTile.sleeping = true;
      catTile.baseImage?.setTexture('tile_sleeping_cat');
      catTile.disableInteractive();
    }
    this.sleepingCatCells.add(`${col},${row}`);
  }

  // ── Tile factory ───────────────────────────────────────────────────────────

  private createTile(type: TileType, col: number, row: number, spawn = true): Tile {
    const { x, y } = this.gridToWorld(col, row);
    const tile = new Tile(this.scene, x, y, type, col, row);
    tile.setDepth(DEPTHS.tiles + row * 0.1);

    // Input events
    tile.on('pointerdown', () => this.onTilePointerDown(tile));
    tile.on('pointerover', () => tile.setHovered(true));
    tile.on('pointerout',  () => tile.setHovered(false));

    // Particle hook events → route to BoardEffectHooks
    tile.on('tile:match', ({ x: tx, y: ty, color }: { x: number; y: number; color: number }) => {
      // Board.processMatches already calls fx.onMatchBurst with the chain size.
      // This secondary hook lets future listeners (companion, sound) react.
    });
    tile.on('tile:land', ({ x: tx, y: ty, color }: { x: number; y: number; color: number }) => {
      // TODO Phase 3: small landing dust particle
    });

    if (spawn) tile.playSpawnAnimation(y - 120);
    return tile;
  }

  // ── Grid helpers ───────────────────────────────────────────────────────────

  gridToWorld(col: number, row: number): { x: number; y: number } {
    return {
      x: BOARD_OFFSET_X + col * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2,
      y: BOARD_OFFSET_Y + row * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2,
    };
  }

  // ── Input handlers ─────────────────────────────────────────────────────────

  private onTilePointerDown(tile: Tile): void {
    if (this.isProcessing || tile.sleeping) return;

    if (!this.selectedTile) {
      this.selectedTile = tile;
      tile.setSelected(true);
      this.fx.onSelectBurst(tile.x, tile.y, tile.getColor());

    } else if (this.selectedTile === tile) {
      tile.setSelected(false);
      this.selectedTile = null;

    } else if (this.areAdjacent(this.selectedTile, tile)) {
      this.trySwap(this.selectedTile, tile);

    } else {
      // Re-select
      this.selectedTile.setSelected(false);
      this.selectedTile = tile;
      tile.setSelected(true);
      this.fx.onSelectBurst(tile.x, tile.y, tile.getColor());
    }
  }

  private areAdjacent(a: Tile, b: Tile): boolean {
    const dc = Math.abs(a.gridCol - b.gridCol);
    const dr = Math.abs(a.gridRow - b.gridRow);
    return (dc === 1 && dr === 0) || (dc === 0 && dr === 1);
  }

  // ── Swap ───────────────────────────────────────────────────────────────────

  private trySwap(tileA: Tile, tileB: Tile): void {
    tileA.setSelected(false);
    tileB.setSelected(false);
    this.selectedTile = null;
    this.isProcessing = true;
    this.comboCount   = 0;

    const { gridCol: ac, gridRow: ar } = tileA;
    const { gridCol: bc, gridRow: br } = tileB;
    const { x: ax, y: ay } = this.gridToWorld(ac, ar);
    const { x: bx, y: by } = this.gridToWorld(bc, br);

    tileA.playSwapAnimation(bx, by);
    tileB.playSwapAnimation(ax, ay);

    // Commit swap in grid immediately (animations run concurrently)
    this.grid[ar][ac] = tileB;
    this.grid[br][bc] = tileA;
    tileA.updateGridPosition(bc, br);
    tileB.updateGridPosition(ac, ar);

    this.scene.time.delayedCall(ANIM.tileSwap + 20, () => {
      const matches = MatchLogic.findAll(this.grid, BOARD_ROWS, BOARD_COLS);

      if (matches.length > 0) {
        this.processMatches(matches);
      } else {
        // Revert
        tileA.playSwapAnimation(ax, ay);
        tileB.playSwapAnimation(bx, by);
        this.grid[ar][ac] = tileA;
        this.grid[br][bc] = tileB;
        tileA.updateGridPosition(ac, ar);
        tileB.updateGridPosition(bc, br);
        this.fx.onInvalidSwap(tileA.x, tileA.y);

        this.scene.time.delayedCall(ANIM.tileSwap + 20, () => {
          this.isProcessing = false;
        });
      }
    });
  }

  // ── Match processing pipeline ─────────────────────────────────────────────

  private processMatches(matches: MatchGroup[]): void {
    this.comboCount++;

    const typeCounts: Partial<Record<TileType, number>> = {};
    let maxAnimDelay = 0;

    matches.forEach(group => {
      typeCounts[group.type] = (typeCounts[group.type] ?? 0) + group.tiles.length;

      group.tiles.forEach(({ col, row }) => {
        const tile = this.grid[row][col];
        if (!tile || tile.isMatched) return;
        tile.isMatched = true;

        const delay = (col + row) * ANIM.comboDelay * 0.4;
        maxAnimDelay = Math.max(maxAnimDelay, delay);

        // Portal adjacency check
        if (this.isPortalAdjacent(col, row)) {
          this.fx.onPortalTeleport(tile.x, tile.y, tile.getColor());
        }

        // Special chain visual
        if (group.isSpecial) {
          // TODO Phase 3: CircuitTile.playShortedFlash() here
        }

        this.scene.time.delayedCall(delay, () => {
          if (!tile.scene) return;
          this.fx.onMatchBurst(tile.x, tile.y, tile.getColor(), group.size);
          tile.playMatchAnimation(() => {
            this.grid[row][col] = null;
          });
        });
      });

      this.callbacks.onMatch(group, matches, this.comboCount);
    });

    // Notify scene of cleared counts by type
    (Object.entries(typeCounts) as [TileType, number][]).forEach(([type, count]) => {
      this.callbacks.onTileCleared(type, count);
    });

    // Combo flash
    if (this.comboCount > 1) {
      this.callbacks.onCombo(this.comboCount);
      this.fx.onComboFlash(this.comboCount);
    }

    // Spread curse after each match pass
    this.spreadCurse();

    // After all destroy animations finish → gravity → next cascade check
    const gravityDelay = maxAnimDelay + ANIM.tileDestroy + 40;
    this.scene.time.delayedCall(gravityDelay, () => {
      GravitySystem.apply(
        this.scene,
        this.grid,
        BOARD_ROWS,
        BOARD_COLS,
        (col, row) => this.gridToWorld(col, row),
        (col, row) => this.createTile(randomTileType(), col, row, false),
        () => {
          this.scene.time.delayedCall(ANIM.cascadeDelay, () => {
            const nextMatches = MatchLogic.findAll(this.grid, BOARD_ROWS, BOARD_COLS);

            if (nextMatches.length > 0) {
              this.processMatches(nextMatches);
            } else {
              this.isProcessing = false;
              this.comboCount   = 0;
              this.checkDeadlock();
              this.callbacks.onBoardStable();
            }
          });
        },
      );
    });
  }

  // ── Deadlock detection & reshuffle ────────────────────────────────────────

  /**
   * Check for deadlock after the board settles.
   * If no valid swap exists, trigger a reshuffle.
   */
  private checkDeadlock(): void {
    if (!MatchLogic.hasMoves(this.grid, BOARD_ROWS, BOARD_COLS)) {
      this.scene.time.delayedCall(400, () => this.triggerReshuffle());
    }
  }

  /**
   * Reshuffle: randomise all tile types while keeping the same objects.
   * Fires the onReshuffle VFX hook, then re-checks for deadlock.
   *
   * Called automatically by checkDeadlock().
   * Can also be triggered externally (e.g. an ability that reshuffles the board).
   */
  triggerReshuffle(): void {
    this.isProcessing = true;
    this.fx.onReshuffle();

    // Collect all live tiles
    const tiles: Tile[] = [];
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const t = this.grid[row][col];
        if (t) tiles.push(t);
      }
    }

    // Fisher-Yates shuffle of tile types
    const types = tiles.map(t => t.tileType);
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }

    // Re-assign types + animate back in
    tiles.forEach((tile, idx) => {
      const newType = types[idx]!;
      tile.tileType = newType;
      tile.baseImage?.setTexture(`tile_${newType}`);
      tile.refreshGlowColor();
      tile.setScale(0);
      this.scene.tweens.add({
        targets:  tile,
        scaleX:   1,
        scaleY:   1,
        duration: 220,
        delay:    idx * 8,
        ease:     'Back.easeOut',
      });
    });

    const settleDelay = tiles.length * 8 + 280;
    this.scene.time.delayedCall(settleDelay, () => {
      this.isProcessing = false;

      // Guard: if still deadlocked, reshuffle again
      if (!MatchLogic.hasMoves(this.grid, BOARD_ROWS, BOARD_COLS)) {
        this.triggerReshuffle();
      }
    });
  }

  /**
   * Public deadlock query — used by GameScene to decide whether to
   * show a "no moves" warning or deduct a move penalty.
   */
  hasMoves(): boolean {
    return MatchLogic.hasMoves(this.grid, BOARD_ROWS, BOARD_COLS);
  }

  // ── Special cell mechanics ────────────────────────────────────────────────

  private spreadCurse(): void {
    const newCursed: Array<{ col: number; row: number }> = [];

    this.cursedCells.forEach(key => {
      const [c, r] = key.split(',').map(Number);
      if (Math.random() >= 0.25) return;

      const neighbours = [
        { col: c + 1, row: r },
        { col: c - 1, row: r },
        { col: c, row: r + 1 },
        { col: c, row: r - 1 },
      ].filter(n =>
        n.col >= 0 && n.col < BOARD_COLS &&
        n.row >= 0 && n.row < BOARD_ROWS &&
        !this.cursedCells.has(`${n.col},${n.row}`),
      );

      if (neighbours.length > 0) {
        newCursed.push(neighbours[Math.floor(Math.random() * neighbours.length)]!);
      }
    });

    newCursed.forEach(({ col, row }) => {
      const tile = this.grid[row]?.[col];
      if (tile) {
        tile.applyCurse();
        this.cursedCells.add(`${col},${row}`);
      }
    });
  }

  private isPortalAdjacent(col: number, row: number): boolean {
    return this.portalPairs.some(([a, b]) =>
      (Math.abs(a.col - col) <= 1 && Math.abs(a.row - row) <= 1) ||
      (Math.abs(b.col - col) <= 1 && Math.abs(b.row - row) <= 1),
    );
  }

  // ── Spell / Ability clear APIs ────────────────────────────────────────────
  // Same signatures as before — GameScene calls these unchanged.
  // TODO Phase 5: Each method fires a corresponding onAbilityCast hook
  //               once BoardEffects adds the Phase 3 ability stubs.

  clearColumn(col: number): void {
    this.clearTilesWhere(
      (c, r) => c === col,
      (_, r) => r * 60,
    );
  }

  clearRow(row: number): void {
    this.clearTilesWhere(
      (c, r) => r === row,
      (c) => c * 60,
    );
  }

  clearRadius(col: number, row: number, radius: number): void {
    this.clearTilesWhere(
      (c, r) => Math.abs(c - col) <= radius && Math.abs(r - row) <= radius,
      (c, r) => (Math.abs(c - col) + Math.abs(r - row)) * 60,
    );
  }

  clearAllOfType(type: TileType): void {
    this.clearTilesWhere(
      (c, r) => this.grid[r]?.[c]?.tileType === type,
      () => Math.random() * 300,
    );
  }

  /**
   * Shared implementation for all area-clear spells.
   * @param predicate  Returns true if a tile at (col, row) should be cleared.
   * @param delayFn    Returns the stagger delay in ms for each tile.
   */
  private clearTilesWhere(
    predicate: (col: number, row: number) => boolean,
    delayFn:   (col: number, row: number) => number,
  ): void {
    // Accumulate per-type counts so we can notify the objective system once,
    // synchronously, after all tiles have been flagged (not inside the
    // delayedCall — by then the tiles are gone and the scene may have moved on).
    const typeCounts: Partial<Record<TileType, number>> = {};

    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const tile = this.grid[row][col];
        if (!tile || tile.isMatched) continue;
        if (!predicate(col, row)) continue;

        tile.isMatched = true;
        typeCounts[tile.tileType] = (typeCounts[tile.tileType] ?? 0) + 1;

        const delay = delayFn(col, row);
        const rowC  = row;
        const colC  = col;

        this.scene.time.delayedCall(delay, () => {
          if (!tile.scene) return;
          this.fx.onMatchBurst(tile.x, tile.y, tile.getColor(), 3);
          tile.playMatchAnimation(() => { this.grid[rowC][colC] = null; });
        });
      }
    }

    // Notify objective / scoring system for every cleared tile type.
    // Called synchronously so the level-complete check can fire in the same
    // frame that the spell ability is activated.
    (Object.entries(typeCounts) as [TileType, number][]).forEach(([type, count]) => {
      this.callbacks.onTileCleared(type, count);
    });
  }

  /**
   * Trigger gravity + refill + cascade after a spell clear.
   * GameScene calls this after any clearColumn/clearRow/etc. call.
   */
  triggerGravityRefill(onComplete: () => void): void {
    this.isProcessing = true;

    this.scene.time.delayedCall(ANIM.tileDestroy + 100, () => {
      GravitySystem.apply(
        this.scene,
        this.grid,
        BOARD_ROWS,
        BOARD_COLS,
        (col, row) => this.gridToWorld(col, row),
        (col, row) => this.createTile(randomTileType(), col, row, false),
        () => {
          this.scene.time.delayedCall(ANIM.cascadeDelay, () => {
            const matches = MatchLogic.findAll(this.grid, BOARD_ROWS, BOARD_COLS);
            if (matches.length > 0) {
              this.processMatches(matches);
            } else {
              this.isProcessing = false;
              onComplete();
            }
          });
        },
      );
    });
  }

  // ── Snapshot (Phase 2+ persistence / replay) ──────────────────────────────

  /**
   * Returns a serialisable snapshot of the current board state.
   * Stored in save data; replayed for hints and level replays.
   */
  getBoardSnapshot(): TileSnapshot[][] {
    return this.grid.map(rowArr =>
      rowArr.map(tile =>
        tile
          ? {
              col:      tile.gridCol,
              row:      tile.gridRow,
              type:     tile.tileType,
              cursed:   tile.cursed,
              sleeping: tile.sleeping,
            }
          : { col: 0, row: 0, type: 'star' as TileType, cursed: false, sleeping: false },
      ),
    );
  }

  // ── Interactive toggle ────────────────────────────────────────────────────

  setInteractive(enabled: boolean): void {
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const tile = this.grid[row][col];
        if (!tile || tile.sleeping) continue;
        enabled ? tile.setInteractive() : tile.disableInteractive();
      }
    }
  }

  // ── Teardown ──────────────────────────────────────────────────────────────

  destroy(): void {
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        this.grid[row][col]?.destroy();
        this.grid[row][col] = null;
      }
    }
  }
}
