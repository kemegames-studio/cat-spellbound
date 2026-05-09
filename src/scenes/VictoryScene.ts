import Phaser from 'phaser';
import { PALETTE, GAME_WIDTH, GAME_HEIGHT, DEPTHS } from '../config/Constants';

export class VictoryScene extends Phaser.Scene {
  private levelId: number = 1;
  private score: number = 0;
  private stars: number = 3;

  constructor() { super({ key: 'VictoryScene' }); }

  init(data: { levelId: number; score: number; stars: number }): void {
    this.levelId = data.levelId ?? 1;
    this.score   = data.score   ?? 0;
    this.stars   = data.stars   ?? 3;
  }

  create(): void {
    this.cameras.main.fadeIn(400, 0, 0, 0);

    // Full-screen reference image
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ui_victory')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(DEPTHS.bg);

    this.createFireworks();
    this.createScoreOverlay();
    this.createButtonZones();
    this.createContinuousParticles();
  }

  private createFireworks(): void {
    const colors = [PALETTE.gold, PALETTE.purpleLight, PALETTE.green, PALETTE.pink, PALETTE.cyan];
    for (let i = 0; i < 10; i++) {
      this.time.delayedCall(i * 220 + 150, () => {
        const x = Phaser.Math.Between(20, GAME_WIDTH - 20);
        const y = Phaser.Math.Between(60, GAME_HEIGHT * 0.55);
        const emitter = this.add.particles(x, y, 'particle_star', {
          speed: { min: 55, max: 180 },
          angle: { min: 0, max: 360 },
          lifespan: 850,
          scale: { start: 0.9, end: 0 },
          alpha: { start: 1, end: 0 },
          tint: [colors[i % colors.length], 0xffffff],
          quantity: 16,
          emitting: false,
        }).setDepth(DEPTHS.effects);
        emitter.explode(16);
        this.time.delayedCall(1000, () => emitter.destroy());
      });
    }
  }

  private createScoreOverlay(): void {
    const cx = GAME_WIDTH / 2;

    // Animated score count-up overlaid on the image's score area (y≈530)
    const scoreDisplay = this.add.text(cx, 530, '0', {
      fontFamily: 'Georgia, serif',
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#2a1a5e',
      stroke: '#ffffff',
      strokeThickness: 1,
    }).setOrigin(0.5).setDepth(DEPTHS.hud).setAlpha(0);

    // Fade in score text with the panel
    this.tweens.add({ targets: scoreDisplay, alpha: 1, duration: 300, delay: 400 });

    // Animate count-up
    const targetScore = this.score;
    let displayScore = 0;
    const steps = 40;
    const stepValue = targetScore / steps;
    this.time.addEvent({
      delay: 30,
      repeat: steps - 1,
      startAt: 400,
      callback: () => {
        displayScore = Math.min(displayScore + stepValue, targetScore);
        scoreDisplay.setText(displayScore.toLocaleString('en-US', { maximumFractionDigits: 0 }));
      },
    });

    // Star pop-in animations (stars visible in the image at y≈280–300)
    const starPositions = [
      { x: cx - 68, y: 285, delay: 600 },
      { x: cx,      y: 260, delay: 780 },
      { x: cx + 68, y: 285, delay: 960 },
    ];
    starPositions.forEach(({ x, y, delay }, i) => {
      const earned = i < this.stars;
      if (!earned) return;
      // Star burst when earned
      this.time.delayedCall(delay, () => {
        const emitter = this.add.particles(x, y, 'particle_spark', {
          speed: { min: 25, max: 70 },
          angle: { min: 0, max: 360 },
          lifespan: 500,
          scale: { start: 0.7, end: 0 },
          tint: [PALETTE.gold, 0xffffff],
          quantity: 12,
          emitting: false,
        }).setDepth(DEPTHS.effects);
        emitter.explode(12);
        this.time.delayedCall(600, () => emitter.destroy());
      });
    });
  }

  private createButtonZones(): void {
    const cx = GAME_WIDTH / 2;

    // NEXT LEVEL — green button in image at ~y=618, width≈280, height≈58
    const nextZone = this.add.zone(cx, 618, 280, 58)
      .setInteractive({ useHandCursor: true })
      .setDepth(DEPTHS.popup);
    nextZone.on('pointerdown', () => {
      this.cameras.main.flash(150, 40, 180, 80, false);
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('GameScene', { levelId: Math.min(this.levelId + 1, 12) });
      });
    });

    // REPLAY — lighter button at ~y=672, width≈200, height≈42
    this.add.zone(cx, 672, 200, 42)
      .setInteractive({ useHandCursor: true })
      .setDepth(DEPTHS.popup)
      .on('pointerdown', () => {
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () =>
          this.scene.start('GameScene', { levelId: this.levelId }),
        );
      });
  }

  private createContinuousParticles(): void {
    this.add.particles(0, 0, 'particle_spark', {
      x: { min: 0, max: GAME_WIDTH },
      y: { min: GAME_HEIGHT + 5, max: GAME_HEIGHT + 15 },
      speedY: { min: -120, max: -60 },
      speedX: { min: -18, max: 18 },
      quantity: 1,
      frequency: 320,
      lifespan: 2400,
      scale: { start: 0.65, end: 0 },
      alpha: { start: 0.85, end: 0 },
      tint: [PALETTE.gold, 0xffffff, PALETTE.purpleLight, PALETTE.green],
      rotate: { min: 0, max: 360 },
    }).setDepth(DEPTHS.effects);
  }
}
