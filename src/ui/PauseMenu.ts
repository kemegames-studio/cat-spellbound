// ─────────────────────────────────────────────────────────────────────────────
// PauseMenu.ts
//
// Full-screen pause overlay with animated panel.
//
// Design:
//   • Frosted-glass style background (dark vignette overlay)
//   • Panel slides down from slightly above center
//   • Buttons with shimmer highlight + press / hover states
//   • Optional current-score display (pass score to show())
//
// API:
//   show(score?)  — fade in overlay + drop panel in
//   hide(cb?)     — fade out + execute callback when complete
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { PALETTE, GAME_WIDTH, GAME_HEIGHT, DEPTHS } from '../config/Constants';
import { FONT } from './UIStyle';

// ── Layout ────────────────────────────────────────────────────────────────────

const PANEL_W   = 280;
const PANEL_H   = 360;
const PANEL_CX  = GAME_WIDTH  / 2;
const PANEL_CY  = GAME_HEIGHT / 2 + 10;
const BTN_W     = 220;
const BTN_H     = 52;

// Button definitions: [y-offset from panel center, label, fill-color]
const BUTTONS: Array<[number, string, number]> = [
  [ -20,  '▶  RESUME',   0x1a7a3a ],
  [  48,  '↺  RESTART',  PALETTE.purple ],
  [ 116,  '⌂  QUIT',     0x1a1a2e ],
];

// ══════════════════════════════════════════════════════════════════════════════
// PauseMenu
// ══════════════════════════════════════════════════════════════════════════════

export class PauseMenu {
  private scene:     Phaser.Scene;
  private overlay!:  Phaser.GameObjects.Graphics;
  private panel!:    Phaser.GameObjects.Container;
  private scoreText: Phaser.GameObjects.Text | null = null;
  private isVisible = false;

  private onResume:  () => void;
  private onRestart: () => void;
  private onQuit:    () => void;

  constructor(
    scene:     Phaser.Scene,
    onResume:  () => void,
    onRestart: () => void,
    onQuit:    () => void,
  ) {
    this.scene     = scene;
    this.onResume  = onResume;
    this.onRestart = onRestart;
    this.onQuit    = onQuit;
    this.build();
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  private build(): void {
    this.buildOverlay();
    this.buildPanel();
    this.setVisible(false);
  }

  private buildOverlay(): void {
    const g = this.scene.add.graphics().setDepth(DEPTHS.overlay);

    // Base dark fill
    g.fillStyle(0x000000, 0.7);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Top and bottom gradient strips for depth
    for (let i = 0; i < 8; i++) {
      const alpha = 0.04 * (8 - i);
      const h = 24 - i * 2;
      g.fillStyle(PALETTE.bgDeep, alpha);
      g.fillRect(0, i * 3, GAME_WIDTH, h);
      g.fillRect(0, GAME_HEIGHT - i * 3 - h, GAME_WIDTH, h);
    }

    this.overlay = g;
  }

  private buildPanel(): void {
    const panelY = PANEL_CY - PANEL_H / 2;

    this.panel = this.scene.add
      .container(PANEL_CX, PANEL_CY)
      .setDepth(DEPTHS.popup);

    // ── Panel background ────────────────────────────────────────────────────
    const bg = this.scene.add.graphics();

    // Outer glow halo
    bg.fillStyle(PALETTE.purple, 0.1);
    bg.fillRoundedRect(-PANEL_W / 2 - 8, -PANEL_H / 2 - 8, PANEL_W + 16, PANEL_H + 16, 28);

    // Main body
    bg.fillStyle(0x110630, 0.98);
    bg.fillRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 22);

    // Gold rim
    bg.lineStyle(3, PALETTE.gold, 0.75);
    bg.strokeRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 22);

    // Inner purple inset line
    bg.lineStyle(1.5, PALETTE.purpleLight, 0.35);
    bg.strokeRoundedRect(-PANEL_W / 2 + 6, -PANEL_H / 2 + 6, PANEL_W - 12, PANEL_H - 12, 18);

    // Shine highlight at top
    bg.fillStyle(0xffffff, 0.04);
    bg.fillRoundedRect(-PANEL_W / 2 + 10, -PANEL_H / 2 + 8, PANEL_W - 20, 40, 14);

    this.panel.add(bg);

    // ── Icon ────────────────────────────────────────────────────────────────
    const icon = this.scene.add.text(0, -PANEL_H / 2 + 48, '⚡', {
      fontSize: '44px',
    }).setOrigin(0.5);
    // Subtle idle bob
    this.scene.tweens.add({
      targets: icon, y: icon.y + 5,
      duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    this.panel.add(icon);

    // ── Title ───────────────────────────────────────────────────────────────
    const title = this.scene.add.text(0, -PANEL_H / 2 + 108, 'PAUSED', {
      fontFamily: FONT.display,
      fontSize:   '30px',
      fontStyle:  'bold',
      color:      '#ffd700',
      stroke:     '#7b2fff',
      strokeThickness: 5,
      shadow:     { offsetX: 0, offsetY: 3, color: '#00000099', blur: 8, fill: true },
    }).setOrigin(0.5);
    this.panel.add(title);

    // ── Score display (updated in show()) ────────────────────────────────────
    this.scoreText = this.scene.add.text(0, -PANEL_H / 2 + 142, '', {
      fontFamily: FONT.display,
      fontSize:   '14px',
      color:      '#9d6fff',
    }).setOrigin(0.5);
    this.panel.add(this.scoreText);

    // ── Divider line ────────────────────────────────────────────────────────
    const div = this.scene.add.graphics();
    div.lineStyle(1, PALETTE.purpleLight, 0.3);
    div.lineBetween(-PANEL_W / 2 + 24, -PANEL_H / 2 + 158, PANEL_W / 2 - 24, -PANEL_H / 2 + 158);
    this.panel.add(div);

    // ── Buttons ──────────────────────────────────────────────────────────────
    const actions = [
      () => this.hide(this.onResume),
      () => this.hide(this.onRestart),
      () => this.hide(this.onQuit),
    ];

    BUTTONS.forEach(([yOff, label, fillColor], i) => {
      this.buildButton(0, yOff, label, fillColor, actions[i]!);
    });
  }

  private buildButton(
    x: number, y: number,
    label: string,
    fillColor: number,
    action: () => void,
  ): void {
    const btn = this.scene.add.container(x, y);

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(fillColor, 0.92);
    bg.fillRoundedRect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H, BTN_H / 2);

    // Top-edge shimmer
    bg.fillStyle(0xffffff, 0.14);
    bg.fillRoundedRect(-BTN_W / 2 + 8, -BTN_H / 2 + 5, BTN_W - 16, BTN_H * 0.38, 12);

    // Rim
    bg.lineStyle(1.5, 0xffffff, 0.18);
    bg.strokeRoundedRect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H, BTN_H / 2);
    btn.add(bg);

    // Label
    const txt = this.scene.add.text(0, 1, label, {
      fontFamily: FONT.display,
      fontSize:   '18px',
      fontStyle:  'bold',
      color:      '#ffffff',
      stroke:     '#00000055',
      strokeThickness: 2,
    }).setOrigin(0.5);
    btn.add(txt);

    // Interaction zone
    btn.setSize(BTN_W, BTN_H);
    btn.setInteractive(
      new Phaser.Geom.Rectangle(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H),
      Phaser.Geom.Rectangle.Contains,
    );

    btn.on('pointerdown', () => {
      this.scene.tweens.add({
        targets: btn, scaleX: 0.93, scaleY: 0.93,
        duration: 70, yoyo: true, ease: 'Power2',
        onComplete: action,
      });
    });
    btn.on('pointerover', () => {
      this.scene.tweens.add({ targets: btn, scaleX: 1.05, scaleY: 1.05, duration: 80, ease: 'Back.easeOut' });
    });
    btn.on('pointerout', () => {
      this.scene.tweens.add({ targets: btn, scaleX: 1, scaleY: 1, duration: 80 });
    });

    this.panel.add(btn);
  }

  // ── Visibility ────────────────────────────────────────────────────────────

  /** @param score Optional current score to display in panel header. */
  show(score?: number): void {
    if (this.isVisible) return;
    this.isVisible = true;
    this.setVisible(true);

    // Update score display
    if (this.scoreText) {
      this.scoreText.setText(
        score != null ? `Score: ${score.toLocaleString()}` : '',
      );
    }

    // Panel starts 40 px above final position
    this.panel.setAlpha(0).setScale(0.92);
    this.panel.y = PANEL_CY - 40;

    this.scene.tweens.add({
      targets:  this.overlay,
      alpha:    1,
      duration: 220,
      ease:     'Power2',
    });
    this.scene.tweens.add({
      targets:  this.panel,
      y:        PANEL_CY,
      alpha:    1,
      scaleX:   1,
      scaleY:   1,
      duration: 340,
      ease:     'Back.easeOut',
    });
  }

  hide(callback?: () => void): void {
    if (!this.isVisible) return;
    this.isVisible = false;

    this.scene.tweens.add({
      targets:  this.panel,
      y:        PANEL_CY + 30,
      alpha:    0,
      scaleX:   0.92,
      scaleY:   0.92,
      duration: 200,
      ease:     'Power2',
    });
    this.scene.tweens.add({
      targets:  this.overlay,
      alpha:    0,
      duration: 240,
      ease:     'Power2',
      onComplete: () => {
        this.setVisible(false);
        callback?.();
      },
    });
  }

  private setVisible(v: boolean): void {
    this.overlay.setAlpha(v ? 1 : 0).setVisible(v);
    this.panel.setVisible(v);
  }
}
