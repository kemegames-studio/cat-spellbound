// ─────────────────────────────────────────────────────────────────────────────
// CatSplashScene.ts
//
// Cat-branded splash screen that runs in parallel with asset loading.
//
// Dual-gate advancement: both conditions must be true before advancing —
//   • splashDone  — minimum display time (TRANSITION.splash.catMin) elapsed.
//   • assetsReady — PreloadScene has emitted 'preload-complete'.
//
// This guarantees the player always sees the full splash while assets load
// in the background, and the game never starts with missing assets.
//
// Layout:
//   • Full-screen cat image (splash_cat.png loaded in KemeSplashScene)
//   • Gold progress bar near the bottom
//   • Camera fades in on entry, fades out to HomeScene on advance
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { PALETTE, GAME_WIDTH, GAME_HEIGHT } from '../config/Constants';
import { SCENE }      from './SceneKeys';
import { TRANSITION } from './TransitionConfig';

// ── Progress bar geometry ─────────────────────────────────────────────────

const BAR_W = 280;
const BAR_H = 12;
const BAR_X = (GAME_WIDTH - BAR_W) / 2;
const BAR_Y = GAME_HEIGHT - 75;

export class CatSplashScene extends Phaser.Scene {

  private assetsReady = false;
  private splashDone  = false;
  private loadBar!:   Phaser.GameObjects.Graphics;

  constructor() { super({ key: SCENE.CatSplash }); }

  // ── Scene entry ───────────────────────────────────────────────────────────

  create(): void {
    this.assetsReady = false;
    this.splashDone  = false;

    this.buildSplash();
    this.buildLoadBar();
    this.startPreload();

    // Minimum display duration gate
    this.cameras.main.fadeIn(TRANSITION.splash.catFadeIn, 44, 22, 84);
    this.time.delayedCall(TRANSITION.splash.catMin, () => {
      this.splashDone = true;
      this.maybeAdvance();
    });
  }

  // ── Construction ─────────────────────────────────────────────────────────

  private buildSplash(): void {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'splash_cat')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(0);
  }

  private buildLoadBar(): void {
    // Track (background)
    const track = this.add.graphics().setDepth(1);
    track.fillStyle(0x1a0a3a, 1);
    track.fillRoundedRect(BAR_X - 3, BAR_Y - 3, BAR_W + 6, BAR_H + 6, 9);
    track.lineStyle(1, 0x7040c0, 0.45);
    track.strokeRoundedRect(BAR_X - 3, BAR_Y - 3, BAR_W + 6, BAR_H + 6, 9);

    this.loadBar = this.add.graphics().setDepth(2);
    this.drawBar(0.04);
  }

  // ── Preload coordination ──────────────────────────────────────────────────

  private startPreload(): void {
    // Launch PreloadScene as a parallel (invisible) loader scene
    this.scene.launch(SCENE.Preload);
    const preload = this.scene.get(SCENE.Preload);

    preload.events.on('load-progress', (v: number) => this.drawBar(v));

    preload.events.once('preload-complete', () => {
      this.drawBar(1);
      this.assetsReady = true;
      // Small grace period so the full bar is visible before advancing
      this.time.delayedCall(TRANSITION.splash.loadBarDelay, () => this.maybeAdvance());
    });
  }

  // ── Dual-gate ─────────────────────────────────────────────────────────────

  private maybeAdvance(): void {
    if (!this.assetsReady || !this.splashDone) return;

    this.cameras.main.fadeOut(TRANSITION.splash.catFadeOut, 44, 22, 84);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop(SCENE.Preload);
      this.scene.start(SCENE.Home);
    });
  }

  // ── Progress bar rendering ────────────────────────────────────────────────

  private drawBar(pct: number): void {
    const p = Math.max(0.04, Math.min(pct, 1));
    this.loadBar.clear();

    // Gold fill
    this.loadBar.fillStyle(PALETTE.gold, 1);
    this.loadBar.fillRoundedRect(BAR_X, BAR_Y, BAR_W * p, BAR_H, 6);

    // Shine strip
    this.loadBar.fillStyle(0xffffff, 0.22);
    this.loadBar.fillRoundedRect(BAR_X + 2, BAR_Y + 1, BAR_W * p - 4, BAR_H * 0.4, 4);
  }
}
