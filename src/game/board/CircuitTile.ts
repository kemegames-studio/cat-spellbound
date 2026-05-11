// ─────────────────────────────────────────────────────────────────────────────
// CircuitTile.ts
//
// Charge Up themed tile — extends Tile with:
//   • ComponentType vocabulary (capacitor / resistor / transistor / relay / diode)
//   • `overloaded` state  (= cursed analogue)
//   • `grounded` state    (= sleeping/locked analogue)
//   • `shorted` flash     (visual after a large chain)
//   • Graceful texture fallback: renders a coloured rounded rect if
//     tile_capacitor / tile_resistor etc. aren't loaded yet.
//
// IMPORTANT: CircuitTile deliberately does NOT replace Tile in the current
// cat-spellbound GameScene — both classes coexist.
//
// Phase 0 (rename pass) will update Board to construct CircuitTile instead
// of Tile, and GameScene's imports will switch to ComponentType.
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { TILE_SIZE } from '../../config/Constants';
import { Tile } from './Tile';
import { TweenHelpers } from './TileAnimations';
import { ComponentType, COMPONENT_COLORS, TileState } from './ComponentTypes';

// Re-export TileType for backward-compat in the transition period
export { ComponentType };

export class CircuitTile extends Tile {
  // ── Charge Up specific state ──────────────────────────────────────────────
  public componentType:  ComponentType;
  public overloaded:     boolean = false;  // cursed analogue
  public grounded:       boolean = false;  // locked/sleeping analogue
  public tileState:      TileState = 'idle';

  // ── Internal visuals ─────────────────────────────────────────────────────
  private overloadGlow!: Phaser.GameObjects.Graphics;
  private shortedFlash!: Phaser.GameObjects.Graphics;
  private fallbackRect!: Phaser.GameObjects.Graphics | null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    type: ComponentType,
    col: number,
    row: number,
  ) {
    // Map ComponentType → TileType so the Tile base builds its visual.
    // If the circuit texture exists ('tile_capacitor' etc.) we'll override;
    // if not, Tile will load 'tile_star' / 'tile_potion' etc. (dev fallback).
    super(scene, x, y, CircuitTile.mapToTileType(type), col, row);

    this.componentType = type;

    // Replace base texture with circuit variant if it's loaded
    if (scene.textures.exists(`tile_${type}`)) {
      this.baseImage?.setTexture(`tile_${type}`);
    } else {
      // No circuit asset yet — overlay a coloured rounded rect
      this.buildFallbackVisual(scene, type);
    }

    // Add Charge Up extra layers
    this.buildOverloadGlow(scene, type);
    this.buildShortedFlash(scene);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Mark tile as overloaded (visual corruption effect). */
  applyOverload(): void {
    if (this.overloaded) return;
    this.overloaded = true;
    this.tileState  = 'overloaded';

    this.overloadGlow.setVisible(true);
    this.baseImage?.setTint(0xaa3333);

    // Alpha flash using TweenHelpers
    TweenHelpers.squashStretch(this.scene, this, 0.88, 1.12, 180);
    TweenHelpers.fadeTo(this.scene, this, 0.80, 150, 'Power2', 0, () => {
      TweenHelpers.fadeTo(this.scene, this, 1.0, 150, 'Power2');
    });
  }

  /** Clear overload state and restore normal visual. */
  clearOverload(): void {
    this.overloaded = false;
    this.tileState  = 'idle';
    this.overloadGlow.setVisible(false);
    this.baseImage?.clearTint();
    this.setAlpha(1);
  }

  /** Lock tile so it cannot be swapped (grounded state). */
  applyGround(): void {
    this.grounded  = true;
    this.tileState = 'grounded';
    this.disableInteractive();
    TweenHelpers.fadeTo(this.scene, this, 0.55, 200);
    this.baseImage?.setTint(0x4499cc);
  }

  /** Release ground lock. */
  clearGround(): void {
    this.grounded  = false;
    this.tileState = 'idle';
    this.setInteractive();
    TweenHelpers.fadeTo(this.scene, this, 1.0, 200);
    this.baseImage?.clearTint();
  }

  /**
   * Flash the tile after it participates in a chain of 4+ tiles.
   * Duration matches ANIM.tileDestroy so the flash coincides with the
   * match burst particle.
   */
  playShortedFlash(): void {
    this.shortedFlash.setVisible(true).setAlpha(1);
    TweenHelpers.fadeTo(
      this.scene, this.shortedFlash,
      0, 190, 'Power2', 0,
      () => this.shortedFlash.setVisible(false).setAlpha(1),
    );
  }

  /** Returns the circuit component's primary hex colour. */
  getComponentColor(): number {
    return COMPONENT_COLORS[this.componentType];
  }

  // Override Tile.getColor() so effects use component colour
  override getColor(): number {
    return this.getComponentColor();
  }

  // ── Private builders ──────────────────────────────────────────────────────

  /**
   * Coloured rounded-rect fallback used when the circuit PNG textures
   * have not been loaded yet (Phase 1 / dev builds).
   */
  private buildFallbackVisual(scene: Phaser.Scene, type: ComponentType): void {
    const color = COMPONENT_COLORS[type];
    const g = scene.add.graphics();
    g.fillStyle(color, 0.85);
    g.fillRoundedRect(
      -TILE_SIZE / 2 + 3,
      -TILE_SIZE / 2 + 3,
      TILE_SIZE - 6,
      TILE_SIZE - 6,
      10,
    );
    g.lineStyle(2, 0xffffff, 0.25);
    g.strokeRoundedRect(
      -TILE_SIZE / 2 + 3,
      -TILE_SIZE / 2 + 3,
      TILE_SIZE - 6,
      TILE_SIZE - 6,
      10,
    );
    this.fallbackRect = g;
    this.add(g);                   // on top of baseImage
  }

  /** Red-orange overload glow ring, hidden by default. */
  private buildOverloadGlow(scene: Phaser.Scene, type: ComponentType): void {
    this.overloadGlow = scene.add.graphics();
    this.overloadGlow.lineStyle(3, 0xff2200, 0.9);
    this.overloadGlow.strokeRoundedRect(
      -TILE_SIZE / 2 - 4,
      -TILE_SIZE / 2 - 4,
      TILE_SIZE + 8,
      TILE_SIZE + 8,
      14,
    );
    this.overloadGlow.setVisible(false);
    this.add(this.overloadGlow);
  }

  /** Bright white flash overlay for the "shorted" chain effect. */
  private buildShortedFlash(scene: Phaser.Scene): void {
    this.shortedFlash = scene.add.graphics();
    this.shortedFlash.fillStyle(0xffffff, 0.65);
    this.shortedFlash.fillRoundedRect(
      -TILE_SIZE / 2,
      -TILE_SIZE / 2,
      TILE_SIZE,
      TILE_SIZE,
      10,
    );
    this.shortedFlash.setVisible(false);
    this.add(this.shortedFlash);
  }

  // ── Static helpers ────────────────────────────────────────────────────────

  /**
   * Maps ComponentType → TileType so the Tile base constructor can load
   * its fallback cat-spellbound texture while circuit assets are missing.
   * Removed in Phase 0 once all textures are replaced.
   */
  private static mapToTileType(type: ComponentType): import('./TileTypes').TileType {
    const map: Record<ComponentType, import('./TileTypes').TileType> = {
      capacitor:  'star',
      resistor:   'book',
      transistor: 'gem',
      relay:      'potion',
      diode:      'crystal',
    };
    return map[type];
  }

  // ── Destroy ───────────────────────────────────────────────────────────────

  override destroy(fromScene?: boolean): void {
    this.fallbackRect?.destroy();
    super.destroy(fromScene);
  }
}
