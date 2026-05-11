// ─────────────────────────────────────────────────────────────────────────────
// KemeSplashScene.ts
//
// Studio logo splash — first thing the player sees after BootScene generates
// textures.  Shows the "K / Keme Games" wordmark, holds briefly, then
// hands off to CatSplashScene (which runs the asset preload in parallel).
//
// All timings come from TRANSITION.splash so they can be tuned in one place.
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { SCENE }          from './SceneKeys';
import { TRANSITION }     from './TransitionConfig';

const GOLD = '#c8952a';

export class KemeSplashScene extends Phaser.Scene {
  constructor() { super({ key: SCENE.KemeSplash }); }

  // ── Asset loading (only the cat image needed for CatSplashScene) ──────────

  preload(): void {
    this.load.image('splash_cat', 'assets/splash_cat.png');
  }

  // ── Splash display ────────────────────────────────────────────────────────

  create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#2c1654');

    // Subtle vignette
    const vig = this.add.graphics();
    vig.fillStyle(0x000000, 0.35);
    vig.fillCircle(width / 2, height / 2, Math.max(width, height) * 0.8);

    // Wordmark
    const kText = this.add.text(width / 2, height * 0.42, 'K', {
      fontFamily:  '"Georgia", "Times New Roman", serif',
      fontSize:    `${Math.round(width * 0.42)}px`,
      fontStyle:   'bold',
      color:       GOLD,
    }).setOrigin(0.5).setAlpha(0);

    const subText = this.add.text(width / 2, height * 0.61, 'Keme Games', {
      fontFamily:    '"Georgia", "Times New Roman", serif',
      fontSize:      '28px',
      fontStyle:     'bold',
      color:         GOLD,
      letterSpacing: 4,
    }).setOrigin(0.5).setAlpha(0);

    // Fade-in → hold → fade-out → advance
    this.tweens.add({
      targets:  [kText, subText],
      alpha:    1,
      duration: TRANSITION.splash.kemeIn,
      ease:     'Sine.easeIn',
      onComplete: () => {
        this.time.delayedCall(TRANSITION.splash.kemeHold, () => {
          this.tweens.add({
            targets:    [kText, subText],
            alpha:      0,
            duration:   TRANSITION.splash.kemeOut,
            ease:       'Sine.easeOut',
            onComplete: () => this.scene.start(SCENE.CatSplash),
          });
        });
      },
    });
  }
}
