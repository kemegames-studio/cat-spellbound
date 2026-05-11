// ─────────────────────────────────────────────────────────────────────────────
// HomeScene.ts
//
// Main menu / hub screen.
//
// The full UI is baked into ui_home.jpg (SVG-exported design).  We place
// transparent, interactive hit-zones on top of each tappable element.
//
// Source image: 768 × 1376 px → game canvas: 390 × 844 px
//   scale X = 390 / 768 ≈ 0.5078
//   scale Y = 844 / 1376 ≈ 0.6134
// All coordinates are in game-space (already scaled).
//
// Navigation uses SceneNavigator so transition timings are centralised and
// the double-tap guard fires automatically.
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTHS } from '../config/Constants';
import { SCENE }                  from './SceneKeys';
import type { SceneKey }          from './SceneKeys';
import { SceneNavigator }         from './SceneNavigator';
import { SceneDebug }             from './SceneDebug';

export class HomeScene extends Phaser.Scene {
  private dbg!: SceneDebug;

  constructor() { super({ key: SCENE.Home }); }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  create(): void {
    this.dbg = SceneDebug.attach(this);
    this.dbg.setState('home');

    SceneNavigator.fadeInPurple(this);

    // Full-screen background image
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ui_home')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(DEPTHS.bg);

    this.addHitZones();
  }

  // ── Hit-zone helpers ──────────────────────────────────────────────────────

  /**
   * Thin transparent Zone covering a tappable area.
   * When `onTap` is provided the cursor becomes a hand and the tap fires.
   */
  private zone(
    cx: number, cy: number,
    w:  number, h:  number,
    onTap?: () => void,
  ): Phaser.GameObjects.Zone {
    const z = this.add.zone(cx, cy, w, h)
      .setInteractive({ useHandCursor: !!onTap })
      .setDepth(DEPTHS.popup);

    if (onTap) {
      z.on('pointerdown', () => {
        this.cameras.main.flash(120, 255, 255, 255, false);
        onTap();
      });
    }
    return z;
  }

  /**
   * Navigate with a camera-fade.
   * @param key    Target scene key.
   * @param data   Optional scene data.
   */
  private goTo(key: SceneKey, data?: Record<string, unknown>): void {
    SceneNavigator.fadeTo(this, key, data);
  }

  // ── Hit zones ─────────────────────────────────────────────────────────────

  private addHitZones(): void {

    // ── Top-bar ────────────────────────────────────────────────────────────
    this.zone(28,  38,  52,  52);          // settings gear   (placeholder)
    this.zone(103, 28, 170,  42);          // lives pill       (placeholder)
    this.zone(188, 28,  36,  36);          // lives "+"        (placeholder)
    this.zone(272, 28, 170,  42);          // coins pill       (placeholder)
    this.zone(358, 28,  36,  36);          // coins "+"        (placeholder)

    // ── Primary CTA — PLAY ────────────────────────────────────────────────
    this.zone(GAME_WIDTH / 2, 695, 190, 72, () => {
      this.goTo(SCENE.Game, { levelId: 1 } as Record<string, unknown>);
    });

    // ── Secondary CTAs ────────────────────────────────────────────────────
    this.zone( 62, 695, 112, 64);          // events           (placeholder)
    this.zone(328, 695, 112, 64);          // shop             (placeholder)

    // ── Bottom nav tabs ───────────────────────────────────────────────────
    this.zone( 49, 810, 80, 80);           // home tab  (already here)
    this.zone(146, 810, 80, 80);           // store tab         (placeholder)
    this.zone(244, 810, 80, 80);           // social tab        (placeholder)
    this.zone(341, 810, 80, 80);           // profile tab       (placeholder)
  }
}
