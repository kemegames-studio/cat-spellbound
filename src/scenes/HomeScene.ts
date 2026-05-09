import Phaser from 'phaser';
import { PALETTE, GAME_WIDTH, GAME_HEIGHT, DEPTHS } from '../config/Constants';
import { fillStar } from '../utils/GraphicsUtils';

export class HomeScene extends Phaser.Scene {
  private catWizard!: Phaser.GameObjects.Image;
  private floatingTweens: Phaser.Tweens.Tween[] = [];

  constructor() { super({ key: 'HomeScene' }); }

  create(): void {
    this.createBackground();
    this.createMagicPortal();
    this.createCatWizard();
    this.createTitle();
    this.createPlayButton();
    this.createBottomNav();
    this.createFloatingParticles();
    this.createAmbientSparkles();
  }

  private createBackground(): void {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'bg_home').setDepth(DEPTHS.bg);

    const vignette = this.add.graphics().setDepth(DEPTHS.bg + 1);
    vignette.fillGradientStyle(0x000000, 0x000000, 0x00000000, 0x00000000, 0.6);
    vignette.fillRect(0, 0, GAME_WIDTH, 120);

    const vBottom = this.add.graphics().setDepth(DEPTHS.bg + 1);
    vBottom.fillGradientStyle(0x00000000, 0x00000000, 0x000000, 0x000000, 0.7);
    vBottom.fillRect(0, GAME_HEIGHT - 200, GAME_WIDTH, 200);
  }

  private createMagicPortal(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT * 0.44;

    // Outer glow
    const glow = this.add.graphics().setDepth(DEPTHS.effects);
    glow.fillStyle(PALETTE.green, 0.06);
    glow.fillCircle(cx, cy, 140);
    glow.fillStyle(PALETTE.green, 0.1);
    glow.fillCircle(cx, cy, 100);

    // Portal ring
    const portal = this.add.graphics().setDepth(DEPTHS.effects);
    portal.lineStyle(6, PALETTE.green, 0.85);
    portal.strokeCircle(cx, cy, 110);
    portal.lineStyle(3, 0x00ffcc, 0.5);
    portal.strokeCircle(cx, cy, 120);

    // Stone arch — use arc segments instead of fillArc
    const arch = this.add.graphics().setDepth(DEPTHS.effects - 1);
    arch.lineStyle(10, 0x6655aa, 0.6);
    arch.strokeCircle(cx, cy + 10, 108);

    // Rotate portal ring slowly
    this.tweens.add({
      targets: portal,
      angle: 360,
      duration: 8000,
      repeat: -1,
      ease: 'Linear',
    });

    // Pulse glow
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.6, to: 1 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createCatWizard(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT * 0.42;

    this.catWizard = this.add.image(cx, cy, 'cat_wizard')
      .setDepth(DEPTHS.tiles)
      .setScale(1.6);

    const t = this.tweens.add({
      targets: this.catWizard,
      y: cy - 14,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.floatingTweens.push(t);

    this.time.addEvent({
      delay: 600,
      loop: true,
      callback: this.spawnWandSparkle,
      callbackScope: this,
    });
  }

  private spawnWandSparkle(): void {
    if (!this.catWizard) return;
    const wx = this.catWizard.x + 50;
    const wy = this.catWizard.y - 80;

    const s = this.add.graphics()
      .setDepth(DEPTHS.effects)
      .setPosition(wx + Phaser.Math.Between(-8, 8), wy + Phaser.Math.Between(-8, 8));

    const colors = [PALETTE.gold, PALETTE.purpleLight, PALETTE.green, 0xffffff];
    const col = colors[Phaser.Math.Between(0, colors.length - 1)];
    s.fillStyle(col, 1);
    fillStar(s, 0, 0, 5, 5, 2, 0);

    this.tweens.add({
      targets: s,
      y: s.y - 30,
      alpha: 0,
      scaleX: 0,
      scaleY: 0,
      duration: 700,
      ease: 'Power2',
      onComplete: () => s.destroy(),
    });
  }

  private createTitle(): void {
    this.add.text(GAME_WIDTH / 2, 88, 'Cat', {
      fontFamily: 'Georgia, serif',
      fontSize: '52px',
      color: '#ffd700',
      stroke: '#7b2fff',
      strokeThickness: 6,
      shadow: { offsetX: 0, offsetY: 4, color: '#000000aa', blur: 12, fill: true },
    }).setOrigin(0.5).setDepth(DEPTHS.hud);

    const sb = this.add.text(GAME_WIDTH / 2, 148, 'Spellbound', {
      fontFamily: 'Georgia, serif',
      fontSize: '46px',
      fontStyle: 'bold',
      color: '#ffd700',
      stroke: '#7b2fff',
      strokeThickness: 7,
      shadow: { offsetX: 0, offsetY: 5, color: '#000000aa', blur: 15, fill: true },
    }).setOrigin(0.5).setDepth(DEPTHS.hud);

    // Sparkle decorations
    const leftStar = this.add.graphics().setDepth(DEPTHS.hud);
    leftStar.fillStyle(PALETTE.gold, 0.9);
    fillStar(leftStar, 0, 0, 5, 10, 4, 0);
    leftStar.setPosition(GAME_WIDTH / 2 - 110, 120);

    const rightStar = this.add.graphics().setDepth(DEPTHS.hud);
    rightStar.fillStyle(PALETTE.gold, 0.9);
    fillStar(rightStar, 0, 0, 5, 10, 4, 0);
    rightStar.setPosition(GAME_WIDTH / 2 + 110, 120);

    this.add.text(GAME_WIDTH / 2, 185, '✦ Magic. Mischief. Meowgic! ✦', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      color: '#9d6fff',
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(DEPTHS.hud);

    this.tweens.add({ targets: leftStar,  angle: 360,  duration: 3000, repeat: -1, ease: 'Linear' });
    this.tweens.add({ targets: rightStar, angle: -360, duration: 3500, repeat: -1, ease: 'Linear' });

    this.tweens.add({
      targets: sb,
      scaleX: 1.04,
      scaleY: 1.04,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createPlayButton(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT * 0.72;

    const btnBg = this.add.graphics().setDepth(DEPTHS.ui);
    this.drawPlayBtn(btnBg, cx, cy, false);

    const btnText = this.add.text(cx, cy - 2, 'PLAY', {
      fontFamily: 'Georgia, serif',
      fontSize: '30px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#1a5c2a',
      strokeThickness: 3,
      shadow: { offsetX: 0, offsetY: 3, color: '#00000088', blur: 8, fill: true },
    }).setOrigin(0.5).setDepth(DEPTHS.ui + 1);

    const diamond = this.add.graphics().setDepth(DEPTHS.ui + 1);
    diamond.fillStyle(PALETTE.purpleLight, 1);
    diamond.fillPoints([
      { x: 0, y: -8 }, { x: 6, y: 0 }, { x: 0, y: 8 }, { x: -6, y: 0 },
    ], true);
    diamond.setPosition(cx - 56, cy);

    const zone = this.add.zone(cx, cy, 200, 56).setInteractive().setDepth(DEPTHS.ui + 2);

    zone.on('pointerdown', () => {
      this.tweens.add({
        targets: [btnBg, btnText, diamond],
        scaleX: 0.93,
        scaleY: 0.93,
        duration: 80,
        yoyo: true,
        ease: 'Power2',
        onComplete: () => {
          this.cameras.main.flash(300, 100, 60, 180, false);
          this.time.delayedCall(200, () => this.scene.start('LevelSelectScene'));
        },
      });
    });

    zone.on('pointerover', () => {
      this.tweens.add({ targets: [btnBg, btnText], scaleX: 1.04, scaleY: 1.04, duration: 100, ease: 'Power2' });
    });
    zone.on('pointerout', () => {
      this.tweens.add({ targets: [btnBg, btnText], scaleX: 1, scaleY: 1, duration: 100, ease: 'Power2' });
    });

    this.tweens.add({
      targets: btnBg,
      scaleX: 1.03,
      scaleY: 1.03,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private drawPlayBtn(g: Phaser.GameObjects.Graphics, cx: number, cy: number, pressed: boolean): void {
    const w = 190, h = 54;
    const x = cx - w / 2, y = cy - h / 2 + (pressed ? 3 : 0);

    g.fillStyle(0x00000055, 1);
    g.fillRoundedRect(x + 4, y + 6, w, h, 28);
    g.fillStyle(0x1a6632, 1);
    g.fillRoundedRect(x, y + 5, w, h, 28);
    g.fillStyle(0x2dc653, 1);
    g.fillRoundedRect(x, y, w, h - 4, 28);
    g.fillStyle(0xffffff, 0.2);
    g.fillRoundedRect(x + 10, y + 6, w - 20, h / 2.5, 14);
  }

  private createBottomNav(): void {
    const navY = GAME_HEIGHT - 48;
    const navBg = this.add.graphics().setDepth(DEPTHS.ui);
    navBg.fillStyle(0x110633, 0.96);
    navBg.fillRoundedRect(0, GAME_HEIGHT - 90, GAME_WIDTH, 90, 0);
    navBg.lineStyle(1, PALETTE.purpleLight, 0.3);
    navBg.lineBetween(0, GAME_HEIGHT - 90, GAME_WIDTH, GAME_HEIGHT - 90);

    const items = [
      { label: 'Home',   icon: '🏠', x: GAME_WIDTH * 0.12 },
      { label: 'Cats',   icon: '🐱', x: GAME_WIDTH * 0.37 },
      { label: 'Spells', icon: '📖', x: GAME_WIDTH * 0.62 },
      { label: 'Quests', icon: '🏆', x: GAME_WIDTH * 0.87 },
    ];

    items.forEach(({ label, icon, x }) => {
      this.add.text(x, navY - 22, icon, { fontSize: '22px' }).setOrigin(0.5).setDepth(DEPTHS.hud);
      this.add.text(x, navY + 5, label, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '10px',
        color: label === 'Home' ? '#ffd700' : '#9d6fff',
      }).setOrigin(0.5).setDepth(DEPTHS.hud);

      if (label === 'Home') {
        const dot = this.add.graphics().setDepth(DEPTHS.hud);
        dot.fillStyle(PALETTE.gold, 1);
        dot.fillCircle(x, navY + 18, 3);
      }
    });

    // Coin display
    this.add.image(GAME_WIDTH - 65, 28, 'icon_coin').setDepth(DEPTHS.hud).setScale(0.9);
    this.add.text(GAME_WIDTH - 45, 28, '5,250', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ffd700',
    }).setOrigin(0, 0.5).setDepth(DEPTHS.hud);

    const settings = this.add.text(22, 28, '⚙', { fontSize: '22px' })
      .setOrigin(0.5).setDepth(DEPTHS.hud).setInteractive({ useHandCursor: true });
    settings.on('pointerover', () => settings.setScale(1.1));
    settings.on('pointerout',  () => settings.setScale(1));
  }

  private createFloatingParticles(): void {
    const emitter = this.add.particles(0, 0, 'particle_star', {
      x: { min: 0, max: GAME_WIDTH },
      y: { min: GAME_HEIGHT + 10, max: GAME_HEIGHT + 20 },
      quantity: 1,
      frequency: 400,
      lifespan: 5000,
      speedX: { min: -15, max: 15 },
      speedY: { min: -90, max: -50 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.85, end: 0 },
      tint: [PALETTE.gold, PALETTE.purpleLight, PALETTE.green, 0xffffff],
      rotate: { min: 0, max: 360 },
    });
    emitter.setDepth(DEPTHS.effects);
  }

  private createAmbientSparkles(): void {
    this.time.addEvent({
      delay: 1800,
      loop: true,
      callback: () => {
        const x = Phaser.Math.Between(20, GAME_WIDTH - 20);
        const y = Phaser.Math.Between(200, GAME_HEIGHT - 200);
        const sparkle = this.add.graphics().setDepth(DEPTHS.effects).setPosition(x, y);
        sparkle.fillStyle(PALETTE.gold, 1);
        fillStar(sparkle, 0, 0, 4, 6, 1, 0);

        this.tweens.add({
          targets: sparkle,
          scaleX: { from: 0, to: 1.5 },
          scaleY: { from: 0, to: 1.5 },
          alpha: { from: 1, to: 0 },
          duration: 900,
          ease: 'Power2',
          onComplete: () => sparkle.destroy(),
        });
      },
    });
  }

  shutdown(): void {
    this.floatingTweens.forEach(t => t.destroy());
  }
}
