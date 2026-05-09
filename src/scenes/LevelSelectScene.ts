import Phaser from 'phaser';
import { PALETTE, GAME_WIDTH, GAME_HEIGHT, DEPTHS } from '../config/Constants';
import { createBottomNav } from '../ui/BottomNav';

// Levels start from 1 — positions match the winding path nodes in ui_levels.png
const LEVEL_NODES: { id: number; x: number; y: number }[] = [
  { id: 1,  x: 150, y: 720 },
  { id: 2,  x: 228, y: 668 },
  { id: 3,  x: 278, y: 608 },
  { id: 4,  x: 155, y: 553 },
  { id: 5,  x: 260, y: 497 },
  { id: 6,  x: 185, y: 442 },
  { id: 7,  x: 295, y: 388 },
  { id: 8,  x: 225, y: 333 },
  { id: 9,  x: 200, y: 278 },
  { id: 10, x: 225, y: 228 },
];

const CURRENT_LEVEL = 1; // only the first level is open in the prototype

export class LevelSelectScene extends Phaser.Scene {
  private autoPlay = false;

  constructor() { super({ key: 'LevelSelectScene' }); }

  init(data: { autoPlay?: boolean }): void {
    this.autoPlay = data?.autoPlay ?? false;
  }

  create(): void {
    this.cameras.main.fadeIn(300, 0, 0, 0);

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ui_levels')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(DEPTHS.bg);

    this.createLevelNodes();
    createBottomNav(this, 'Home', {
      Shop:   'StoreScene',
      Trophy: 'LeaderboardScene',
      Home:   'HomeScene',
    });
    this.createAmbientParticles();

    if (this.autoPlay) {
      this.scheduleAutoPlay();
    }
  }

  private createLevelNodes(): void {
    LEVEL_NODES.forEach(({ id, x, y }) => {
      const isUnlocked = id <= CURRENT_LEVEL;
      const zone = this.add.zone(x, y, 68, 68).setDepth(DEPTHS.ui);

      if (!isUnlocked) return;

      zone.setInteractive({ useHandCursor: true });

      // Gold glow ring over the current/unlocked level
      const glow = this.add.graphics().setDepth(DEPTHS.tiles - 1);
      glow.lineStyle(4, PALETTE.gold, 0.9);
      glow.strokeCircle(x, y, 38);
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.5, to: 1 },
        scaleX: { from: 0.92, to: 1.08 },
        scaleY: { from: 0.92, to: 1.08 },
        duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });

      zone.on('pointerdown', () => this.startLevel(id));
    });
  }

  private startLevel(id: number): void {
    this.cameras.main.flash(150, 80, 40, 160, false);
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () =>
      this.scene.start('GameScene', { levelId: id }),
    );
  }

  private scheduleAutoPlay(): void {
    let count = 3;

    // Dimmed banner behind countdown
    const banner = this.add.graphics().setDepth(DEPTHS.overlay);
    banner.fillStyle(0x000000, 0.55);
    banner.fillRoundedRect(GAME_WIDTH / 2 - 120, GAME_HEIGHT / 2 - 38, 240, 68, 14);

    const countText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 6, `Starting in ${count}…`, {
      fontFamily: 'Georgia, serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(DEPTHS.overlay + 1);

    // Tick down every second
    this.time.addEvent({
      delay: 1000,
      repeat: count - 1,
      callback: () => {
        count--;
        countText.setText(count > 0 ? `Starting in ${count}…` : 'Get Ready!');
      },
    });

    // After 3 seconds launch level 1
    this.time.delayedCall(3000, () => {
      this.tweens.add({
        targets: [banner, countText],
        alpha: 0, duration: 200,
        onComplete: () => {
          banner.destroy();
          countText.destroy();
          this.startLevel(1);
        },
      });
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
