import Phaser from 'phaser';
import { PALETTE, GAME_WIDTH, GAME_HEIGHT, LEVELS, DEPTHS } from '../config/Constants';

const UNLOCKED_LEVELS = 6; // for prototype

// Level node positions matching the winding path in ui_levels.png
const LEVEL_NODES: { id: number; x: number; y: number }[] = [
  { id: 6,  x: 150, y: 720 },
  { id: 7,  x: 228, y: 668 },
  { id: 8,  x: 278, y: 608 },
  { id: 9,  x: 155, y: 553 },
  { id: 10, x: 260, y: 497 },
  { id: 11, x: 185, y: 442 },
  { id: 12, x: 295, y: 388 },
  { id: 13, x: 225, y: 333 },
  { id: 14, x: 200, y: 278 },
  { id: 15, x: 225, y: 228 },
];

export class LevelSelectScene extends Phaser.Scene {
  constructor() { super({ key: 'LevelSelectScene' }); }

  create(): void {
    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ui_levels')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(DEPTHS.bg);

    this.createLevelNodes();
    this.createBottomNavZones();
    this.createAmbientParticles();
  }

  private createLevelNodes(): void {
    LEVEL_NODES.forEach(({ id, x, y }) => {
      const isUnlocked = id <= UNLOCKED_LEVELS;
      const isCurrent  = id === UNLOCKED_LEVELS;

      // Invisible hit zone over each node
      const zone = this.add.zone(x, y, 68, 68)
        .setDepth(DEPTHS.ui);

      if (!isUnlocked) return;

      zone.setInteractive({ useHandCursor: true });

      // Glow ring for current level
      if (isCurrent) {
        const glow = this.add.graphics().setDepth(DEPTHS.tiles - 1);
        glow.lineStyle(4, PALETTE.gold, 0.9);
        glow.strokeCircle(x, y, 38);
        this.tweens.add({
          targets: glow,
          alpha: { from: 0.5, to: 1 },
          scaleX: { from: 0.95, to: 1.05 },
          scaleY: { from: 0.95, to: 1.05 },
          duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
      }

      zone.on('pointerdown', () => {
        this.cameras.main.flash(150, 80, 40, 160, false);
        this.cameras.main.fadeOut(280, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () =>
          this.scene.start('GameScene', { levelId: id }),
        );
      });
    });
  }

  private createBottomNavZones(): void {
    const navItems = [
      { x: 48,  action: () => this.scene.start('StoreScene') },
      { x: 130, action: () => this.scene.start('LeaderboardScene') },
      { x: 195, action: () => this.scene.start('HomeScene') },
      { x: 262, action: null },
      { x: 340, action: null },
    ] as const;

    navItems.forEach(({ x, action }) => {
      const zone = this.add.zone(x, 812, 72, 80)
        .setInteractive({ useHandCursor: !!action })
        .setDepth(DEPTHS.ui);
      if (action) zone.on('pointerdown', action);
    });
  }

  private createAmbientParticles(): void {
    this.add.particles(0, 0, 'particle_star', {
      x: { min: 20, max: GAME_WIDTH - 20 },
      y: { min: GAME_HEIGHT * 0.3, max: GAME_HEIGHT * 0.85 },
      quantity: 1,
      frequency: 700,
      lifespan: 3500,
      speedX: { min: -10, max: 10 },
      speedY: { min: -35, max: -15 },
      scale: { start: 0.55, end: 0 },
      alpha: { start: 0.7, end: 0 },
      tint: [PALETTE.gold, 0xffffff, PALETTE.purpleLight],
    }).setDepth(DEPTHS.effects);
  }
}
