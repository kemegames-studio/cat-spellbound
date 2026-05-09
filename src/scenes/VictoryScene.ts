import Phaser from 'phaser';
import { PALETTE, GAME_WIDTH, GAME_HEIGHT, DEPTHS } from '../config/Constants';
import { fillStar } from '../utils/GraphicsUtils';

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
    this.createBackground();
    this.createFireworks();
    this.createPanel();
    this.createCat();
    this.createStars();
    this.createScoreSection();
    this.createButtons();
    this.createContinuousParticles();
  }

  private createBackground(): void {
    const bg = this.add.graphics().setDepth(DEPTHS.bg);
    bg.fillStyle(0x0d0525, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Radial glow from center
    bg.fillStyle(PALETTE.purple, 0.12);
    bg.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT * 0.4, 220);
    bg.fillStyle(PALETTE.purpleLight, 0.06);
    bg.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT * 0.4, 300);
  }

  private createFireworks(): void {
    const colors = [PALETTE.gold, PALETTE.purpleLight, PALETTE.green, PALETTE.pink, PALETTE.cyan];
    for (let i = 0; i < 8; i++) {
      this.time.delayedCall(i * 250 + 200, () => {
        const x = Phaser.Math.Between(30, GAME_WIDTH - 30);
        const y = Phaser.Math.Between(80, GAME_HEIGHT * 0.6);
        const color = colors[i % colors.length];

        const emitter = this.add.particles(x, y, 'particle_star', {
          speed: { min: 60, max: 200 },
          angle: { min: 0, max: 360 },
          lifespan: 900,
          scale: { start: 1, end: 0 },
          alpha: { start: 1, end: 0 },
          tint: [color, 0xffffff],
          quantity: 18,
          emitting: false,
        });
        emitter.setDepth(DEPTHS.effects);
        emitter.explode(18);
        this.time.delayedCall(1100, () => emitter.destroy());
      });
    }
  }

  private createPanel(): void {
    const cx = GAME_WIDTH / 2;
    const panelY = 100;
    const panelH = 520;

    // Panel background
    const panel = this.add.graphics().setDepth(DEPTHS.ui);
    panel.fillStyle(0x1a0a3a, 0.97);
    panel.fillRoundedRect(cx - 160, panelY, 320, panelH, 24);
    panel.lineStyle(3, PALETTE.gold, 0.9);
    panel.strokeRoundedRect(cx - 160, panelY, 320, panelH, 24);
    panel.lineStyle(1.5, PALETTE.purpleLight, 0.4);
    panel.strokeRoundedRect(cx - 153, panelY + 7, 306, panelH - 14, 20);

    // "LEVEL COMPLETE!" banner
    const banner = this.add.graphics().setDepth(DEPTHS.ui + 1);
    banner.fillStyle(PALETTE.gold, 1);
    banner.fillRoundedRect(cx - 145, panelY - 20, 290, 52, 10);
    banner.lineStyle(3, PALETTE.goldDark, 0.8);
    banner.strokeRoundedRect(cx - 145, panelY - 20, 290, 52, 10);
    banner.fillStyle(0xffffff, 0.15);
    banner.fillRoundedRect(cx - 135, panelY - 13, 270, 22, 6);

    this.add.text(cx, panelY + 6, 'LEVEL COMPLETE!', {
      fontFamily: 'Georgia, serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#1a0a3a',
      stroke: '#ffa500',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(DEPTHS.hud);
  }

  private createCat(): void {
    const cx = GAME_WIDTH / 2;

    const cat = this.add.image(cx, 290, 'cat_wizard')
      .setScale(1.1)
      .setDepth(DEPTHS.tiles);

    // Celebratory bounce
    this.tweens.add({
      targets: cat,
      y: 275,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Sparkle overlay
    this.add.image(cx, 290, 'cat_sparkles')
      .setScale(1.1)
      .setDepth(DEPTHS.tiles + 1)
      .setAlpha(0.7);

    // Continuous wand sparkles
    this.time.addEvent({
      delay: 400,
      loop: true,
      callback: () => {
        const wx = cx + 58;
        const wy = 240;
        const g = this.add.graphics()
          .setDepth(DEPTHS.effects)
          .setPosition(wx + Phaser.Math.Between(-10, 10), wy + Phaser.Math.Between(-10, 10));
        g.fillStyle(PALETTE.gold, 1);
        fillStar(g, 0, 0, 5, 6, 3, 0);
        this.tweens.add({
          targets: g, y: g.y - 35, alpha: 0, duration: 600, ease: 'Power2',
          onComplete: () => g.destroy(),
        });
      },
    });
  }

  private createStars(): void {
    const cx = GAME_WIDTH / 2;
    const starY = 385;
    const starSpacing = 68;

    for (let i = 0; i < 3; i++) {
      const sx = cx + (i - 1) * starSpacing;
      const earned = i < this.stars;
      const key = earned ? 'icon_star' : 'icon_star_empty';
      const scale = i === 1 ? 1.3 : 1.0; // Middle star bigger

      const star = this.add.image(sx, starY + (i === 1 ? -8 : 0), key)
        .setScale(0)
        .setDepth(DEPTHS.hud);

      this.tweens.add({
        targets: star,
        scaleX: scale,
        scaleY: scale,
        duration: 300,
        delay: 600 + i * 180,
        ease: 'Back.easeOut',
      });

      // Earned star sparkle
      if (earned) {
        this.time.delayedCall(600 + i * 180 + 300, () => {
          const emitter = this.add.particles(sx, starY + (i === 1 ? -8 : 0), 'particle_spark', {
            speed: { min: 30, max: 80 },
            angle: { min: 0, max: 360 },
            lifespan: 500,
            scale: { start: 0.6, end: 0 },
            tint: [PALETTE.gold, 0xffffff],
            quantity: 10,
            emitting: false,
          });
          emitter.explode(10);
          this.time.delayedCall(600, () => emitter.destroy());
        });
      }
    }
  }

  private createScoreSection(): void {
    const cx = GAME_WIDTH / 2;

    // Score
    const scoreBg = this.add.graphics().setDepth(DEPTHS.ui);
    scoreBg.fillStyle(PALETTE.bgLight, 0.5);
    scoreBg.fillRoundedRect(cx - 120, 418, 240, 62, 12);
    scoreBg.lineStyle(1, PALETTE.purpleLight, 0.4);
    scoreBg.strokeRoundedRect(cx - 120, 418, 240, 62, 12);

    this.add.text(cx, 432, 'Score:', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#9d6fff',
    }).setOrigin(0.5).setDepth(DEPTHS.hud);

    const scoreDisplay = this.add.text(cx, 458, '0', {
      fontFamily: 'Georgia, serif',
      fontSize: '26px',
      fontStyle: 'bold',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(DEPTHS.hud);

    // Animated score count-up
    const targetScore = this.score;
    let displayScore = 0;
    const duration = 1200;
    const steps = 40;
    const stepValue = targetScore / steps;
    const stepDelay = duration / steps;
    this.time.addEvent({
      delay: stepDelay,
      repeat: steps - 1,
      callback: () => {
        displayScore = Math.min(displayScore + stepValue, targetScore);
        scoreDisplay.setText(Math.round(displayScore).toLocaleString());
      },
    });

    // Rewards row
    const rewardY = 498;
    const rewardItems = [
      { icon: '🪙', label: '+250', color: '#ffd700' },
      { icon: '⭐', label: '+50 XP', color: '#9d6fff' },
    ];
    rewardItems.forEach((item, i) => {
      const rx = cx - 60 + i * 130;
      this.add.text(rx, rewardY, item.icon, { fontSize: '18px' }).setOrigin(0.5).setDepth(DEPTHS.hud);
      this.add.text(rx, rewardY + 20, item.label, {
        fontFamily: 'Arial', fontSize: '13px', color: item.color, fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(DEPTHS.hud);
    });
  }

  private createButtons(): void {
    const cx = GAME_WIDTH / 2;
    const btnY = 548;

    // NEXT LEVEL button
    const nextBg = this.add.graphics().setDepth(DEPTHS.ui + 1);
    nextBg.fillStyle(0x22aa44, 1);
    nextBg.fillRoundedRect(cx - 100, btnY, 200, 52, 26);
    nextBg.lineStyle(3, 0x44ff88, 0.8);
    nextBg.strokeRoundedRect(cx - 100, btnY, 200, 52, 26);
    nextBg.fillStyle(0xffffff, 0.15);
    nextBg.fillRoundedRect(cx - 90, btnY + 6, 180, 20, 12);

    const nextText = this.add.text(cx, btnY + 26, 'NEXT LEVEL', {
      fontFamily: 'Georgia, serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#1a5c2a',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(DEPTHS.hud);

    const nextZone = this.add.zone(cx, btnY + 26, 200, 52)
      .setInteractive({ useHandCursor: true })
      .setDepth(DEPTHS.popup);
    nextZone.on('pointerdown', () => {
      this.tweens.add({
        targets: [nextBg, nextText],
        scaleX: 0.93, scaleY: 0.93,
        duration: 80, yoyo: true, ease: 'Power2',
        onComplete: () => {
          this.cameras.main.fadeOut(300, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () => {
            const nextLevel = Math.min(this.levelId + 1, 12);
            this.scene.start('GameScene', { levelId: nextLevel });
          });
        },
      });
    });
    nextZone.on('pointerover', () => this.tweens.add({ targets: [nextBg, nextText], scaleX: 1.04, scaleY: 1.04, duration: 80 }));
    nextZone.on('pointerout',  () => this.tweens.add({ targets: [nextBg, nextText], scaleX: 1, scaleY: 1, duration: 80 }));

    // Idle pulse
    this.tweens.add({
      targets: nextBg,
      scaleX: 1.02, scaleY: 1.02,
      duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // REPLAY button
    const replayBg = this.add.graphics().setDepth(DEPTHS.ui + 1);
    replayBg.fillStyle(PALETTE.bgLight, 0.9);
    replayBg.fillRoundedRect(cx - 70, btnY + 62, 140, 40, 20);
    replayBg.lineStyle(2, PALETTE.purpleLight, 0.6);
    replayBg.strokeRoundedRect(cx - 70, btnY + 62, 140, 40, 20);

    const replayText = this.add.text(cx, btnY + 82, '↺  Replay', {
      fontFamily: 'Georgia, serif',
      fontSize: '15px',
      color: '#9d6fff',
    }).setOrigin(0.5).setDepth(DEPTHS.hud);

    this.add.zone(cx, btnY + 82, 140, 40)
      .setInteractive({ useHandCursor: true })
      .setDepth(DEPTHS.popup)
      .on('pointerdown', () => {
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start('GameScene', { levelId: this.levelId });
        });
      });

    // Entrance animations
    const allItems = [nextBg, nextText, replayBg, replayText];
    allItems.forEach(obj => {
      (obj as Phaser.GameObjects.GameObject & { setAlpha: (a: number) => void }).setAlpha?.(0);
    });
    this.tweens.add({
      targets: allItems,
      alpha: 1,
      duration: 400,
      delay: 900,
      ease: 'Power2',
    });
  }

  private createContinuousParticles(): void {
    this.add.particles(0, 0, 'particle_spark', {
      x: { min: 0, max: GAME_WIDTH },
      y: { min: GAME_HEIGHT + 5, max: GAME_HEIGHT + 15 },
      speedY: { min: -130, max: -70 },
      speedX: { min: -20, max: 20 },
      quantity: 1,
      frequency: 300,
      lifespan: 2500,
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [PALETTE.gold, 0xffffff, PALETTE.purpleLight, PALETTE.green],
      rotate: { min: 0, max: 360 },
    }).setDepth(DEPTHS.effects);
  }
}
