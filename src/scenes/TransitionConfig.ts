// ─────────────────────────────────────────────────────────────────────────────
// TransitionConfig.ts
//
// Centralised timing constants for every cross-scene camera transition.
//
// Board / tile animation timings (swap, fall, destroy, etc.) live in
// ANIM inside Constants.ts — this file covers only scene-level transitions.
//
// Usage:
//   import { TRANSITION } from './TransitionConfig';
//   scene.cameras.main.fadeOut(TRANSITION.fadeOut);
//
// All values are milliseconds unless noted otherwise.
// ─────────────────────────────────────────────────────────────────────────────

export const TRANSITION = {

  // ── Standard cross-scene fades ───────────────────────────────────────────
  /** Camera fade-out duration when leaving a scene (ms). */
  fadeOut:  300,
  /** Camera fade-in duration when entering a scene (ms). */
  fadeIn:   400,
  /** Quick white camera-flash on a positive tap/action (ms). */
  flashMs:  120,

  // ── Splash pipeline ───────────────────────────────────────────────────────
  splash: {
    kemeIn:       700,   // Keme logo fade-in
    kemeHold:    1800,   // hold at full opacity
    kemeOut:      500,   // Keme logo fade-out
    catMin:      3000,   // minimum cat-splash display time
    catFadeIn:    500,   // camera fade-in on cat splash
    catFadeOut:   400,   // camera fade-out from cat splash
    loadBarDelay:  300,  // extra pause after load-complete before advancing
  },

  // ── Victory flow ──────────────────────────────────────────────────────────
  victory: {
    burstDelay:      1200,  // gameplay → victory burst animation hold (ms)
    fadeOut:          500,  // scene exit fade
    fadeIn:           400,  // VictoryScene entry fade
    nextLevelFlash:   150,  // white flash on "NEXT LEVEL" tap
  },

  // ── Defeat flow ───────────────────────────────────────────────────────────
  defeat: {
    shakeMs:      380,   // screen-shake duration on out-of-moves
    overlayFade:  500,   // pause between shake and scene transition
    fadeOut:      300,   // DefeatScene entry fade (out of GameScene)
    fadeIn:       400,   // DefeatScene camera fade-in
    btnReveal:    600,   // delay before action buttons appear
  },

  // ── Game session ──────────────────────────────────────────────────────────
  game: {
    fadeIn:       400,   // GameScene entry
    retryFade:    300,   // restart via pause menu
    quitFade:     300,   // quit to HomeScene
    shuffleHold:  800,   // "Reshuffling…" toast display time
    spellReady:  1500,   // spell-ready notification float duration
  },

} as const;

// ── Helper type ───────────────────────────────────────────────────────────────
export type TransitionConfig = typeof TRANSITION;
