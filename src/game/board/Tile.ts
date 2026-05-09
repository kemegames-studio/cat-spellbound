import Phaser from 'phaser';
import { PALETTE, TILE_SIZE, TILE_COLORS, ANIM } from '../../config/Constants';
import { TileType } from './TileTypes';

export class Tile extends Phaser.GameObjects.Container {
  public tileType: TileType;
  public gridCol: number;
  public gridRow: number;
  public cursed: boolean = false;
  public sleeping: boolean = false;
  public isPortal: boolean = false;
  public isMatched: boolean = false;
  public isSelected: boolean = false;
  public isFalling: boolean = false;

  public baseImage!: Phaser.GameObjects.Image;
  private glowCircle!: Phaser.GameObjects.Graphics;
  private selectionRing!: Phaser.GameObjects.Graphics;
  private shineGraphic!: Phaser.GameObjects.Graphics;
  private idleTween: Phaser.Tweens.Tween | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    type: TileType,
    col: number,
    row: number,
  ) {
    super(scene, x, y);
    this.tileType = type;
    this.gridCol = col;
    this.gridRow = row;

    this.buildVisual(scene, type);
    scene.add.existing(this);
  }

  private buildVisual(scene: Phaser.Scene, type: TileType): void {
    // Glow behind tile
    this.glowCircle = scene.add.graphics();
    const color = TILE_COLORS[type];
    this.glowCircle.fillStyle(color, 0.18);
    this.glowCircle.fillCircle(TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE * 0.55);
    this.glowCircle.setPosition(-TILE_SIZE / 2, -TILE_SIZE / 2);
    this.add(this.glowCircle);

    // Main tile image
    this.baseImage = scene.add.image(0, 0, `tile_${type}`);
    this.add(this.baseImage);

    // Selection ring (hidden by default)
    this.selectionRing = scene.add.graphics();
    this.selectionRing.lineStyle(3, PALETTE.gold, 1);
    this.selectionRing.strokeRoundedRect(
      -TILE_SIZE / 2 - 3, -TILE_SIZE / 2 - 3,
      TILE_SIZE + 6, TILE_SIZE + 6, 14,
    );
    this.selectionRing.setVisible(false);
    this.add(this.selectionRing);

    // Shine graphic (animated)
    this.shineGraphic = scene.add.graphics();
    this.shineGraphic.fillStyle(0xffffff, 0.35);
    this.shineGraphic.fillEllipse(0, -TILE_SIZE * 0.2, TILE_SIZE * 0.35, TILE_SIZE * 0.15);
    this.shineGraphic.setVisible(false);
    this.add(this.shineGraphic);

    this.setSize(TILE_SIZE, TILE_SIZE);
    this.setInteractive();
  }

  setSelected(selected: boolean): void {
    this.isSelected = selected;
    this.selectionRing.setVisible(selected);

    if (selected) {
      this.scene.tweens.add({
        targets: this,
        scaleX: 1.12,
        scaleY: 1.12,
        duration: 100,
        ease: 'Back.easeOut',
      });
    } else {
      this.scene.tweens.add({
        targets: this,
        scaleX: 1,
        scaleY: 1,
        duration: 100,
        ease: 'Power2',
      });
    }
  }

  playMatchAnimation(onComplete?: () => void): void {
    this.isMatched = true;
    this.stopIdleAnimation();

    // Scale pop then destroy
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.4,
      scaleY: 1.4,
      alpha: 0,
      duration: ANIM.tileDestroy,
      ease: 'Back.easeIn',
      onComplete: () => {
        onComplete?.();
        this.destroy();
      },
    });

    // Emit local glow burst
    this.glowCircle.setAlpha(1);
    this.scene.tweens.add({
      targets: this.glowCircle,
      scaleX: 3,
      scaleY: 3,
      alpha: 0,
      duration: ANIM.tileDestroy + 80,
      ease: 'Power2',
    });
  }

  playFallAnimation(targetY: number, delay: number = 0, onComplete?: () => void): void {
    this.isFalling = true;
    this.stopIdleAnimation();
    this.scene.tweens.add({
      targets: this,
      y: targetY,
      duration: ANIM.tileFall + delay * 0.4,
      delay: delay * 25,
      ease: 'Bounce.easeOut',
      onComplete: () => {
        this.isFalling = false;
        onComplete?.();
        this.playLandBounce();
        this.startIdleAnimation();
      },
    });
  }

  private playLandBounce(): void {
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.08,
      scaleY: 0.93,
      duration: 80,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  playSwapAnimation(targetX: number, targetY: number, onComplete?: () => void): void {
    this.scene.tweens.add({
      targets: this,
      x: targetX,
      y: targetY,
      duration: ANIM.tileSwap,
      ease: 'Power2.easeInOut',
      onComplete: () => onComplete?.(),
    });
  }

  applyCurse(): void {
    this.cursed = true;
    this.baseImage.setTexture(`tile_${this.tileType}_cursed`);
    this.scene.tweens.add({
      targets: this,
      alpha: 0.75,
      duration: 300,
      yoyo: true,
      repeat: 1,
    });
  }

  startIdleAnimation(): void {
    // Gentle idle float
    const offsetY = Phaser.Math.Between(-3, 3);
    const dur = Phaser.Math.Between(1800, 2800);
    this.idleTween = this.scene.tweens.add({
      targets: this,
      y: this.y + offsetY,
      duration: dur,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  stopIdleAnimation(): void {
    this.idleTween?.stop();
    this.idleTween = null;
  }

  playSpawnAnimation(fromY: number): void {
    // Stop idle tween to avoid y-property conflict during spawn
    this.stopIdleAnimation();

    const originalY = this.y;
    this.y = fromY;
    this.setAlpha(0);
    this.setScale(0.5);

    this.scene.tweens.add({
      targets: this,
      y: originalY,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 280,
      ease: 'Back.easeOut',
      onComplete: () => this.startIdleAnimation(),
    });
  }

  updateGridPosition(col: number, row: number): void {
    this.gridCol = col;
    this.gridRow = row;
  }

  getColor(): number {
    return TILE_COLORS[this.tileType];
  }

  override destroy(fromScene?: boolean): void {
    this.stopIdleAnimation();
    super.destroy(fromScene);
  }
}
