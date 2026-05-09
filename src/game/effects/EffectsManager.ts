import Phaser from 'phaser';
import { PALETTE, DEPTHS, GAME_WIDTH, GAME_HEIGHT } from '../../config/Constants';

export class EffectsManager {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // Burst of particles at tile match position
  spawnMatchBurst(x: number, y: number, color: number, matchSize: number): void {
    const count = 8 + matchSize * 4;
    const emitter = this.scene.add.particles(x, y, 'particle_spark', {
      speed: { min: 60, max: 160 + matchSize * 20 },
      angle: { min: 0, max: 360 },
      lifespan: 400 + matchSize * 80,
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [color, 0xffffff, PALETTE.gold],
      quantity: count,
      emitting: false,
    });
    emitter.setDepth(DEPTHS.effects);
    emitter.explode(count);
    this.scene.time.delayedCall(600, () => emitter.destroy());

    // Extra star burst for big matches
    if (matchSize >= 4) {
      const stars = this.scene.add.particles(x, y, 'particle_star', {
        speed: { min: 40, max: 120 },
        angle: { min: 0, max: 360 },
        lifespan: 700,
        scale: { start: 1.2, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [PALETTE.gold, color],
        quantity: 6,
        emitting: false,
      });
      stars.setDepth(DEPTHS.effects + 1);
      stars.explode(6);
      this.scene.time.delayedCall(900, () => stars.destroy());
    }
  }

  spawnSelectBurst(x: number, y: number, color: number): void {
    const emitter = this.scene.add.particles(x, y, 'particle_orb', {
      speed: { min: 30, max: 80 },
      angle: { min: 0, max: 360 },
      lifespan: 350,
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [color, PALETTE.gold],
      quantity: 8,
      emitting: false,
    });
    emitter.setDepth(DEPTHS.effects);
    emitter.explode(8);
    this.scene.time.delayedCall(500, () => emitter.destroy());
  }

  spawnInvalidSwap(x: number, y: number): void {
    const g = this.scene.add.graphics().setDepth(DEPTHS.effects).setPosition(x, y);
    g.lineStyle(3, 0xff3344, 1);
    g.strokeCircle(0, 0, 28);
    g.lineStyle(2, 0xff3344, 0.7);
    g.lineBetween(-10, -10, 10, 10);
    g.lineBetween(10, -10, -10, 10);

    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 400,
      ease: 'Power2',
      onComplete: () => g.destroy(),
    });
  }

  spawnPortalTeleport(x: number, y: number, color: number): void {
    const emitter = this.scene.add.particles(x, y, 'particle_orb', {
      speed: { min: 20, max: 60 },
      angle: { min: 0, max: 360 },
      lifespan: 600,
      scale: { start: 1, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: [PALETTE.green, 0x00ffcc, color],
      quantity: 12,
      emitting: false,
    });
    emitter.setDepth(DEPTHS.effects);
    emitter.explode(12);
    this.scene.time.delayedCall(800, () => emitter.destroy());

    // Ring flash
    const ring = this.scene.add.graphics().setDepth(DEPTHS.effects).setPosition(x, y);
    ring.lineStyle(4, PALETTE.green, 1);
    ring.strokeCircle(0, 0, 24);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 3,
      scaleY: 3,
      alpha: 0,
      duration: 500,
      ease: 'Power2',
      onComplete: () => ring.destroy(),
    });
  }

  screenShake(intensity: number = 6, duration: number = 300): void {
    this.scene.cameras.main.shake(duration, intensity * 0.001);
  }

  screenFlash(color: number = 0xffffff, duration: number = 200, alpha: number = 0.4): void {
    this.scene.cameras.main.flash(duration,
      (color >> 16) & 0xff,
      (color >> 8) & 0xff,
      color & 0xff,
      false,
    );
  }

  spawnComboText(x: number, y: number, comboCount: number): void {
    const labels = ['', '', 'COMBO!', 'AMAZING!', 'INCREDIBLE!', 'MAGICAL!', 'MEOWGIC!!!'];
    const label = labels[Math.min(comboCount, labels.length - 1)] || `${comboCount}× COMBO!`;
    const colors = ['', '', '#ffd700', '#ff8800', '#ff44aa', '#00ff88', '#00eeff'];
    const color = colors[Math.min(comboCount, colors.length - 1)] || '#ffffff';

    const text = this.scene.add.text(x, y, label, {
      fontFamily: 'Georgia, serif',
      fontSize: `${22 + comboCount * 4}px`,
      fontStyle: 'bold',
      color,
      stroke: '#000000',
      strokeThickness: 4,
      shadow: { offsetX: 0, offsetY: 3, color: '#000000aa', blur: 8, fill: true },
    }).setOrigin(0.5).setDepth(DEPTHS.overlay);

    this.scene.tweens.add({
      targets: text,
      y: y - 80,
      scaleX: 1.3,
      scaleY: 1.3,
      alpha: 0,
      duration: 900,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });

    // Burst ring
    const ring = this.scene.add.graphics().setDepth(DEPTHS.overlay - 1).setPosition(x, y);
    ring.fillStyle(PALETTE.gold, 0.15);
    ring.fillCircle(0, 0, 50);
    ring.lineStyle(3, PALETTE.gold, 0.8);
    ring.strokeCircle(0, 0, 50);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 2.5,
      scaleY: 2.5,
      alpha: 0,
      duration: 600,
      ease: 'Power2',
      onComplete: () => ring.destroy(),
    });

    if (comboCount >= 3) this.screenShake(4, 200);
    if (comboCount >= 4) this.screenFlash(PALETTE.gold, 150, 0.3);
  }

  spawnSpellCast(x: number, y: number, color: number, spellName: string): void {
    // Big burst
    const emitter = this.scene.add.particles(x, y, 'particle_flare', {
      speed: { min: 80, max: 300 },
      angle: { min: 0, max: 360 },
      lifespan: 800,
      scale: { start: 1.5, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [color, 0xffffff, PALETTE.gold],
      quantity: 20,
      emitting: false,
    });
    emitter.setDepth(DEPTHS.effects + 2);
    emitter.explode(20);
    this.scene.time.delayedCall(1000, () => emitter.destroy());

    // Ripple rings
    for (let i = 0; i < 3; i++) {
      const ring = this.scene.add.graphics().setDepth(DEPTHS.effects + 1).setPosition(x, y);
      ring.lineStyle(4 - i, color, 1 - i * 0.2);
      ring.strokeCircle(0, 0, 20);

      this.scene.tweens.add({
        targets: ring,
        scaleX: 5 + i * 2,
        scaleY: 5 + i * 2,
        alpha: 0,
        duration: 600 + i * 150,
        delay: i * 120,
        ease: 'Power2',
        onComplete: () => ring.destroy(),
      });
    }

    // Spell name text
    const text = this.scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.38, spellName.toUpperCase(), {
      fontFamily: 'Georgia, serif',
      fontSize: '26px',
      fontStyle: 'bold',
      color: `#${color.toString(16).padStart(6, '0')}`,
      stroke: '#000000',
      strokeThickness: 5,
      shadow: { offsetX: 0, offsetY: 4, color: '#000000aa', blur: 12, fill: true },
    }).setOrigin(0.5).setDepth(DEPTHS.overlay).setAlpha(0);

    this.scene.tweens.add({
      targets: text,
      alpha: 1,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 200,
      ease: 'Back.easeOut',
      yoyo: true,
      hold: 800,
      onComplete: () => text.destroy(),
    });

    this.screenShake(10, 400);
    this.screenFlash(color, 300, 0.35);
  }

  spawnScorePopup(x: number, y: number, points: number): void {
    const text = this.scene.add.text(x, y, `+${points}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(DEPTHS.effects);

    this.scene.tweens.add({
      targets: text,
      y: y - 55,
      alpha: 0,
      duration: 700,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });
  }

  spawnMeteorEffect(targetX: number, targetY: number, color: number): void {
    // Meteor drop from above
    const meteorG = this.scene.add.graphics()
      .setDepth(DEPTHS.effects + 3)
      .setPosition(targetX - 50, -40);

    meteorG.fillStyle(color, 1);
    meteorG.fillCircle(0, 0, 16);
    meteorG.fillStyle(0xff8844, 0.7);
    meteorG.fillTriangle(0, -16, -12, 20, 12, 20);

    // Trail particles
    const trail = this.scene.add.particles(0, 0, 'particle_flare', {
      speed: { min: 5, max: 30 },
      angle: { min: 85, max: 95 },
      lifespan: 250,
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.7, end: 0 },
      tint: [color, 0xff8844],
      follow: meteorG,
    });
    trail.setDepth(DEPTHS.effects + 2);

    this.scene.tweens.add({
      targets: meteorG,
      x: targetX,
      y: targetY,
      duration: 400,
      ease: 'Power2.easeIn',
      onComplete: () => {
        trail.destroy();
        meteorG.destroy();
        this.spawnMatchBurst(targetX, targetY, color, 6);
        this.screenShake(12, 400);
        this.screenFlash(color, 200, 0.4);
      },
    });
  }

  spawnLightningEffect(startX: number, startY: number, endX: number, endY: number): void {
    const g = this.scene.add.graphics().setDepth(DEPTHS.effects + 2);
    g.lineStyle(3, PALETTE.cyan, 1);

    // Jagged lightning
    const segs = 8;
    const points: { x: number; y: number }[] = [{ x: startX, y: startY }];
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      points.push({
        x: Phaser.Math.Linear(startX, endX, t) + Phaser.Math.Between(-15, 15),
        y: Phaser.Math.Linear(startY, endY, t) + Phaser.Math.Between(-15, 15),
      });
    }
    points.push({ x: endX, y: endY });

    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach(p => g.lineTo(p.x, p.y));
    g.strokePath();

    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 350,
      ease: 'Power2',
      onComplete: () => g.destroy(),
    });
  }

  spawnVictoryBurst(cx: number, cy: number): void {
    for (let i = 0; i < 5; i++) {
      this.scene.time.delayedCall(i * 200, () => {
        const angle = (i / 5) * Math.PI * 2;
        const x = cx + Math.cos(angle) * 60;
        const y = cy + Math.sin(angle) * 60;

        const emitter = this.scene.add.particles(x, y, 'particle_star', {
          speed: { min: 80, max: 200 },
          angle: { min: 0, max: 360 },
          lifespan: 1000,
          scale: { start: 1.2, end: 0 },
          alpha: { start: 1, end: 0 },
          tint: [PALETTE.gold, 0xffffff, PALETTE.green, PALETTE.purpleLight],
          quantity: 12,
          emitting: false,
        });
        emitter.setDepth(DEPTHS.overlay);
        emitter.explode(12);
        this.scene.time.delayedCall(1200, () => emitter.destroy());
      });
    }

    this.screenShake(8, 500);
    this.screenFlash(PALETTE.gold, 400, 0.5);
  }
}
