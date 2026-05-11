// ─────────────────────────────────────────────────────────────────────────────
// SceneNavigator.ts
//
// Centralised scene-navigation helpers.
//
// All cross-scene transitions should go through these methods so camera-fade
// timings are consistent, the fade always completes before the scene switch,
// and the call sites stay clean (one-liners instead of inline callbacks).
//
// Usage:
//   import { SceneNavigator } from './SceneNavigator';
//
//   // Fade to black → start target scene
//   SceneNavigator.fadeTo(this, SCENE.Home);
//
//   // White flash → fade out → start target scene (positive transitions)
//   SceneNavigator.flashTo(this, SCENE.Victory, { levelId: 2, score: 1400 });
//
//   // Restart current scene
//   SceneNavigator.restart(this);
//
//   // Fade camera in after this scene's create() runs
//   SceneNavigator.fadeIn(this);
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { TRANSITION } from './TransitionConfig';
import type { SceneKey } from './SceneKeys';

// Phaser camera-event string constants (avoids dependency on enum availability)
const EVT_FADE_OUT = 'camerafadeoutcomplete';

export const SceneNavigator = {

  // ── Cross-scene transitions ───────────────────────────────────────────────

  /**
   * Fade the camera to black then start a new scene.
   *
   * @param scene  The currently-active scene initiating the transition.
   * @param key    Target scene key (use SCENE.X constants).
   * @param data   Optional data object passed to the target's `init()`.
   * @param ms     Fade-out duration in ms (defaults to TRANSITION.fadeOut).
   */
  fadeTo(
    scene: Phaser.Scene,
    key:   SceneKey,
    data?: Record<string, unknown>,
    ms:    number = TRANSITION.fadeOut,
  ): void {
    // Guard against double-firing (e.g. tapping a button twice quickly)
    if ((scene as SceneWithTransitioning)._transitioning) return;
    (scene as SceneWithTransitioning)._transitioning = true;

    scene.cameras.main.fadeOut(ms, 0, 0, 0);
    scene.cameras.main.once(EVT_FADE_OUT, () => {
      scene.scene.start(key, data);
    });
  },

  /**
   * Restart the current scene with a fade-out first.
   * Useful for retry loops — no need to know the current key at the call site.
   */
  restart(scene: Phaser.Scene, ms: number = TRANSITION.fadeOut): void {
    const key = scene.scene.key as SceneKey;
    SceneNavigator.fadeTo(scene, key, undefined, ms);
  },

  /**
   * Quick white camera-flash followed by a fade-out → scene start.
   * Use for positive navigations (level complete, "Next Level" tap, etc.)
   * so the transition feels rewarding rather than ominous.
   */
  flashTo(
    scene: Phaser.Scene,
    key:   SceneKey,
    data?: Record<string, unknown>,
  ): void {
    if ((scene as SceneWithTransitioning)._transitioning) return;
    scene.cameras.main.flash(TRANSITION.flashMs, 255, 255, 255, false);
    scene.time.delayedCall(TRANSITION.flashMs + 60, () => {
      SceneNavigator.fadeTo(scene, key, data);
    });
  },

  // ── Entry fades ───────────────────────────────────────────────────────────

  /** Fade camera in from black — call near the end of `create()`. */
  fadeIn(scene: Phaser.Scene, ms: number = TRANSITION.fadeIn): void {
    // Clear the transitioning flag so future navigations work
    (scene as SceneWithTransitioning)._transitioning = false;
    scene.cameras.main.fadeIn(ms, 0, 0, 0);
  },

  /**
   * Fade camera in from the deep-purple palette colour.
   * Matches the Keme/Cat splash background for a seamless hand-off.
   */
  fadeInPurple(scene: Phaser.Scene, ms: number = TRANSITION.fadeIn): void {
    (scene as SceneWithTransitioning)._transitioning = false;
    scene.cameras.main.fadeIn(ms, 44, 22, 84);
  },

} as const;

// ── Internal augmentation type ────────────────────────────────────────────────
// We stamp a `_transitioning` flag onto the scene to prevent double-tap races.
// Using interface augmentation keeps it off the public Phaser.Scene API.
interface SceneWithTransitioning extends Phaser.Scene {
  _transitioning?: boolean;
}
