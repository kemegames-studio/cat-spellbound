// ─────────────────────────────────────────────────────────────────────────────
// VictoryScene.ts
//
// Level-complete screen.
//
// Receives:  { levelId, score, stars }  from GameScene via scene data.
//
// Displays:
//   • Full-screen ui_victory.jpg reference image
//   • Animated score count-up overlaid on the image's score area
//   • Star burst particles on earned stars
//   • Fireworks: staggered particle explosions across the top half
//   • Continuous rising sparkle ambiance
//
// Actions:
//   NEXT LEVEL → GameScene (levelId + 1, capped at last level)
//   REPLAY     → GameScene (same levelId)
//
// Navigation uses SceneNavigator so timings are centralised and the
// double-tap guard fires automatically.
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { PALETTE, GAME_WIDTH, GAME_HEIGHT, DEPTHS, LEVELS } from '../config/Constants';
import { SCENE }          from './SceneKeys';
import { SceneNavigator } from './SceneNavigator';
import { SceneDebug }     from './SceneDebug';
import { TRANSITION }     from './TransitionConfig';

// ── Data shape received from GameScene ───────────────────────────────────────

interface VictoryData {
  levelId:     number;
  score:       number;
  stars:       number;
  sessionData?: unknown;
}

// ══════════════════════════════════════════════════════════════════════════════
// VictoryScene
// ══════════════════════════════════════════════════════════════════════════════

export class VictoryScene extends Phaser.Scene {
  private levelId = 1;
  private score   = 0;
  private stars   = 3;
  private dbg!:   SceneDebug;

  constructor() { super({ key: SCENE.Victory }); }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  init(data: VictoryData): void {
    this.levelId = data?.levelId ?? 1;
    this.score   = data?.score   ?? 0;
    this.stars   = data?.stars   ?? 3;
  }

  create(): void {
    this.dbg = SceneDebug.attach(this);
    this.dbg.setState('victory');

    SceneNavigator.fadeIn(this, TRANSITION.victory.fadeIn);

    // Full-screen reference image
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ui_victory')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(DEPTHS.bg);

    this.createFireworks();
    this.createScoreOverlay();
    this.createButtonZones();
    this.createContinuousParticles();
  }

  // ── Fireworks ─────────────────────────────────────────────────────────────

  private createFireworks(): void {
    const colors = [
      PALETTE.gold, PALETTE.purpleLight,
      PALETTE.green, PALETTE.pink, PALETTE.cyan,
    ];

    for (let i = 0; i < 10; i++) {
      this.time.delayedCall(i * 220 + 150, () => {
        const x = Phaser.Math.Between(20, GAME_WIDTH - 20);
        const y = Phaser.Math.Between(60, GAME_HEIGHT * 0.55);

        const emitter = this.add.particles(x, y, 'particle_star', {
          speed:    { min: 55, max: 180 },
          angle:    { min: 0,  max: 360 },
          lifespan: 850,
          scale:   { start: 0.9, end: 0 },
          alpha:   { start: 1,   end: 0 },
          tint:    [colors[i % colors.length]!, 0xffffff],
          quantity: 16,
          emitting: false,
        }).setDepth(DEPTHS.effects);

        emitter.explode(16);
        this.time.delayedCall(1000, () => emitter.destroy());
      });
    }
  }

  // ── Score overlay ─────────────────────────────────────────────────────────

  private createScoreOverlay(): void {
    const cx = GAME_WIDTH / 2;

    // Animated count-up at the image's score position (≈ y 530)
    const scoreDisplay = this.add.text(cx, 530, '0', {
      fontFamily:      'Georgia, serif',
      fontSize:        '28px',
      fontStyle:       'bold',
      color:           '#2a1a5e',
      stroke:          '#ffffff',
      strokeThickness: 1,
    }).setOrigin(0.5).setDepth(DEPTHS.hud).setAlpha(0);

    this.tweens.add({ targets: scoreDisplay, alpha: 1, duration: 300, delay: 400 });

    // Count-up animation
    const proxy = { v: 0 };
    this.tweens.add({
      targets:    proxy,
      v:          this.score,
      duration:   1100,
      delay:      500,
      ease:       'Sine.easeOut',
      onUpdate:   () => scoreDisplay.setText(Math.round(proxy.v).toLocaleString()),
      onComplete: () => scoreDisplay.setText(this.score.toLocaleString()),
    });

    // Star burst particles on earned stars (positioned over image stars ≈ y 280–300)
    const starPositions = [
      { x: cx - 68, y: 285, delay: 600 },
      { x: cx,      y: 260, delay: 780 },
      { x: cx + 68, y: 285, delay: 960 },
    ];

    starPositions.forEach(({ x, y, delay }, i) => {
      if (i >= this.stars) return;
      this.time.delayedCall(delay, () => {
        const emitter = this.add.particles(x, y, 'particle_spark', {
          speed:    { min: 25, max: 70 },
          angle:    { min: 0,  max: 360 },
          lifespan: 500,
          scale:   { start: 0.7, end: 0 },
          tint:    [PALETTE.gold, 0xffffff],
          quantity: 12,
          emitting: false,
        }).setDepth(DEPTHS.effects);
        emitter.explode(12);
        this.time.delayedCall(600, () => emitter.destroy());
      });
    });
  }

  // ── Interactive button zones ──────────────────────────────────────────────

  private createButtonZones(): void {
    const cx          = GAME_WIDTH / 2;
    const maxLevelId  = LEVELS[LEVELS.length - 1]!.id;

    // NEXT LEVEL — green button at ≈ y 618 in the reference image
    const nextZone = this.add.zone(cx, 618, 280, 58)
      .setInteractive({ useHandCursor: true })
      .setDepth(DEPTHS.popup);

    nextZone.on('pointerdown', () => {
      this.cameras.main.flash(TRANSITION.victory.nextLevelFlash, 40, 180, 80, false);
      SceneNavigator.fadeTo(this, SCENE.Game, {
        levelId: Math.min(this.levelId + 1, maxLevelId),
      }, TRANSITION.victory.fadeOut);
    });

    // REPLAY — lighter button at ≈ y 672
    this.add.zone(cx, 672, 200, 42)
      .setInteractive({ useHandCursor: true })
      .setDepth(DEPTHS.popup)
      .on('pointerdown', () => {
        SceneNavigator.fadeTo(this, SCENE.Game, {
          levelId: this.levelId,
        }, TRANSITION.victory.fadeOut);
      });

    // QUIT TO HOME (back arrow / home icon — optional, not in base image)
    // Uncomment and position when a back button is added to the image:
    // this.add.zone(28, 38, 52, 52).setInteractive({ useHandCursor: true })
    //   .on('pointerdown', () => SceneNavigator.fadeTo(this, SCENE.Home));
  }

  // ── Continuous rising sparkles ────────────────────────────────────────────

  private createContinuousParticles(): void {
    this.add.particles(0, 0, 'particle_spark', {
      x:         { min: 0,               max: GAME_WIDTH       },
      y:         { min: GAME_HEIGHT + 5,  max: GAME_HEIGHT + 15 },
      speedY:    { min: -120, max: -60 },
      speedX:    { min: -18,  max: 18  },
      quantity:   1,
      frequency:  320,
      lifespan:   2400,
      scale:     { start: 0.65, end: 0 },
      alpha:     { start: 0.85, end: 0 },
      tint:      [PALETTE.gold, 0xffffff, PALETTE.purpleLight, PALETTE.green],
      rotate:    { min: 0, max: 360 },
    }).setDepth(DEPTHS.effects);
  }
}
