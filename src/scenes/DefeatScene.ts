// ─────────────────────────────────────────────────────────────────────────────
// DefeatScene.ts
//
// Full-screen defeat / game-over screen — the symmetric counterpart to
// VictoryScene.  Receives levelId and score from GameScene, shows a polished
// out-of-moves panel with animated score count-up, and gives the player two
// options:
//
//   TRY AGAIN  →  restart the same level (GameScene)
//   QUIT       →  return to HomeScene
//
// Keeping defeat as a dedicated scene (vs inline overlay in GameScene) means:
//   • Camera fades into a fresh, clean scene — no leftover board state.
//   • Scene is composable: future "watch an ad to keep playing" flow plugs in
//     here without touching GameScene.
//   • Retry loop is a standard scene.start(SCENE.Game) call.
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { PALETTE, GAME_WIDTH, GAME_HEIGHT, DEPTHS } from '../config/Constants';
import { SCENE }            from './SceneKeys';
import { SceneNavigator }   from './SceneNavigator';
import { SceneDebug }       from './SceneDebug';
import { TRANSITION }       from './TransitionConfig';
import { FONT }             from '../ui/UIStyle';

// ── Panel geometry ─────────────────────────────────────────────────────────

const PANEL_W  = 300;
const PANEL_H  = 340;
const PANEL_CX = GAME_WIDTH  / 2;
const PANEL_CY = GAME_HEIGHT / 2 - 20;
const PR       = 22;   // border radius

// ══════════════════════════════════════════════════════════════════════════════
// DefeatScene
// ══════════════════════════════════════════════════════════════════════════════

interface DefeatData {
  levelId: number;
  score:   number;
}

export class DefeatScene extends Phaser.Scene {
  private levelId = 1;
  private score   = 0;
  private dbg!:   SceneDebug;

  constructor() { super({ key: SCENE.Defeat }); }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  init(data: DefeatData): void {
    this.levelId = data?.levelId ?? 1;
    this.score   = data?.score   ?? 0;
  }

  create(): void {
    this.dbg = SceneDebug.attach(this);
    this.dbg.setState('defeat');

    SceneNavigator.fadeIn(this, TRANSITION.defeat.fadeIn);

    this.buildBackground();
    this.buildPanel();
    this.buildButtons();
    this.buildAmbientParticles();
  }

  // ── Background ─────────────────────────────────────────────────────────────

  private buildBackground(): void {
    const bg = this.add.graphics().setDepth(DEPTHS.bg);

    // Near-black base with a deep-red tint
    bg.fillStyle(0x06010f, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Soft radial vignette rings
    for (let i = 0; i < 5; i++) {
      bg.fillStyle(0x300010, 0.06 - i * 0.008);
      bg.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT * 0.4, 280 - i * 35);
    }

    // Atmospheric glow blobs
    bg.fillStyle(0xff2200, 0.055);
    bg.fillCircle(70, 320, 180);
    bg.fillStyle(0xff0044, 0.04);
    bg.fillCircle(330, 170, 140);

    // Faint horizontal scan lines (texture effect)
    for (let y = 0; y < GAME_HEIGHT; y += 6) {
      bg.fillStyle(0x000000, 0.04);
      bg.fillRect(0, y, GAME_WIDTH, 1);
    }
  }

  // ── Panel ──────────────────────────────────────────────────────────────────

  private buildPanel(): void {
    const depth = DEPTHS.overlay;

    // ── Drop-shadow ────────────────────────────────────────────────────────
    const shadow = this.add.graphics().setDepth(depth - 1);
    shadow.fillStyle(0x000000, 0.55);
    shadow.fillRoundedRect(
      PANEL_CX - PANEL_W / 2 + 8, PANEL_CY - PANEL_H / 2 + 10,
      PANEL_W, PANEL_H, PR,
    );

    // ── Panel body ─────────────────────────────────────────────────────────
    const panel = this.add.graphics().setDepth(depth);

    // Outer glow halo
    panel.fillStyle(0xff2200, 0.08);
    panel.fillRoundedRect(
      PANEL_CX - PANEL_W / 2 - 8, PANEL_CY - PANEL_H / 2 - 8,
      PANEL_W + 16, PANEL_H + 16, PR + 4,
    );

    // Main fill
    panel.fillStyle(0x150825, 0.97);
    panel.fillRoundedRect(
      PANEL_CX - PANEL_W / 2, PANEL_CY - PANEL_H / 2,
      PANEL_W, PANEL_H, PR,
    );

    // Red rim
    panel.lineStyle(2.5, 0xff2200, 0.6);
    panel.strokeRoundedRect(
      PANEL_CX - PANEL_W / 2, PANEL_CY - PANEL_H / 2,
      PANEL_W, PANEL_H, PR,
    );

    // Inner purple inset
    panel.lineStyle(1.5, PALETTE.purpleLight, 0.2);
    panel.strokeRoundedRect(
      PANEL_CX - PANEL_W / 2 + 6, PANEL_CY - PANEL_H / 2 + 6,
      PANEL_W - 12, PANEL_H - 12, PR - 4,
    );

    // Shine strip at top
    panel.fillStyle(0xffffff, 0.035);
    panel.fillRoundedRect(
      PANEL_CX - PANEL_W / 2 + 12, PANEL_CY - PANEL_H / 2 + 10,
      PANEL_W - 24, 36, 14,
    );

    // ── Icon (animated bob) ────────────────────────────────────────────────
    const iconY0 = PANEL_CY - PANEL_H / 2 + 58;
    const icon = this.add.text(PANEL_CX, iconY0, '💔', {
      fontSize: '46px',
    }).setOrigin(0.5).setDepth(depth + 1).setAlpha(0);

    this.tweens.add({
      targets:  icon,
      alpha:    1,
      y:        iconY0 - 6,
      duration: 550,
      delay:    80,
      ease:     'Back.easeOut',
    });
    this.tweens.add({
      targets:  icon,
      y:        iconY0 + 3,
      duration: 2200,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
      delay:    650,
    });

    // ── Title ──────────────────────────────────────────────────────────────
    const title = this.add.text(PANEL_CX, PANEL_CY - PANEL_H / 2 + 120, 'Out of Moves!', {
      fontFamily:      FONT.display,
      fontSize:        '26px',
      fontStyle:       'bold',
      color:           '#ff4444',
      stroke:          '#220011',
      strokeThickness: 5,
      shadow:          { offsetX: 0, offsetY: 3, color: '#000000aa', blur: 8, fill: true },
    }).setOrigin(0.5).setDepth(depth + 1).setAlpha(0);

    this.tweens.add({ targets: title, alpha: 1, duration: 380, delay: 220 });

    // ── Divider ────────────────────────────────────────────────────────────
    const div = this.add.graphics().setDepth(depth + 1);
    div.lineStyle(1, PALETTE.purpleLight, 0.25);
    div.lineBetween(
      PANEL_CX - PANEL_W / 2 + 28, PANEL_CY - PANEL_H / 2 + 152,
      PANEL_CX + PANEL_W / 2 - 28, PANEL_CY - PANEL_H / 2 + 152,
    );
    div.setAlpha(0);
    this.tweens.add({ targets: div, alpha: 1, duration: 380, delay: 300 });

    // ── Score display ──────────────────────────────────────────────────────
    const lblY = PANEL_CY - PANEL_H / 2 + 172;

    const scoreLbl = this.add.text(PANEL_CX, lblY, 'SCORE', {
      fontFamily:   FONT.display,
      fontSize:     '11px',
      color:        '#9d6fff',
      letterSpacing: 4,
    }).setOrigin(0.5).setDepth(depth + 1).setAlpha(0);

    const scoreVal = this.add.text(PANEL_CX, lblY + 28, '0', {
      fontFamily:      FONT.display,
      fontSize:        '34px',
      fontStyle:       'bold',
      color:           '#ffd700',
      stroke:          '#440022',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(depth + 1).setAlpha(0);

    this.tweens.add({ targets: [scoreLbl, scoreVal], alpha: 1, duration: 380, delay: 360 });

    // Animated count-up
    const proxy = { v: 0 };
    this.tweens.add({
      targets:    proxy,
      v:          this.score,
      duration:   900,
      delay:      480,
      ease:       'Sine.easeOut',
      onUpdate:   () => scoreVal.setText(Math.round(proxy.v).toLocaleString()),
      onComplete: () => scoreVal.setText(this.score.toLocaleString()),
    });
  }

  // ── Buttons ────────────────────────────────────────────────────────────────

  private buildButtons(): void {
    const depth  = DEPTHS.popup;
    const btn1Y  = PANEL_CY + PANEL_H / 2 - 96;
    const btn2Y  = PANEL_CY + PANEL_H / 2 - 38;

    this.makeBtn(PANEL_CX, btn1Y, 240, 52, '↺  TRY AGAIN', 0x1a7a3a, depth, () => {
      SceneNavigator.fadeTo(this, SCENE.Game, { levelId: this.levelId }, TRANSITION.defeat.fadeOut);
    });

    this.makeBtn(PANEL_CX, btn2Y, 180, 42, '⌂  QUIT', 0x1a1a2e, depth, () => {
      SceneNavigator.fadeTo(this, SCENE.Home, undefined, TRANSITION.defeat.fadeOut);
    });
  }

  private makeBtn(
    cx: number, cy: number,
    w:  number, h:  number,
    label:    string,
    fill:     number,
    depth:    number,
    onTap:    () => void,
  ): void {
    const btn = this.add.container(cx, cy).setDepth(depth);
    btn.setSize(w, h);

    const bg = this.add.graphics();
    bg.fillStyle(fill, 0.92);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    // Top-edge shimmer
    bg.fillStyle(0xffffff, 0.12);
    bg.fillRoundedRect(-w / 2 + 8, -h / 2 + 5, w - 16, h * 0.36, 10);
    // Rim
    bg.lineStyle(1.5, 0xffffff, 0.16);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    btn.add(bg);

    btn.add(this.add.text(0, 1, label, {
      fontFamily:      FONT.display,
      fontSize:        '17px',
      fontStyle:       'bold',
      color:           '#ffffff',
      stroke:          '#00000055',
      strokeThickness: 2,
    }).setOrigin(0.5));

    btn.setInteractive(
      new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
      Phaser.Geom.Rectangle.Contains,
    );

    // Animate in
    btn.setAlpha(0);
    this.tweens.add({ targets: btn, alpha: 1, duration: 300, delay: TRANSITION.defeat.btnReveal });

    // Interactions
    btn.on('pointerdown', () => {
      this.tweens.add({
        targets: btn, scaleX: 0.93, scaleY: 0.93,
        duration: 70, yoyo: true, ease: 'Power2',
        onComplete: onTap,
      });
    });
    btn.on('pointerover',  () => this.tweens.add({ targets: btn, scaleX: 1.06, scaleY: 1.06, duration: 80, ease: 'Back.easeOut' }));
    btn.on('pointerout',   () => this.tweens.add({ targets: btn, scaleX: 1,    scaleY: 1,    duration: 80 }));
  }

  // ── Ambient particles ──────────────────────────────────────────────────────

  private buildAmbientParticles(): void {
    this.add.particles(0, 0, 'particle_orb', {
      x:        { min: 0,               max: GAME_WIDTH },
      y:        { min: GAME_HEIGHT + 10, max: GAME_HEIGHT + 30 },
      speedY:   { min: -38,  max: -16 },
      speedX:   { min: -12,  max: 12  },
      quantity:  1,
      frequency: 900,
      lifespan:  3000,
      scale:    { start: 0.5, end: 0 },
      alpha:    { start: 0.35, end: 0 },
      tint:     [PALETTE.purple, 0xff3333, PALETTE.purplePale],
    }).setDepth(DEPTHS.effects);
  }
}
