import Phaser from 'phaser';
import { PALETTE, GAME_WIDTH, GAME_HEIGHT, DEPTHS } from '../config/Constants';

export class HomeScene extends Phaser.Scene {
  constructor() { super({ key: 'HomeScene' }); }

  create(): void {
    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.createBackground();
    this.createInteractiveZones();
    this.createCoinDisplay();
    this.createAmbientParticles();
    this.createWandSparkles();
  }

  private createBackground(): void {
    // Full-screen reference UI image
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ui_home')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(DEPTHS.bg);
  }

  private createInteractiveZones(): void {
    // ── PLAY button zone (over the drawn button in the image) ──────────────
    // Reference position: center x~195, y~625, approximately 190×55
    const playZone = this.add.zone(195, 625, 190, 55)
      .setInteractive({ useHandCursor: true })
      .setDepth(DEPTHS.ui);

    playZone.on('pointerdown', () => {
      this.cameras.main.flash(200, 80, 40, 160, false);
      this.tweens.add({
        targets: playZone,
        scaleX: 0.94, scaleY: 0.94,
        duration: 80, yoyo: true, ease: 'Power2',
        onComplete: () => {
          this.cameras.main.fadeOut(300, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () =>
            this.scene.start('LevelSelectScene'),
          );
        },
      });
    });

    // Subtle pulse highlight over PLAY button so it feels alive
    const playGlow = this.add.graphics().setDepth(DEPTHS.ui - 1);
    playGlow.lineStyle(3, PALETTE.green, 0.6);
    playGlow.strokeRoundedRect(195 - 95, 625 - 27, 190, 54, 27);
    this.tweens.add({
      targets: playGlow,
      alpha: { from: 0.4, to: 1 },
      duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // ── Settings gear (top-left) ──────────────────────────────────────────
    this.add.zone(28, 32, 52, 52)
      .setInteractive({ useHandCursor: true })
      .setDepth(DEPTHS.ui);

    // ── Bottom nav zones ──────────────────────────────────────────────────
    const navItems = [
      { label: 'Home',   x: 48,  scene: null },
      { label: 'Cats',   x: 130, scene: null },
      { label: 'Spells', x: 212, scene: null },
      { label: 'Quests', x: 340, scene: null },
    ] as const;

    navItems.forEach(({ x }) => {
      this.add.zone(x, 812, 72, 80)
        .setInteractive({ useHandCursor: true })
        .setDepth(DEPTHS.ui);
    });
  }

  private createCoinDisplay(): void {
    // Overlay live coin count on top of the drawn coins area (top-right)
    // The reference shows "5,250" coins — render on top so it feels dynamic
    this.add.text(GAME_WIDTH - 44, 28, '5,250', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ffd700',
      stroke: '#4a1484',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(DEPTHS.hud);
  }

  private createAmbientParticles(): void {
    // Gentle upward sparkles to bring the scene to life
    this.add.particles(0, 0, 'particle_star', {
      x: { min: 20, max: GAME_WIDTH - 20 },
      y: { min: GAME_HEIGHT, max: GAME_HEIGHT + 10 },
      quantity: 1,
      frequency: 450,
      lifespan: 4500,
      speedX: { min: -12, max: 12 },
      speedY: { min: -80, max: -45 },
      scale: { start: 0.65, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [PALETTE.gold, 0xffffff, PALETTE.purpleLight, PALETTE.green],
      rotate: { min: 0, max: 360 },
    }).setDepth(DEPTHS.effects);
  }

  private createWandSparkles(): void {
    // The cat's wand area in the image is roughly at (285, 330)
    this.time.addEvent({
      delay: 700,
      loop: true,
      callback: () => {
        const g = this.add.graphics()
          .setDepth(DEPTHS.effects)
          .setPosition(
            285 + Phaser.Math.Between(-12, 12),
            330 + Phaser.Math.Between(-12, 12),
          );
        const cols = [PALETTE.gold, PALETTE.green, 0xffffff, PALETTE.purpleLight];
        g.fillStyle(cols[Phaser.Math.Between(0, 3)], 1);

        // small 4-point star
        const pts = [];
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          const r = i % 2 === 0 ? 5 : 2;
          pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
        }
        g.fillPoints(pts, true);

        this.tweens.add({
          targets: g,
          y: g.y - 32,
          alpha: 0,
          scaleX: 0,
          scaleY: 0,
          duration: 650,
          ease: 'Power2',
          onComplete: () => g.destroy(),
        });
      },
    });
  }
}
