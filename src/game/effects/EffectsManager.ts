// ─────────────────────────────────────────────────────────────────────────────
// EffectsManager.ts  —  Centralized visual effects pipeline (full redesign)
//
// Design goals:
//   • Every effect returns an EffectHandle so callers can cancel early.
//   • GraphicsPool recycles short-lived Graphics objects (ring flashes,
//     sweeps, highlights) instead of creating and destroying on every call.
//   • ActiveEffect tracks all resources (tweens, timers, graphics) so
//     destroy() cleanly tears down mid-air effects on scene shutdown.
//   • QualityTier automatically scales particle budgets for mobile devices.
//   • Static `debug` flag enables console logging + on-screen labels.
//   • Screen flash uses a persistent overlay Graphics (not camera.flash)
//     so it participates in the depth system and can be tweened/cancelled.
//
// Public API (backward-compatible with pre-redesign callers):
//   spawnMatchBurst(x, y, color, matchSize)       → EffectHandle
//   spawnSelectBurst(x, y, color)                 → EffectHandle
//   spawnInvalidSwap(x, y)                        → EffectHandle
//   spawnPortalTeleport(x, y, color)              → EffectHandle
//   spawnSpellCast(x, y, color, name)             → EffectHandle
//   spawnMeteorEffect(tx, ty, color)              → EffectHandle
//   spawnLightningEffect(x1, y1, x2, y2)          → EffectHandle
//   spawnVictoryBurst(cx, cy)                     → EffectHandle
//   spawnComboText(x, y, count)                   → EffectHandle
//   spawnScorePopup(x, y, points)                 → EffectHandle
//   screenShake(intensity, duration)
//   screenFlash(color, duration, alpha)           → EffectHandle
//
// New board-feedback API:
//   spawnTileHighlight(x, y, color, r?)           → EffectHandle  (cancellable)
//   spawnShockwave(x, y, color)                   → EffectHandle
//   spawnRowSweep(worldY, color)                  → EffectHandle
//   spawnColSweep(worldX, color)                  → EffectHandle
//   spawnAreaPulse(x, y, r, color)               → EffectHandle
//
// Preset shortcuts:
//   shakeLight / shakeMedium / shakeHard / shakeMax
//   flashGold  / flashWhite  / flashRed  / flashCyan
//
// Lifecycle:
//   cancelAll()  — stop all active effects (e.g. level transition)
//   destroy()    — full teardown incl. pool (call on scene shutdown)
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import {
  PALETTE, DEPTHS,
  GAME_WIDTH, GAME_HEIGHT,
  TILE_SIZE, TILE_GAP,
  BOARD_ROWS, BOARD_COLS,
  BOARD_OFFSET_X, BOARD_OFFSET_Y,
} from '../../config/Constants';
import {
  QualityTier,
  QUALITY_SCALE,
  scaledCount,
  FX_DEPTH,
  PRESET_MATCH_SPARK,
  PRESET_MATCH_STAR,
  PRESET_SELECT,
  PRESET_PORTAL,
  PRESET_SPELL_BURST,
  PRESET_METEOR_TRAIL,
  PRESET_VICTORY,
  PRESET_SHOCKWAVE,
  PRESET_INVALID_RING,
  MATCH_STAR_THRESHOLD,
  MATCH_SHAKE_THRESHOLD,
  LIGHTNING_SEGMENTS,
  LIGHTNING_JITTER,
  LIGHTNING_FADE_MS,
  METEOR_TRAVEL_MS,
  SPELL_RING_COUNT,
  VICTORY_WAVE_COUNT,
  VICTORY_WAVE_GAP_MS,
  SWEEP_ALPHA,
  SWEEP_FADE_MS,
  SWEEP_HOLD_MS,
  HIGHLIGHT_LINE_W,
  HIGHLIGHT_PULSE_D,
  HIGHLIGHT_MIN_A,
  HIGHLIGHT_MAX_A,
  SHAKE_LIGHT,
  SHAKE_MEDIUM,
  SHAKE_HARD,
  SHAKE_MAX,
  FLASH_GOLD,
  FLASH_WHITE,
  FLASH_RED,
  FLASH_CYAN,
  FLASH_PURPLE,
  type FlashPreset,
  type ShakePreset,
  type ParticlePreset,
} from './EffectPresets';

// ── Effect handle ─────────────────────────────────────────────────────────────

/**
 * Returned by every spawn method.  Call `cancel()` to abort the effect early
 * and release all associated resources back to the pool.
 */
export interface EffectHandle {
  readonly id: number;
  cancel(): void;
}

/** Null-safe no-op handle for use in tests or when effects are disabled. */
export const NULL_HANDLE: EffectHandle = { id: -1, cancel: () => {} };

// ── Internal types ────────────────────────────────────────────────────────────

interface ActiveEffect {
  id:        number;
  tweens:    Phaser.Tweens.Tween[];
  timers:    Phaser.Time.TimerEvent[];
  /** Graphics checked back into the pool on cancel. */
  pooledG:   Phaser.GameObjects.Graphics[];
  /** Arbitrary GameObjects destroyed on cancel (emitters, text, etc.). */
  ownedGOs:  Phaser.GameObjects.GameObject[];
}

// ── Graphics pool ─────────────────────────────────────────────────────────────

const POOL_MAX = 28;

class GraphicsPool {
  private scene:     Phaser.Scene;
  private available: Phaser.GameObjects.Graphics[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Return a clean, visible, reset Graphics object. */
  acquire(): Phaser.GameObjects.Graphics {
    let g = this.available.pop();
    if (!g?.active) {
      g = this.scene.add.graphics();
    }
    return g.clear()
      .setAlpha(1).setScale(1).setVisible(true)
      .setPosition(0, 0).setAngle(0);
  }

  /** Return a Graphics to the pool (or destroy if pool is full). */
  release(g: Phaser.GameObjects.Graphics): void {
    if (!g?.active) return;
    g.clear().setVisible(false).setAlpha(0).setScale(1);
    if (this.available.length < POOL_MAX) {
      this.available.push(g);
    } else {
      g.destroy();
    }
  }

  destroyAll(): void {
    this.available.forEach(g => g?.active && g.destroy());
    this.available = [];
  }
}

// ── EffectsManager ────────────────────────────────────────────────────────────

let _nextId = 0;

export class EffectsManager {

  // ── Static configuration (set once at app start) ──────────────────────────

  /** Current rendering quality.  Adjust before scene create for low-end devices. */
  static quality: QualityTier = 'high';

  /** Set true to log effect creation/cancellation to console. */
  static debug = false;

  // ── Instance state ────────────────────────────────────────────────────────

  private scene:   Phaser.Scene;
  private pool:    GraphicsPool;
  private active:  Map<number, ActiveEffect> = new Map();

  /** Persistent full-screen overlay for screenFlash effects. */
  private flashOverlay!: Phaser.GameObjects.Graphics;
  private flashTween:    Phaser.Tweens.Tween | null = null;

  // ─────────────────────────────────────────────────────────────────────────

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.pool  = new GraphicsPool(scene);
    this.buildFlashOverlay();
    this.applyAutoQuality();
  }

  // ── Board tile effects ────────────────────────────────────────────────────

  /**
   * Burst of sparks at a matched tile group center.
   * @param matchSize  Number of tiles in the match — scales particle count.
   */
  spawnMatchBurst(x: number, y: number, color: number, matchSize: number): EffectHandle {
    if (!this.shouldRender()) return NULL_HANDLE;

    const e     = this.newEffect();
    const count = scaledCount(PRESET_MATCH_SPARK.count + matchSize * 3, EffectsManager.quality);

    const spark = this.addParticles(x, y, PRESET_MATCH_SPARK, count, [color, PALETTE.white, PALETTE.gold]);
    e.ownedGOs.push(spark);

    if (matchSize >= MATCH_STAR_THRESHOLD) {
      const stars = this.addParticles(x, y, PRESET_MATCH_STAR,
        scaledCount(PRESET_MATCH_STAR.count, EffectsManager.quality),
        [PALETTE.gold, color]);
      e.ownedGOs.push(stars);
    }

    if (matchSize >= MATCH_SHAKE_THRESHOLD) {
      this.scene.cameras.main.shake(SHAKE_LIGHT.duration, SHAKE_LIGHT.intensity * 0.001);
    }

    this.autoRelease(e, 1100);
    this.log(`matchBurst  size=${matchSize}  count=${count}`);
    return this.track(e);
  }

  /** Small particle burst on tile selection. */
  spawnSelectBurst(x: number, y: number, color: number): EffectHandle {
    if (!this.shouldRender()) return NULL_HANDLE;

    const e     = this.newEffect();
    const count = scaledCount(PRESET_SELECT.count, EffectsManager.quality);
    const em    = this.addParticles(x, y, PRESET_SELECT, count, [color, PALETTE.gold]);
    e.ownedGOs.push(em);

    this.autoRelease(e, 550);
    return this.track(e);
  }

  /** Red ring + X cross that expands and fades — invalid swap feedback. */
  spawnInvalidSwap(x: number, y: number): EffectHandle {
    const e   = this.newEffect();
    const g   = this.pool.acquire().setDepth(FX_DEPTH.rings).setPosition(x, y);
    const { lineWidth: lw, startR: r } = PRESET_INVALID_RING;

    g.lineStyle(lw,     0xff3344, 1);
    g.strokeCircle(0, 0, r);
    g.lineStyle(lw - 1, 0xff3344, 0.75);
    g.lineBetween(-10, -10, 10, 10);
    g.lineBetween( 10, -10, -10, 10);

    const tween = this.scene.tweens.add({
      targets: g, alpha: 0, scaleX: 1.55, scaleY: 1.55,
      duration: PRESET_INVALID_RING.duration, ease: 'Power2',
      onComplete: () => this.cancelEffect(e.id),
    });

    e.pooledG.push(g);
    e.tweens.push(tween);
    return this.track(e);
  }

  /** Swirling portal particles + outward ring pulse. */
  spawnPortalTeleport(x: number, y: number, color: number): EffectHandle {
    if (!this.shouldRender()) return NULL_HANDLE;

    const e     = this.newEffect();
    const count = scaledCount(PRESET_PORTAL.count, EffectsManager.quality);
    const em    = this.addParticles(x, y, PRESET_PORTAL, count, [PALETTE.green, 0x00ffcc, color]);
    e.ownedGOs.push(em);

    const ring = this.pool.acquire().setDepth(FX_DEPTH.rings).setPosition(x, y);
    ring.lineStyle(4, PALETTE.green, 1);
    ring.strokeCircle(0, 0, 24);

    const tween = this.scene.tweens.add({
      targets: ring, scaleX: 3.2, scaleY: 3.2, alpha: 0,
      duration: 520, ease: 'Power2',
      onComplete: () => this.cancelEffect(e.id),
    });

    e.pooledG.push(ring);
    e.tweens.push(tween);
    this.autoRelease(e, 900);
    return this.track(e);
  }

  // ── Board sweep effects (ability feedback) ────────────────────────────────

  /**
   * Horizontal colored flash across a row.
   * @param worldY  Center-Y of the row in world coordinates.
   */
  spawnRowSweep(worldY: number, color: number): EffectHandle {
    const e = this.newEffect();
    const g = this.pool.acquire().setDepth(FX_DEPTH.boardHighlight);
    g.fillStyle(color, SWEEP_ALPHA);
    g.fillRect(BOARD_OFFSET_X, worldY - TILE_SIZE / 2 - 2, BOARD_COLS * (TILE_SIZE + TILE_GAP), TILE_SIZE + 4);

    const hold  = this.scene.time.delayedCall(SWEEP_HOLD_MS, () => {
      const fade = this.scene.tweens.add({
        targets: g, alpha: 0,
        duration: SWEEP_FADE_MS, ease: 'Power2',
        onComplete: () => this.cancelEffect(e.id),
      });
      e.tweens.push(fade);
    });

    e.pooledG.push(g);
    e.timers.push(hold);
    return this.track(e);
  }

  /**
   * Vertical colored flash down a column.
   * @param worldX  Center-X of the column in world coordinates.
   */
  spawnColSweep(worldX: number, color: number): EffectHandle {
    const e = this.newEffect();
    const g = this.pool.acquire().setDepth(FX_DEPTH.boardHighlight);
    g.fillStyle(color, SWEEP_ALPHA);
    g.fillRect(worldX - TILE_SIZE / 2 - 2, BOARD_OFFSET_Y,
               TILE_SIZE + 4, BOARD_ROWS * (TILE_SIZE + TILE_GAP));

    const hold = this.scene.time.delayedCall(SWEEP_HOLD_MS, () => {
      const fade = this.scene.tweens.add({
        targets: g, alpha: 0,
        duration: SWEEP_FADE_MS, ease: 'Power2',
        onComplete: () => this.cancelEffect(e.id),
      });
      e.tweens.push(fade);
    });

    e.pooledG.push(g);
    e.timers.push(hold);
    return this.track(e);
  }

  /**
   * Persistent glowing ring around a tile.
   * Returns a handle — call `handle.cancel()` to remove the highlight.
   * @param r  Ring radius in px (default: 26, fits a 50 px tile).
   */
  spawnTileHighlight(x: number, y: number, color: number, r = 26): EffectHandle {
    const e = this.newEffect();
    const g = this.pool.acquire().setDepth(FX_DEPTH.boardHighlight).setPosition(x, y);
    g.lineStyle(HIGHLIGHT_LINE_W + 4, color, 0.12);
    g.strokeCircle(0, 0, r + 4);
    g.lineStyle(HIGHLIGHT_LINE_W, color, HIGHLIGHT_MAX_A);
    g.strokeCircle(0, 0, r);

    const pulse = this.scene.tweens.add({
      targets:  g,
      alpha:    HIGHLIGHT_MIN_A,
      duration: HIGHLIGHT_PULSE_D,
      yoyo:     true, repeat: -1, ease: 'Sine.easeInOut',
    });

    e.pooledG.push(g);
    e.tweens.push(pulse);
    return this.track(e);
  }

  /**
   * Expanding shockwave rings from a point — used for EMP blast and area clears.
   */
  spawnShockwave(x: number, y: number, color: number): EffectHandle {
    const e = this.newEffect();
    const { ringCount, baseR, endScale, duration, gap } = PRESET_SHOCKWAVE;

    for (let i = 0; i < ringCount; i++) {
      const g = this.pool.acquire().setDepth(FX_DEPTH.rings).setPosition(x, y);
      g.lineStyle(3 - i * 0.8, color, 0.9 - i * 0.2);
      g.strokeCircle(0, 0, baseR);

      const tween = this.scene.tweens.add({
        targets:  g,
        scaleX:   endScale - i * 0.8,
        scaleY:   endScale - i * 0.8,
        alpha:    0,
        duration: duration + i * 80,
        delay:    i * gap,
        ease:     'Power2',
        onComplete: () => { this.pool.release(g); },
      });

      e.pooledG.push(g);
      e.tweens.push(tween);
    }

    this.autoRelease(e, duration + ringCount * gap + 100);
    return this.track(e);
  }

  /**
   * Expanding ring pulse — lighter variant for selection / hit feedback.
   */
  spawnAreaPulse(x: number, y: number, r: number, color: number): EffectHandle {
    const e = this.newEffect();
    const g = this.pool.acquire().setDepth(FX_DEPTH.rings).setPosition(x, y);
    g.fillStyle(color, 0.18);
    g.fillCircle(0, 0, r);
    g.lineStyle(2, color, 0.85);
    g.strokeCircle(0, 0, r);

    const tween = this.scene.tweens.add({
      targets: g, scaleX: 2.2, scaleY: 2.2, alpha: 0,
      duration: 480, ease: 'Power2',
      onComplete: () => this.cancelEffect(e.id),
    });

    e.pooledG.push(g);
    e.tweens.push(tween);
    return this.track(e);
  }

  // ── Lightning ─────────────────────────────────────────────────────────────

  /** Jagged arc between two world points (for arc_discharge / column clears). */
  spawnLightningEffect(
    startX: number, startY: number,
    endX:   number, endY:   number,
  ): EffectHandle {
    const e = this.newEffect();
    const g = this.pool.acquire().setDepth(FX_DEPTH.bolts);

    // Core bright bolt
    g.lineStyle(2.5, PALETTE.cyan, 1);
    this.drawJaggedLine(g, startX, startY, endX, endY, LIGHTNING_SEGMENTS, LIGHTNING_JITTER);

    // Glow trace
    g.lineStyle(6, PALETTE.cyan, 0.18);
    this.drawJaggedLine(g, startX, startY, endX, endY, LIGHTNING_SEGMENTS, LIGHTNING_JITTER * 0.5);

    const tween = this.scene.tweens.add({
      targets: g, alpha: 0,
      duration: LIGHTNING_FADE_MS, ease: 'Power2',
      onComplete: () => this.cancelEffect(e.id),
    });

    e.pooledG.push(g);
    e.tweens.push(tween);
    return this.track(e);
  }

  // ── Screen effects ────────────────────────────────────────────────────────

  /** Camera shake using presets. */
  screenShake(intensity: number = 6, duration: number = 300): void {
    this.scene.cameras.main.shake(duration, intensity * 0.001);
  }

  shakeLight():  void { const { intensity, duration } = SHAKE_LIGHT;  this.screenShake(intensity, duration); }
  shakeMedium(): void { const { intensity, duration } = SHAKE_MEDIUM; this.screenShake(intensity, duration); }
  shakeHard():   void { const { intensity, duration } = SHAKE_HARD;   this.screenShake(intensity, duration); }
  shakeMax():    void { const { intensity, duration } = SHAKE_MAX;    this.screenShake(intensity, duration); }

  /**
   * Custom-overlay screen flash — cancellable, depth-managed.
   * Returns a handle; call cancel() to abort mid-fade.
   */
  screenFlash(color: number = 0xffffff, duration: number = 200, alpha: number = 0.4): EffectHandle {
    const e  = this.newEffect();
    const g  = this.flashOverlay;

    this.flashTween?.stop();
    g.clear();
    g.fillStyle(color, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.setVisible(true).setAlpha(0);

    const riseMs = duration * 0.25;
    const fallMs = duration * 0.75;

    const rise = this.scene.tweens.add({
      targets: g, alpha: alpha,
      duration: riseMs, ease: 'Power3',
      onComplete: () => {
        const fall = this.scene.tweens.add({
          targets: g, alpha: 0,
          duration: fallMs, ease: 'Power2',
          onComplete: () => {
            g.setVisible(false);
            this.cancelEffect(e.id);
          },
        });
        this.flashTween = fall;
        e.tweens.push(fall);
      },
    });

    this.flashTween = rise;
    e.tweens.push(rise);
    return this.track(e);
  }

  // ── Flash preset shortcuts ────────────────────────────────────────────────

  flashGold():   EffectHandle { return this.screenFlash(FLASH_GOLD.color,   FLASH_GOLD.duration,   FLASH_GOLD.alpha);   }
  flashWhite():  EffectHandle { return this.screenFlash(FLASH_WHITE.color,  FLASH_WHITE.duration,  FLASH_WHITE.alpha);  }
  flashRed():    EffectHandle { return this.screenFlash(FLASH_RED.color,    FLASH_RED.duration,    FLASH_RED.alpha);    }
  flashCyan():   EffectHandle { return this.screenFlash(FLASH_CYAN.color,   FLASH_CYAN.duration,   FLASH_CYAN.alpha);   }
  flashPurple(): EffectHandle { return this.screenFlash(FLASH_PURPLE.color, FLASH_PURPLE.duration, FLASH_PURPLE.alpha); }

  // ── Spell effects ─────────────────────────────────────────────────────────

  /** Full spell-cast sequence: particle burst + expanding rings + name text. */
  spawnSpellCast(x: number, y: number, color: number, spellName: string): EffectHandle {
    const e     = this.newEffect();
    const count = scaledCount(PRESET_SPELL_BURST.count, EffectsManager.quality);

    // Central burst
    const burst = this.addParticles(x, y, PRESET_SPELL_BURST, count, [color, PALETTE.white, PALETTE.gold]);
    e.ownedGOs.push(burst);

    // Expanding concentric rings
    for (let i = 0; i < SPELL_RING_COUNT; i++) {
      const g = this.pool.acquire().setDepth(FX_DEPTH.spellBurst - 1).setPosition(x, y);
      g.lineStyle(4 - i * 0.8, color, 1 - i * 0.22);
      g.strokeCircle(0, 0, 18);

      const tween = this.scene.tweens.add({
        targets: g,
        scaleX: 5.5 + i * 2.2, scaleY: 5.5 + i * 2.2, alpha: 0,
        duration: 640 + i * 140, delay: i * 110, ease: 'Power2',
        onComplete: () => this.pool.release(g),
      });

      e.pooledG.push(g);
      e.tweens.push(tween);
    }

    // Name text (centered, animate in → hold → out)
    const hexColor = `#${color.toString(16).padStart(6, '0')}`;
    const txt = this.scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.38,
      spellName.toUpperCase(), {
        fontFamily: 'Georgia, serif', fontSize: '26px', fontStyle: 'bold',
        color: hexColor, stroke: '#000000', strokeThickness: 5,
        shadow: { offsetX: 0, offsetY: 4, color: '#000000aa', blur: 12, fill: true },
      }).setOrigin(0.5).setDepth(FX_DEPTH.comboText).setAlpha(0);

    const txtTween = this.scene.tweens.add({
      targets: txt, alpha: 1, scaleX: 1.2, scaleY: 1.2,
      duration: 200, ease: 'Back.easeOut',
      yoyo: true, hold: 760,
      onComplete: () => { if (txt.active) txt.destroy(); },
    });

    e.ownedGOs.push(txt);
    e.tweens.push(txtTween);

    this.screenShake(SHAKE_HARD.intensity, SHAKE_HARD.duration);
    this.screenFlash(color, 300, 0.35);

    this.autoRelease(e, 1200);
    return this.track(e);
  }

  /** Meteor projectile that drops from above the board, then impacts. */
  spawnMeteorEffect(targetX: number, targetY: number, color: number): EffectHandle {
    const e     = this.newEffect();
    const startX = targetX - 55;
    const startY = -40;

    // Meteor body
    const body = this.pool.acquire()
      .setDepth(FX_DEPTH.projectiles)
      .setPosition(startX, startY);

    body.fillStyle(color, 1);
    body.fillCircle(0, 0, 14);
    body.fillStyle(0xff8844, 0.72);
    body.fillTriangle(0, -14, -10, 18, 10, 18);

    // Trail particles follow the body
    const trail = this.scene.add.particles(0, 0, 'particle_flare', {
      speed:     { min: 5, max: 30 },
      angle:     { min: 85, max: 95 },
      lifespan:  260,
      scale:     PRESET_METEOR_TRAIL.scale,
      alpha:     PRESET_METEOR_TRAIL.alpha,
      tint:      [color, 0xff8844],
      follow:    body,
      frequency: 30,
      quantity:  scaledCount(2, EffectsManager.quality),
    });
    trail.setDepth(FX_DEPTH.projectiles - 1);
    e.ownedGOs.push(trail);

    const travelTween = this.scene.tweens.add({
      targets: body, x: targetX, y: targetY,
      duration: METEOR_TRAVEL_MS, ease: 'Power2.easeIn',
      onComplete: () => {
        trail.stop();
        this.pool.release(body);
        this.spawnMatchBurst(targetX, targetY, color, 6);
        this.shakeHard();
        this.screenFlash(color, 200, 0.42);
        this.cancelEffect(e.id);
      },
    });

    e.pooledG.push(body);
    e.tweens.push(travelTween);
    return this.track(e);
  }

  // ── Score / combo text ────────────────────────────────────────────────────

  /**
   * Floating combo label above the board.
   * Note: ScorePopup.spawn() handles match-score popups; this handles
   * the inline combo burst text for backward compatibility with older callers.
   */
  spawnComboText(x: number, y: number, comboCount: number): EffectHandle {
    const LABELS = ['', '', 'COMBO!', 'AMAZING!', 'INCREDIBLE!', 'MAGICAL!', 'OVERLOADED!'];
    const COLORS = ['', '', '#ffd700', '#ff8800',  '#ff44aa',     '#00ff88',  '#00eeff'];
    const label  = LABELS[Math.min(comboCount, LABELS.length - 1)] ?? `×${comboCount} CHAIN`;
    const col    = COLORS[Math.min(comboCount, COLORS.length - 1)] ?? '#ffffff';
    const size   = 22 + comboCount * 3;

    const e   = this.newEffect();
    const txt = this.scene.add.text(x, y, label, {
      fontFamily: 'Georgia, serif', fontSize: `${size}px`, fontStyle: 'bold',
      color: col, stroke: '#000000', strokeThickness: 4,
      shadow: { offsetX: 0, offsetY: 3, color: '#000000aa', blur: 8, fill: true },
    }).setOrigin(0.5).setDepth(FX_DEPTH.comboText);

    // Pop-in scale
    txt.setScale(0.4);
    this.scene.tweens.add({ targets: txt, scaleX: 1, scaleY: 1, duration: 120, ease: 'Back.easeOut' });

    // Ring halo
    const ring = this.pool.acquire().setDepth(FX_DEPTH.comboText - 1).setPosition(x, y);
    ring.fillStyle(PALETTE.gold, 0.12);
    ring.fillCircle(0, 0, 48);
    ring.lineStyle(2.5, PALETTE.gold, 0.75);
    ring.strokeCircle(0, 0, 48);

    const ringTween = this.scene.tweens.add({
      targets: ring, scaleX: 2.8, scaleY: 2.8, alpha: 0,
      duration: 580, ease: 'Power2', onComplete: () => this.pool.release(ring),
    });

    const textTween = this.scene.tweens.add({
      targets: txt, y: y - 88, scaleX: 1.28, scaleY: 1.28, alpha: 0,
      duration: 920, ease: 'Power2', onComplete: () => this.cancelEffect(e.id),
    });

    e.ownedGOs.push(txt);
    e.pooledG.push(ring);
    e.tweens.push(ringTween, textTween);

    if (comboCount >= 3) this.shakeLight();
    if (comboCount >= 4) this.flashGold();

    return this.track(e);
  }

  /** Simple floating score number (legacy fallback — ScorePopup is preferred). */
  spawnScorePopup(x: number, y: number, points: number): EffectHandle {
    const e   = this.newEffect();
    const txt = this.scene.add.text(x, y, `+${points.toLocaleString()}`, {
      fontFamily: 'Arial, sans-serif', fontSize: '18px', fontStyle: 'bold',
      color: '#ffd700', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(FX_DEPTH.comboText);

    const tween = this.scene.tweens.add({
      targets: txt, y: y - 58, alpha: 0,
      duration: 720, ease: 'Power2',
      onComplete: () => this.cancelEffect(e.id),
    });

    e.ownedGOs.push(txt);
    e.tweens.push(tween);
    return this.track(e);
  }

  // ── Victory ───────────────────────────────────────────────────────────────

  /** Multi-wave celebration burst around a center point. */
  spawnVictoryBurst(cx: number, cy: number): EffectHandle {
    if (!this.shouldRender()) return NULL_HANDLE;

    const e = this.newEffect();
    const TINTS = [PALETTE.gold, PALETTE.white, PALETTE.green, PALETTE.purpleLight, PALETTE.cyan];

    for (let wave = 0; wave < VICTORY_WAVE_COUNT; wave++) {
      const timer = this.scene.time.delayedCall(wave * VICTORY_WAVE_GAP_MS, () => {
        const angle = (wave / VICTORY_WAVE_COUNT) * Math.PI * 2;
        const ox    = Math.cos(angle) * 68;
        const oy    = Math.sin(angle) * 68;

        const count = scaledCount(PRESET_VICTORY.count, EffectsManager.quality);
        const tints = [TINTS[wave % TINTS.length]!, PALETTE.white];
        const em    = this.addParticles(cx + ox, cy + oy, PRESET_VICTORY, count, tints);
        e.ownedGOs.push(em);
      });
      e.timers.push(timer);
    }

    this.shakeHard();
    this.flashGold();

    this.autoRelease(e, VICTORY_WAVE_COUNT * VICTORY_WAVE_GAP_MS + 1400);
    return this.track(e);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Cancel every active effect immediately. */
  cancelAll(): void {
    for (const id of [...this.active.keys()]) {
      this.cancelEffect(id);
    }
    this.log('cancelAll');
  }

  /** Full teardown — call on scene shutdown. */
  destroy(): void {
    this.cancelAll();
    this.flashTween?.stop();
    this.flashOverlay?.destroy();
    this.pool.destroyAll();
    this.log('destroyed');
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private buildFlashOverlay(): void {
    this.flashOverlay = this.scene.add.graphics()
      .setDepth(FX_DEPTH.screenFlash)
      .setAlpha(0)
      .setVisible(false);
  }

  private applyAutoQuality(): void {
    const device = this.scene.sys.game.device;
    // Auto-downgrade on mobile (can be overridden before construction)
    if (EffectsManager.quality === 'high' && (device.os.android || device.os.iOS)) {
      EffectsManager.quality = 'medium';
      this.log('Auto quality → medium (mobile detected)');
    }
  }

  /** Returns false when quality is LOW and the effect is optional. */
  private shouldRender(): boolean {
    return EffectsManager.quality !== 'low';
  }

  private newEffect(): ActiveEffect {
    return { id: _nextId++, tweens: [], timers: [], pooledG: [], ownedGOs: [] };
  }

  private track(e: ActiveEffect): EffectHandle {
    this.active.set(e.id, e);
    this.log(`track #${e.id}  active=${this.active.size}`);
    return {
      id:     e.id,
      cancel: () => this.cancelEffect(e.id),
    };
  }

  private cancelEffect(id: number): void {
    const e = this.active.get(id);
    if (!e) return;
    this.active.delete(id);

    for (const t of e.tweens)    { if (t?.isPlaying?.()) t.stop(); }
    for (const t of e.timers)    { t?.destroy(); }
    for (const g of e.pooledG)   { this.pool.release(g); }
    for (const o of e.ownedGOs)  { if (o?.active) o.destroy(); }

    this.log(`cancel #${id}  active=${this.active.size}`);
  }

  /** Schedule an effect to self-cancel after `delayMs`. */
  private autoRelease(e: ActiveEffect, delayMs: number): void {
    const timer = this.scene.time.delayedCall(delayMs, () => this.cancelEffect(e.id));
    e.timers.push(timer);
  }

  /**
   * Create and immediately explode a one-shot particle emitter.
   * Returns the emitter (added to e.ownedGOs by the caller).
   */
  private addParticles(
    x:      number,
    y:      number,
    preset: ParticlePreset,
    count:  number,
    tints:  number[],
  ): Phaser.GameObjects.Particles.ParticleEmitter {
    const em = this.scene.add.particles(x, y, preset.texture, {
      speed:    preset.speed,
      angle:    { min: 0, max: 360 },
      lifespan: preset.lifespan,
      scale:    preset.scale,
      alpha:    preset.alpha,
      tint:     tints,
      quantity: count,
      emitting: false,
    }).setDepth(preset.depth);

    em.explode(count);
    return em;
  }

  /**
   * Draw a jagged broken line between two points using random offsets —
   * used for lightning bolts and arc_discharge.
   */
  private drawJaggedLine(
    g:      Phaser.GameObjects.Graphics,
    x1:     number, y1: number,
    x2:     number, y2: number,
    segs:   number,
    jitter: number,
  ): void {
    const pts: Array<{ x: number; y: number }> = [{ x: x1, y: y1 }];

    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      pts.push({
        x: Phaser.Math.Linear(x1, x2, t) + Phaser.Math.Between(-jitter, jitter),
        y: Phaser.Math.Linear(y1, y2, t) + Phaser.Math.Between(-jitter, jitter),
      });
    }
    pts.push({ x: x2, y: y2 });

    g.beginPath();
    g.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i]!.x, pts[i]!.y);
    g.strokePath();
  }

  private log(msg: string): void {
    if (EffectsManager.debug) console.log(`[FX] ${msg}`);
  }
}
