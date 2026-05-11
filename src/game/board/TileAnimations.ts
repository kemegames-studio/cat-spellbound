// ─────────────────────────────────────────────────────────────────────────────
// TileAnimations.ts
//
// Single source of truth for every tile-level animation constant and every
// reusable tween helper.
//
// Import this file from Tile.ts (and CircuitTile.ts, any future subclass).
// Never hardcode durations or easing strings directly in the tile — always
// refer to TILE_ANIM.xxx.
//
// Board-level timings (swap guard delay, cascade pause) live in
// src/config/Constants.ts (ANIM).  Tile-visual timings live HERE.
//
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';

// ══════════════════════════════════════════════════════════════════════════════
// 1. ANIMATION CONSTANTS
// ══════════════════════════════════════════════════════════════════════════════

export const TILE_ANIM = {

  // ── Selection / deselection ───────────────────────────────────────────────
  selectedScale:        1.12,   // target container scale when selected
  selectedDuration:     110,    // ms
  selectedEase:         'Back.easeOut',
  deselectedScale:      1.00,
  deselectedDuration:   100,
  deselectedEase:       'Power2',

  // ── Hover (desktop + initial tap contact) ─────────────────────────────────
  hoverScale:           1.06,
  hoverDuration:        70,
  hoverEase:            'Power2',
  unhoverDuration:      60,
  unhoverEase:          'Power2',

  // ── Swap slide ────────────────────────────────────────────────────────────
  swapDuration:         200,    // keep in sync with ANIM.tileSwap in Constants
  swapEase:             'Power2.easeInOut',

  // ── Spawn drop-in ─────────────────────────────────────────────────────────
  spawnFromScale:       0.40,   // initial scale
  spawnDuration:        285,    // keep in sync with ANIM.tileSpawn
  spawnEase:            'Back.easeOut',
  spawnAlphaFrom:       0.00,
  spawnAlphaTo:         1.00,
  spawnInitStagger:     18,     // ms per (col+row) during board init
  spawnRefillStagger:   20,     // ms per row stagger during gravity refill

  // ── Match pop + destroy ───────────────────────────────────────────────────
  matchPopScale:        1.48,
  matchDuration:        185,    // keep in sync with ANIM.tileDestroy
  matchEase:            'Back.easeIn',
  // Secondary glow ring expansion that runs during match
  matchGlowScale:       3.60,
  matchGlowDuration:    275,
  matchGlowEase:        'Power2',

  // ── Fall + landing squash-stretch ─────────────────────────────────────────
  fallBaseDuration:     280,    // base ms — keep in sync with ANIM.tileFall
  fallPerRowMs:         38,     // additional ms per row fallen (distance feel)
  fallStaggerMs:        22,     // delay stagger ms per row (column order feel)
  fallEase:             'Bounce.easeOut',
  landSquashX:          1.10,   // momentary x scale on landing
  landSquashY:          0.90,   // momentary y scale on landing
  landDuration:         88,
  landEase:             'Sine.easeOut',

  // ── Idle float (runs when tile is resting on board) ───────────────────────
  idleYRange:           2.4,    // ±px oscillation around base Y
  idleYMinMs:           1900,   // random range for natural variation
  idleYMaxMs:           2900,
  idleYEase:            'Sine.easeInOut',
  // Subtle scale "breathing" — complements Y float
  idleScaleMax:         1.018,  // pulse between 1.0 and this
  idleScaleMs:          2500,
  idleScaleEase:        'Sine.easeInOut',

  // ── Glow ring pulse (selected state) ─────────────────────────────────────
  glowPulseMs:          660,
  glowPulseAlphaMin:    0.22,
  glowPulseAlphaMax:    0.62,
  glowPulseEase:        'Sine.easeInOut',
  glowIdleAlpha:        0.18,   // constant alpha when NOT selected

  // ── Hit flash (impact on match) ───────────────────────────────────────────
  hitFlashPeakAlpha:    0.65,
  hitFlashRiseMs:       60,
  hitFlashFallMs:       200,

  // ── Curse overlay ─────────────────────────────────────────────────────────
  cursePulseMs:         950,
  curseAlphaMin:        0.42,
  curseAlphaMax:        0.78,
  cursePulseEase:       'Sine.easeInOut',
  // Tint applied to baseImage while cursed
  curseTint:            0xcc4488,

  // ── Frozen overlay (future Phase 2) ──────────────────────────────────────
  frozenTint:           0x88ccff,
  frozenAlpha:          0.55,

  // ── Locked overlay (future Phase 2) ──────────────────────────────────────
  lockedAlpha:          0.50,
  lockedTint:           0x445566,

  // ── Invalid swap shake ────────────────────────────────────────────────────
  shakeOffsetX:         6,
  shakeDuration:        60,
  shakeRepeats:         2,

} as const;

// ══════════════════════════════════════════════════════════════════════════════
// 2. TWEEN HELPERS  (static, scene-driven, no side-effect outside tweens)
// ══════════════════════════════════════════════════════════════════════════════

export class TweenHelpers {

  // ── Scale ─────────────────────────────────────────────────────────────────

  /** Uniform scale to a target value. Returns the Tween for potential .stop(). */
  static scaleTo(
    scene:      Phaser.Scene,
    target:     Phaser.GameObjects.GameObject,
    scale:      number,
    duration:   number,
    ease:       string,
    delay:      number = 0,
    onComplete?: () => void,
  ): Phaser.Tweens.Tween {
    return scene.tweens.add({
      targets:  target,
      scaleX:   scale,
      scaleY:   scale,
      duration,
      ease,
      delay,
      onComplete: onComplete ? () => onComplete() : undefined,
    });
  }

  /**
   * Scale to (sx, sy), then spring back to (1, 1) — one-shot squash/stretch.
   * Used for landing bounce and combo pop.
   */
  static squashStretch(
    scene:      Phaser.Scene,
    target:     Phaser.GameObjects.GameObject,
    sx:         number,
    sy:         number,
    duration:   number,
    ease:       string = 'Sine.easeOut',
    onComplete?: () => void,
  ): void {
    scene.tweens.add({
      targets:  target,
      scaleX:   sx,
      scaleY:   sy,
      duration,
      yoyo:     true,
      ease,
      onComplete: onComplete ? () => onComplete() : undefined,
    });
  }

  /** Scale pop (grow + alpha fade) used for tile destruction. */
  static popDestroy(
    scene:       Phaser.Scene,
    target:      Phaser.GameObjects.GameObject,
    popScale:    number,
    duration:    number,
    ease:        string,
    onComplete?: () => void,
  ): void {
    scene.tweens.add({
      targets:    target,
      scaleX:     popScale,
      scaleY:     popScale,
      alpha:      0,
      duration,
      ease,
      onComplete: onComplete ? () => onComplete() : undefined,
    });
  }

  // ── Looping pulses ────────────────────────────────────────────────────────

  /**
   * Infinite alpha pulse between `from` and `to`.
   * Caller is responsible for calling .stop() + .remove() on the returned Tween.
   */
  static alphaPulse(
    scene:    Phaser.Scene,
    target:   Phaser.GameObjects.GameObject & { alpha: number },
    from:     number,
    to:       number,
    duration: number,
    ease:     string = 'Sine.easeInOut',
  ): Phaser.Tweens.Tween {
    target.alpha = from;
    return scene.tweens.add({
      targets:  target,
      alpha:    to,
      duration,
      yoyo:     true,
      repeat:   -1,
      ease,
    });
  }

  /**
   * Infinite uniform scale pulse.
   * Returns tween for cleanup.
   */
  static scalePulse(
    scene:    Phaser.Scene,
    target:   Phaser.GameObjects.GameObject,
    to:       number,
    duration: number,
    ease:     string = 'Sine.easeInOut',
  ): Phaser.Tweens.Tween {
    return scene.tweens.add({
      targets:  target,
      scaleX:   to,
      scaleY:   to,
      duration,
      yoyo:     true,
      repeat:   -1,
      ease,
    });
  }

  /**
   * Infinite Y oscillation (idle float).
   * Start from current Y; caller must stop tween before any gravity move.
   */
  static floatY(
    scene:    Phaser.Scene,
    target:   Phaser.GameObjects.GameObject & { y: number },
    offsetY:  number,
    duration: number,
    ease:     string = 'Sine.easeInOut',
  ): Phaser.Tweens.Tween {
    const targetY = target.y + offsetY;
    return scene.tweens.add({
      targets:  target,
      y:        targetY,
      duration,
      yoyo:     true,
      repeat:   -1,
      ease,
    });
  }

  // ── Movement ──────────────────────────────────────────────────────────────

  /** Tween Y to a target with easing. Returns tween. */
  static moveToY(
    scene:       Phaser.Scene,
    target:      Phaser.GameObjects.GameObject & { y: number },
    y:           number,
    duration:    number,
    ease:        string,
    delay:       number = 0,
    onComplete?: () => void,
  ): Phaser.Tweens.Tween {
    return scene.tweens.add({
      targets:    target,
      y,
      duration,
      ease,
      delay,
      onComplete: onComplete ? () => onComplete() : undefined,
    });
  }

  /** Move to (x, y) simultaneously. Used for swap. */
  static moveToXY(
    scene:       Phaser.Scene,
    target:      Phaser.GameObjects.GameObject,
    x:           number,
    y:           number,
    duration:    number,
    ease:        string,
    onComplete?: () => void,
  ): Phaser.Tweens.Tween {
    return scene.tweens.add({
      targets:    target,
      x,
      y,
      duration,
      ease,
      onComplete: onComplete ? () => onComplete() : undefined,
    });
  }

  // ── Alpha ─────────────────────────────────────────────────────────────────

  /** One-shot alpha fade to a target value. */
  static fadeTo(
    scene:       Phaser.Scene,
    target:      Phaser.GameObjects.GameObject & { alpha: number },
    alpha:       number,
    duration:    number,
    ease:        string   = 'Power2',
    delay:       number   = 0,
    onComplete?: () => void,
  ): Phaser.Tweens.Tween {
    return scene.tweens.add({
      targets:    target,
      alpha,
      duration,
      ease,
      delay,
      onComplete: onComplete ? () => onComplete() : undefined,
    });
  }

  // ── Impact flash ──────────────────────────────────────────────────────────

  /**
   * Flash a Graphics/Image to peak alpha, then fade out.
   * Two-stage: fast rise, slow fall.  Does NOT loop.
   */
  static impactFlash(
    scene:     Phaser.Scene,
    target:    Phaser.GameObjects.GameObject & { alpha: number },
    peakAlpha: number,
    riseMs:    number,
    fallMs:    number,
  ): void {
    scene.tweens.add({
      targets:  target,
      alpha:    peakAlpha,
      duration: riseMs,
      ease:     'Power3',
      onComplete: () => {
        scene.tweens.add({
          targets:  target,
          alpha:    0,
          duration: fallMs,
          ease:     'Power2',
        });
      },
    });
  }

  // ── Shake ─────────────────────────────────────────────────────────────────

  /**
   * Horizontal shake — used for invalid-swap feedback.
   * Runs N yoyo cycles then snaps back to x=0 inside the container.
   */
  static shakeX(
    scene:    Phaser.Scene,
    target:   Phaser.GameObjects.Container,
    offsetX:  number,
    duration: number,
    repeats:  number,
  ): void {
    scene.tweens.add({
      targets:  target,
      x:        `+=${offsetX}`,
      duration,
      yoyo:     true,
      repeat:   repeats,
      ease:     'Sine.easeInOut',
    });
  }

  // ── Utility ───────────────────────────────────────────────────────────────

  /** Stop a tween safely — handles null without throwing. */
  static stop(tween: Phaser.Tweens.Tween | null): void {
    if (tween && tween.isPlaying()) {
      tween.stop();
    }
  }

  /** Stop an array of tweens. */
  static stopAll(tweens: Array<Phaser.Tweens.Tween | null>): void {
    tweens.forEach(t => TweenHelpers.stop(t));
  }
}
