import Phaser from 'phaser';
import {
  BOARD_COLS, BOARD_ROWS, TILE_SIZE, TILE_GAP,
  BOARD_OFFSET_X, BOARD_OFFSET_Y, MATCH_MIN,
  DEPTHS, ANIM,
} from '../../config/Constants';
import { Tile } from './Tile';
import { TileType, ALL_TILE_TYPES, MatchGroup, randomTileType } from './TileTypes';
import { EffectsManager } from '../effects/EffectsManager';

export interface BoardCallbacks {
  onMatch: (group: MatchGroup) => void;
  onCombo: (comboCount: number) => void;
  onTileCleared: (type: TileType, count: number) => void;
  onBoardStable: () => void;
}

export class Board {
  private scene: Phaser.Scene;
  private grid: (Tile | null)[][] = [];
  private effects: EffectsManager;
  private callbacks: BoardCallbacks;
  private isProcessing: boolean = false;
  private selectedTile: Tile | null = null;
  private comboCount: number = 0;

  // Special cell data
  private portalPairs: Array<[{ col: number; row: number }, { col: number; row: number }]> = [];
  private cursedCells: Set<string> = new Set();
  private sleepingCatCells: Set<string> = new Set();

  constructor(scene: Phaser.Scene, effects: EffectsManager, callbacks: BoardCallbacks) {
    this.scene = scene;
    this.effects = effects;
    this.callbacks = callbacks;
    this.initGrid();
    this.setupSpecialCells();
  }

  private initGrid(): void {
    for (let row = 0; row < BOARD_ROWS; row++) {
      this.grid[row] = [];
      for (let col = 0; col < BOARD_COLS; col++) {
        const type = this.safeRandomType(col, row);
        const tile = this.createTile(type, col, row, false);
        this.grid[row][col] = tile;
        tile.playSpawnAnimation(BOARD_OFFSET_Y - 60 - row * 20);
      }
    }
  }

  private setupSpecialCells(): void {
    // Place portal pair
    this.portalPairs.push([{ col: 1, row: 2 }, { col: 5, row: 6 }]);

    // Place cursed cells
    const cursedPositions = [{ col: 3, row: 4 }, { col: 2, row: 7 }];
    cursedPositions.forEach(({ col, row }) => {
      const tile = this.grid[row][col];
      if (tile) {
        tile.applyCurse();
        this.cursedCells.add(`${col},${row}`);
      }
    });

    // Place sleeping cat
    const catPos = { col: 6, row: 1 };
    const catTile = this.grid[catPos.row][catPos.col];
    if (catTile) {
      catTile.sleeping = true;
      catTile.baseImage?.setTexture('tile_sleeping_cat');
    }
    this.sleepingCatCells.add(`${catPos.col},${catPos.row}`);
  }

  private safeRandomType(col: number, row: number): TileType {
    const forbidden = new Set<TileType>();

    if (col >= 2) {
      const a = this.grid[row]?.[col - 1]?.tileType;
      const b = this.grid[row]?.[col - 2]?.tileType;
      if (a && a === b) forbidden.add(a);
    }
    if (row >= 2) {
      const a = this.grid[row - 1]?.[col]?.tileType;
      const b = this.grid[row - 2]?.[col]?.tileType;
      if (a && a === b) forbidden.add(a);
    }

    const available = ALL_TILE_TYPES.filter(t => !forbidden.has(t));
    return available[Math.floor(Math.random() * available.length)] ?? randomTileType();
  }

  private createTile(type: TileType, col: number, row: number, spawn: boolean = true): Tile {
    const { x, y } = this.gridToWorld(col, row);
    const tile = new Tile(this.scene, x, y, type, col, row);
    tile.setDepth(DEPTHS.tiles + row * 0.1);
    tile.on('pointerdown', () => this.onTilePointerDown(tile));
    tile.on('pointerover', () => this.onTilePointerOver(tile));
    if (spawn) tile.playSpawnAnimation(y - 120);
    return tile;
  }

  gridToWorld(col: number, row: number): { x: number; y: number } {
    return {
      x: BOARD_OFFSET_X + col * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2,
      y: BOARD_OFFSET_Y + row * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2,
    };
  }

  private onTilePointerDown(tile: Tile): void {
    if (this.isProcessing) return;
    if (tile.sleeping) return;

    if (!this.selectedTile) {
      this.selectedTile = tile;
      tile.setSelected(true);
      this.effects.spawnSelectBurst(tile.x, tile.y, tile.getColor());
    } else if (this.selectedTile === tile) {
      tile.setSelected(false);
      this.selectedTile = null;
    } else if (this.areAdjacent(this.selectedTile, tile)) {
      this.trySwap(this.selectedTile, tile);
    } else {
      this.selectedTile.setSelected(false);
      this.selectedTile = tile;
      tile.setSelected(true);
      this.effects.spawnSelectBurst(tile.x, tile.y, tile.getColor());
    }
  }

  private onTilePointerOver(tile: Tile): void {
    if (!this.isProcessing && !this.selectedTile && !tile.sleeping) {
      this.scene.tweens.add({
        targets: tile,
        scaleX: 1.06,
        scaleY: 1.06,
        duration: 80,
        ease: 'Power2',
      });
    }
  }

  private areAdjacent(a: Tile, b: Tile): boolean {
    const dc = Math.abs(a.gridCol - b.gridCol);
    const dr = Math.abs(a.gridRow - b.gridRow);
    return (dc === 1 && dr === 0) || (dc === 0 && dr === 1);
  }

  private trySwap(tileA: Tile, tileB: Tile): void {
    tileA.setSelected(false);
    tileB.setSelected(false);
    this.selectedTile = null;
    this.isProcessing = true;
    this.comboCount = 0;

    const { gridCol: ac, gridRow: ar } = tileA;
    const { gridCol: bc, gridRow: br } = tileB;
    const { x: ax, y: ay } = this.gridToWorld(ac, ar);
    const { x: bx, y: by } = this.gridToWorld(bc, br);

    // Animate swap
    tileA.playSwapAnimation(bx, by);
    tileB.playSwapAnimation(ax, ay);

    // Update grid immediately
    this.grid[ar][ac] = tileB;
    this.grid[br][bc] = tileA;
    tileA.updateGridPosition(bc, br);
    tileB.updateGridPosition(ac, ar);

    this.scene.time.delayedCall(ANIM.tileSwap + 20, () => {
      const matches = this.findAllMatches();

      if (matches.length > 0) {
        this.processMatches(matches);
      } else {
        // Swap back
        tileA.playSwapAnimation(ax, ay);
        tileB.playSwapAnimation(bx, by);
        this.grid[ar][ac] = tileA;
        this.grid[br][bc] = tileB;
        tileA.updateGridPosition(ac, ar);
        tileB.updateGridPosition(bc, br);
        this.effects.spawnInvalidSwap(tileA.x, tileA.y);

        this.scene.time.delayedCall(ANIM.tileSwap + 20, () => {
          this.isProcessing = false;
        });
      }
    });
  }

  private findAllMatches(): MatchGroup[] {
    const visited = new Set<string>();
    const matches: MatchGroup[] = [];

    // Horizontal
    for (let row = 0; row < BOARD_ROWS; row++) {
      let col = 0;
      while (col < BOARD_COLS) {
        const tile = this.grid[row][col];
        if (!tile || tile.isMatched) { col++; continue; }

        const type = tile.tileType;
        let len = 1;
        while (col + len < BOARD_COLS) {
          const next = this.grid[row][col + len];
          if (!next || next.tileType !== type || next.isMatched) break;
          len++;
        }

        if (len >= MATCH_MIN) {
          const group: MatchGroup = {
            type,
            tiles: [],
            size: len,
            isSpecial: len >= 4,
            isMegaMatch: len >= 5,
          };
          for (let i = 0; i < len; i++) {
            const key = `${col + i},${row}`;
            if (!visited.has(key)) {
              group.tiles.push({ col: col + i, row });
              visited.add(key);
            }
          }
          if (group.tiles.length >= MATCH_MIN) matches.push(group);
        }
        col += len;
      }
    }

    // Vertical
    for (let col = 0; col < BOARD_COLS; col++) {
      let row = 0;
      while (row < BOARD_ROWS) {
        const tile = this.grid[row][col];
        if (!tile || tile.isMatched) { row++; continue; }

        const type = tile.tileType;
        let len = 1;
        while (row + len < BOARD_ROWS) {
          const next = this.grid[row + len][col];
          if (!next || next.tileType !== type || next.isMatched) break;
          len++;
        }

        if (len >= MATCH_MIN) {
          const group: MatchGroup = {
            type,
            tiles: [],
            size: len,
            isSpecial: len >= 4,
            isMegaMatch: len >= 5,
          };
          for (let i = 0; i < len; i++) {
            const key = `${col},${row + i}`;
            if (!visited.has(key)) {
              group.tiles.push({ col, row: row + i });
              visited.add(key);
            }
          }
          if (group.tiles.length >= MATCH_MIN) matches.push(group);
        }
        row += len;
      }
    }

    return matches;
  }

  private processMatches(matches: MatchGroup[]): void {
    this.comboCount++;
    let totalCleared = 0;

    const typeCounts: Partial<Record<TileType, number>> = {};

    matches.forEach(group => {
      typeCounts[group.type] = (typeCounts[group.type] ?? 0) + group.tiles.length;

      group.tiles.forEach(({ col, row }) => {
        const tile = this.grid[row][col];
        if (!tile || tile.isMatched) return;

        tile.isMatched = true;
        totalCleared++;

        // Portal teleport special effect
        if (this.isPortalAdjacent(col, row)) {
          this.effects.spawnPortalTeleport(tile.x, tile.y, tile.getColor());
        }

        const delay = (col + row) * ANIM.comboDelay * 0.4;
        this.scene.time.delayedCall(delay, () => {
          if (!tile.scene) return;
          this.effects.spawnMatchBurst(tile.x, tile.y, tile.getColor(), group.size);
          tile.playMatchAnimation(() => {
            this.grid[row][col] = null;
          });
        });
      });

      this.callbacks.onMatch(group);
    });

    Object.entries(typeCounts).forEach(([type, count]) => {
      this.callbacks.onTileCleared(type as TileType, count ?? 0);
    });

    if (this.comboCount > 1) {
      this.callbacks.onCombo(this.comboCount);
    }

    // Spread curse from cursed cells after match
    this.spreadCurse();

    // Apply gravity after matches clear
    const maxDelay = matches.reduce((max, g) => {
      const d = g.tiles.reduce((m, t) => Math.max(m, (t.col + t.row) * ANIM.comboDelay * 0.4), 0);
      return Math.max(max, d);
    }, 0);

    this.scene.time.delayedCall(maxDelay + ANIM.tileDestroy + 40, () => {
      this.applyGravity(() => {
        this.scene.time.delayedCall(100, () => {
          const newMatches = this.findAllMatches();
          if (newMatches.length > 0) {
            this.processMatches(newMatches);
          } else {
            this.isProcessing = false;
            this.comboCount = 0;
            this.callbacks.onBoardStable();
          }
        });
      });
    });
  }

  private applyGravity(onComplete: () => void): void {
    let falling = 0;

    for (let col = 0; col < BOARD_COLS; col++) {
      let writeRow = BOARD_ROWS - 1;

      for (let row = BOARD_ROWS - 1; row >= 0; row--) {
        const tile = this.grid[row][col];
        if (tile && !tile.isMatched) {
          if (row !== writeRow) {
            this.grid[writeRow][col] = tile;
            this.grid[row][col] = null;
            tile.updateGridPosition(col, writeRow);
            const { y } = this.gridToWorld(col, writeRow);
            const fallDist = writeRow - row;
            falling++;
            tile.playFallAnimation(y, fallDist, () => {
              falling--;
              if (falling <= 0) onComplete();
            });
          }
          writeRow--;
        }
      }

      // Fill empty slots from top
      for (let row = writeRow; row >= 0; row--) {
        const type = randomTileType();
        const tile = this.createTile(type, col, row, false);
        this.grid[row][col] = tile;
        const { y } = this.gridToWorld(col, row);
        const spawnY = BOARD_OFFSET_Y - (writeRow - row + 1) * (TILE_SIZE + TILE_GAP);
        tile.y = spawnY;
        falling++;
        tile.playFallAnimation(y, writeRow - row, () => {
          falling--;
          if (falling <= 0) onComplete();
        });
      }
    }

    if (falling === 0) {
      this.scene.time.delayedCall(50, onComplete);
    }
  }

  private spreadCurse(): void {
    const newCursed: Array<{ col: number; row: number }> = [];

    this.cursedCells.forEach(key => {
      const [c, r] = key.split(',').map(Number);
      const neighbors = [
        { col: c + 1, row: r }, { col: c - 1, row: r },
        { col: c, row: r + 1 }, { col: c, row: r - 1 },
      ];
      if (Math.random() < 0.25) {
        const valid = neighbors.filter(n =>
          n.col >= 0 && n.col < BOARD_COLS &&
          n.row >= 0 && n.row < BOARD_ROWS &&
          !this.cursedCells.has(`${n.col},${n.row}`),
        );
        if (valid.length > 0) {
          const target = valid[Math.floor(Math.random() * valid.length)];
          newCursed.push(target);
        }
      }
    });

    newCursed.forEach(({ col, row }) => {
      const tile = this.grid[row][col];
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

  // --- Power-up / Spell APIs ---

  clearColumn(col: number): void {
    for (let row = 0; row < BOARD_ROWS; row++) {
      const tile = this.grid[row][col];
      if (tile && !tile.isMatched) {
        tile.isMatched = true;
        this.effects.spawnMatchBurst(tile.x, tile.y, tile.getColor(), 3);
        const rowCopy = row;
        const colCopy = col;
        tile.playMatchAnimation(() => {
          this.grid[rowCopy][colCopy] = null;
        });
      }
    }
  }

  clearRow(row: number): void {
    for (let col = 0; col < BOARD_COLS; col++) {
      const tile = this.grid[row][col];
      if (tile && !tile.isMatched) {
        tile.isMatched = true;
        this.effects.spawnMatchBurst(tile.x, tile.y, tile.getColor(), 3);
        const rowCopy = row;
        const colCopy = col;
        tile.playMatchAnimation(() => {
          this.grid[rowCopy][colCopy] = null;
        });
      }
    }
  }

  clearRadius(col: number, row: number, radius: number): void {
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        if (Math.abs(c - col) <= radius && Math.abs(r - row) <= radius) {
          const tile = this.grid[r][c];
          if (tile && !tile.isMatched) {
            tile.isMatched = true;
            const delay = (Math.abs(c - col) + Math.abs(r - row)) * 60;
            this.scene.time.delayedCall(delay, () => {
              if (!tile.scene) return;
              this.effects.spawnMatchBurst(tile.x, tile.y, tile.getColor(), 4);
              tile.playMatchAnimation(() => { this.grid[r][c] = null; });
            });
          }
        }
      }
    }
  }

  clearAllOfType(type: TileType): void {
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const tile = this.grid[row][col];
        if (tile && tile.tileType === type && !tile.isMatched) {
          tile.isMatched = true;
          const delay = Math.random() * 300;
          this.scene.time.delayedCall(delay, () => {
            if (!tile.scene) return;
            this.effects.spawnMatchBurst(tile.x, tile.y, tile.getColor(), 5);
            tile.playMatchAnimation(() => { this.grid[row][col] = null; });
          });
        }
      }
    }
  }

  triggerGravityRefill(onComplete: () => void): void {
    this.isProcessing = true;
    this.scene.time.delayedCall(ANIM.tileDestroy + 100, () => {
      this.applyGravity(() => {
        this.scene.time.delayedCall(100, () => {
          const matches = this.findAllMatches();
          if (matches.length > 0) {
            this.processMatches(matches);
          } else {
            this.isProcessing = false;
            onComplete();
          }
        });
      });
    });
  }

  hasMoves(): boolean {
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        if (col < BOARD_COLS - 1 && this.wouldMatch(col, row, col + 1, row)) return true;
        if (row < BOARD_ROWS - 1 && this.wouldMatch(col, row, col, row + 1)) return true;
      }
    }
    return false;
  }

  private wouldMatch(c1: number, r1: number, c2: number, r2: number): boolean {
    const grid = this.grid;
    const tA = grid[r1][c1], tB = grid[r2][c2];
    if (!tA || !tB) return false;

    // Temporarily swap
    grid[r1][c1] = tB; grid[r2][c2] = tA;
    tA.updateGridPosition(c2, r2); tB.updateGridPosition(c1, r1);

    const matches = this.findAllMatches();

    // Swap back
    grid[r1][c1] = tA; grid[r2][c2] = tB;
    tA.updateGridPosition(c1, r1); tB.updateGridPosition(c2, r2);

    return matches.length > 0;
  }

  setInteractive(enabled: boolean): void {
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const tile = this.grid[row][col];
        if (tile) {
          enabled ? tile.setInteractive() : tile.disableInteractive();
        }
      }
    }
  }

  destroy(): void {
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        this.grid[row][col]?.destroy();
        this.grid[row][col] = null;
      }
    }
  }
}
