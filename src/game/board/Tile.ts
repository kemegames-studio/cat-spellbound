// ─────────────────────────────────────────────────────────────────────────────
// Tile.ts  —  Advanced tile with layered visuals + animation pipeline
//
// VISUAL LAYER STACK (rendered bottom-to-top within the Container):
//
//   0  dropShadow      Graphics  – dark soft oval offset slightly below
//   1  glowRing        Graphics  – color-matched halo (ADD blend mode)
//   2  baseImage       Image     – main tile texture
//   3  shineLayer      Graphics  – static diagonal highlight band (baked)
//   4  stateOverlay    Graphics  – multipurpose: curse / frozen / locked
//   5  selRingOuter    Graphics  – gold selection ring
//   6  selRingInner    Graphics  – white inner ring (pulsing alpha)
//   7  hitFlash        Graphics  – white impact flash (alpha=0 at rest)
//
// TILE STATE MACHINE:
//   idle       → normal resting state, idle float active
//   hovered    → slight scale-up, no float
//   selected   → ring visible, glow pulse, scale 1.12
//   falling    → gravity drop in progress, no idle
//   swapping   → mid-swap tween, no input
//   spawning   → entry animation, not yet interactive
//   matched    → destruction triggered, non-interactive
//   cursed     → modifier layer, combinable with idle/selected
//   (future) frozen | locked | blocked | shielded
//
// PARTICLE HOOKS:
//   Tile emits typed events; Board attaches listeners via tile.on():
//     'tile:select'   → { x, y, color }
//     'tile:match'    → { x, y, color, size }
//     'tile:land'     → { x, y, color }
//     'tile:spawn'    → { x, y }
//
// PERFORMANCE NOTES:
//   • All Graphics shapes are drawn ONCE at construction, never redrawn
//     per frame.  State changes toggle visibility / alpha / tint only.
//   • glowRing uses Phaser.BlendModes.ADD (WebGL only; safe fallback on Canvas).
//   • Idle tweens store handles and are stopped atomically before any
//     gravity/spawn/match tween to avoid Y-property conflicts.
//   • hitFlash is a single shared graphics with alpha=0 at rest — zero
//     overdraw cost when idle.
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { PALETTE, TILE_SIZE, TILE_COLORS, ANIM } from '../../config/Constants';
import { TILE_ANIM, TweenHelpers }               from './TileAnimations';
import { TileType }                              from './TileTypes';

// ── Tile state ────────────────────────────────────────────────────────────────

/**
 * All possible visual/interaction states a tile can occupy.
 * Base states (rows 1-2) are used by Tile.ts.
 * Extended states (rows 3-4) are used by CircuitTile (Charge Up) and future subclasses.
 */
export type TileState =
  // ── Base states ───────────────────────────────────────────────────────────
  | 'idle'
  | 'hovered'
  | 'selected'
  | 'falling'
  | 'swapping'
  | 'spawning'
  | 'matched'
  // ── Charge Up / subclass extensions ──────────────────────────────────────
  | 'overloaded'   // corrupted — cannot contribute to chains cleanly
  | 'grounded'     // locked — cannot be swapped
  | 'shorted'      // mid-chain flash state
  ;

/** Modifier flags — orthogonal to the primary state above. */
export interface TileModifiers {
  cursed:   boolean;
  sleeping: boolean;   // locked, cannot be swapped (sleeping cat)
  frozen:   boolean;   // future Phase 2
  locked:   boolean;   // future Phase 2
  blocked:  boolean;   // future Phase 2
  shielded: boolean;   // future Phase 2
}

// ══════════════════════════════════════════════════════════════════════════════
// Tile class
// ══════════════════════════════════════════════════════════════════════════════

export class Tile extends Phaser.GameObjects.Container {

  // ── Identity ──────────────────────────────────────────────────────────────
  public tileType:   TileType;
  public gridCol:    number;
  public gridRow:    number;

  // ── Primary state ─────────────────────────────────────────────────────────
  /** Current primary state — read by Board to guard against stale interactions. */
  public tileState:  TileState = 'spawning';

  // ── Legacy boolean flags (kept for backward compat with Board / MatchLogic) ─
  get isMatched():  boolean { return this.tileState === 'matched'; }
  get isSelected(): boolean { return this.tileState === 'selected'; }
  get isFalling():  boolean { return this.tileState === 'falling'; }

  // Writable shims so Board can still do tile.isMatched = true, etc.
  set isMatched(v: boolean)  { if (v) this.tileState = 'matched'; }
  set isSelected(v: boolean) { /* managed via setSelected() */ }
  set isFalling(v: boolean)  { if (v) this.tileState = 'falling'; }

  // ── Modifier flags ────────────────────────────────────────────────────────
  public cursed:   boolean = false;
  public sleeping: boolean = false;
  public isPortal: boolean = false;
  // Phase 2+ placeholders — declared so subclasses and future code compile cleanly
  public frozen:   boolean = false;
  public locked:   boolean = false;
  public blocked:  boolean = false;
  public shielded: boolean = false;

  // ── Visual layers (see layer stack in file header) ────────────────────────
  private dropShadow!:    Phaser.GameObjects.Graphics;
  private glowRing!:      Phaser.GameObjects.Graphics;
  public  baseImage!:     Phaser.GameObjects.Image;      // public: Board sets texture (sleeping cat)
  private shineLayer!:    Phaser.GameObjects.Graphics;
  private stateOverlay!:  Phaser.GameObjects.Graphics;
  private selRingOuter!:  Phaser.GameObjects.Graphics;
  private selRingInner!:  Phaser.GameObjects.Graphics;
  private hitFlash!:      Phaser.GameObjects.Graphics;

  // ── Active tween handles (stopped atomically on state change) ────────────
  private idleYTween!:      Phaser.Tweens.Tween | null;
  private idleScaleTween!:  Phaser.Tweens.Tween | null;
  private glowPulseTween!:  Phaser.Tweens.Tween | null;
  private cursePulseTween!: Phaser.Tweens.Tween | null;

  // ─────────────────────────────────────────────────────────────────────────
  constructor(
    scene:  Phaser.Scene,
    x:      number,
    y:      number,
    type:   TileType,
    col:    number,
    row:    number,
  ) {
    super(scene, x, y);

    this.tileType  = type;
    this.gridCol   = col;
    this.gridRow   = row;

    // Null-init all tween handles
    this.idleYTween      = null;
    this.idleScaleTween  = null;
    this.glowPulseTween  = null;
    this.cursePulseTween = null;

    this.buildVisuals(scene, type);

    // Hitbox for input
    this.setSize(TILE_SIZE, TILE_SIZE);
    this.setInteractive();

    scene.add.existing(this);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // A. VISUAL LAYER BUILDERS
  // All shapes are drawn once here.  No per-frame redraws.
  // ══════════════════════════════════════════════════════════════════════════

  private buildVisuals(scene: Phaser.Scene, type: TileType): void {
    const color = TILE_COLORS[type] ?? 0xffffff;

    this.buildDropShadow(scene);
    this.buildGlowRing(scene, color);
    this.buildBaseImage(scene, type);
    this.buildShineLayer(scene);
    this.buildStateOverlay(scene);
    this.buildSelectionRings(scene);
    this.buildHitFlash(scene);
  }

  // ── Layer 0: drop shadow ──────────────────────────────────────────────────

  private buildDropShadow(scene: Phaser.Scene): void {
    const g = scene.add.graphics();
    // Soft dark oval, offset 3px down, 80% of tile width
    g.fillStyle(0x000000, 0.30);
    g.fillEllipse(0, TILE_SIZE * 0.46, TILE_SIZE * 0.82, TILE_SIZE * 0.20);
    this.dropShadow = g;
    this.add(g);
  }

  // ── Layer 1: glow ring ────────────────────────────────────────────────────

  private buildGlowRing(scene: Phaser.Scene, color: number): void {
    const g = scene.add.graphics();
    // Slightly larger filled circle — relies on ADD blending for glow look
    const radius = TILE_SIZE * 0.60;
    g.fillStyle(color, 1);
    g.fillCircle(0, 0, radius);
    g.setAlpha(TILE_ANIM.glowIdleAlpha);

    try {
      // ADD blend makes overlapping glows brighter — great on dark backgrounds
      g.setBlendMode(Phaser.BlendModes.ADD);
    } catch {
      // Canvas renderer fallback — blend mode silently fails, visual degrades gracefully
    }

    this.glowRing = g;
    this.add(g);
  }

  // ── Layer 2: base image ───────────────────────────────────────────────────

  private buildBaseImage(scene: Phaser.Scene, type: TileType): void {
    const img = scene.add.image(0, 0, `tile_${type}`);
    this.baseImage = img;
    this.add(img);
  }

  // ── Layer 3: shine (static diagonal highlight) ────────────────────────────

  private buildShineLayer(scene: Phaser.Scene): void {
    const g = scene.add.graphics();

    // Diagonal band: top-left quadrant of the tile face
    // Drawn as a thin ellipse tilted 45°, very low opacity
    g.fillStyle(0xffffff, 0.22);
    g.fillEllipse(
      -TILE_SIZE * 0.18,
      -TILE_SIZE * 0.22,
      TILE_SIZE * 0.42,
      TILE_SIZE * 0.14,
    );

    // Tiny specular dot in the top-left corner
    g.fillStyle(0xffffff, 0.40);
    g.fillCircle(-TILE_SIZE * 0.28, -TILE_SIZE * 0.28, 3);

    this.shineLayer = g;
    this.add(g);
  }

  // ── Layer 4: state overlay ────────────────────────────────────────────────
  // One Graphics object; redrawn ONLY when the modifier changes (rare).

  private buildStateOverlay(scene: Phaser.Scene): void {
    const g = scene.add.graphics();
    g.setVisible(false);
    g.setAlpha(0);
    this.stateOverlay = g;
    this.add(g);
  }

  private drawCurseOverlay(): void {
    const g = this.stateOverlay;
    g.clear();
    // Vignette-style dark purple fill, rounded to match tile
    g.fillStyle(0x6600aa, 0.60);
    g.fillRoundedRect(-TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, 10);
    // Lighter inner aura
    g.fillStyle(0xaa44ff, 0.25);
    g.fillRoundedRect(
      -TILE_SIZE * 0.35, -TILE_SIZE * 0.35,
       TILE_SIZE * 0.70,  TILE_SIZE * 0.70,
      6,
    );
    g.setVisible(true);
    g.setAlpha(TILE_ANIM.curseAlphaMin);
  }

  /**
   * Phase 2+ overlay stubs — call drawXxxOverlay() when adding state.
   * Each clears the graphics, redraws, then re-runs any pulse tween.
   */
  private drawFrozenOverlay(): void {
    const g = this.stateOverlay;
    g.clear();
    // Ice-blue fill + diagonal crack lines
    g.fillStyle(0x88ccff, 0.45);
    g.fillRoundedRect(-TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, 10);
    g.lineStyle(1, 0xffffff, 0.55);
    g.lineBetween(-TILE_SIZE * 0.2, -TILE_SIZE * 0.4, TILE_SIZE * 0.3, TILE_SIZE * 0.2);
    g.lineBetween(-TILE_SIZE * 0.4,  TILE_SIZE * 0.1, TILE_SIZE * 0.1, TILE_SIZE * 0.4);
    g.setVisible(true);
    g.setAlpha(TILE_ANIM.frozenAlpha);
  }

  private drawLockedOverlay(): void {
    const g = this.stateOverlay;
    g.clear();
    // Dark grey overlay with a chain-link pattern
    g.fillStyle(0x223344, 0.55);
    g.fillRoundedRect(-TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, 10);
    // Simple chain links (two ovals)
    g.lineStyle(2, 0x8899aa, 0.80);
    g.strokeEllipse(-6, -4, 10, 16);
    g.strokeEllipse( 6,  4, 10, 16);
    g.setVisible(true);
    g.setAlpha(TILE_ANIM.lockedAlpha);
  }

  // ── Layers 5 + 6: selection rings ─────────────────────────────────────────

  private buildSelectionRings(scene: Phaser.Scene): void {
    const half = TILE_SIZE / 2;

    // Outer ring — gold, 2.5px
    const outer = scene.add.graphics();
    outer.lineStyle(2.5, PALETTE.gold, 1.0);
    outer.strokeRoundedRect(-half - 4, -half - 4, TILE_SIZE + 8, TILE_SIZE + 8, 13);
    outer.setVisible(false);
    this.selRingOuter = outer;
    this.add(outer);

    // Inner ring — white, 1px (pulses when selected)
    const inner = scene.add.graphics();
    inner.lineStyle(1.0, 0xffffff, 0.85);
    inner.strokeRoundedRect(-half - 1, -half - 1, TILE_SIZE + 2, TILE_SIZE + 2, 11);
    inner.setVisible(false);
    inner.setAlpha(0.85);
    this.selRingInner = inner;
    this.add(inner);
  }

  // ── Layer 7: hit flash ────────────────────────────────────────────────────

  private buildHitFlash(scene: Phaser.Scene): void {
    const g = scene.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(-TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, 10);
    g.setAlpha(0);
    this.hitFlash = g;
    this.add(g);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // B. STATE TRANSITIONS
  // ══════════════════════════════════════════════════════════════════════════

  // ── Selection ─────────────────────────────────────────────────────────────

  setSelected(selected: boolean): void {
    this.stopIdleAnimations();

    if (selected) {
      this.tileState = 'selected';

      // Show rings
      this.selRingOuter.setVisible(true);
      this.selRingInner.setVisible(true);

      // Scale pop
      TweenHelpers.scaleTo(
        this.scene, this,
        TILE_ANIM.selectedScale,
        TILE_ANIM.selectedDuration,
        TILE_ANIM.selectedEase,
      );

      // Glow pulse
      TweenHelpers.stop(this.glowPulseTween);
      this.glowPulseTween = TweenHelpers.alphaPulse(
        this.scene, this.glowRing,
        TILE_ANIM.glowPulseAlphaMin,
        TILE_ANIM.glowPulseAlphaMax,
        TILE_ANIM.glowPulseMs,
        TILE_ANIM.glowPulseEase,
      );

      // Inner ring alpha pulse (slower, offset feel)
      TweenHelpers.alphaPulse(
        this.scene, this.selRingInner,
        0.40, 1.00,
        TILE_ANIM.glowPulseMs * 1.3,
        'Sine.easeInOut',
      );

      // Emit particle hook
      this.emit('tile:select', { x: this.x, y: this.y, color: this.getColor() });

    } else {
      const wasSelected = this.tileState === 'selected';
      this.tileState = 'idle';

      if (wasSelected) {
        // Hide rings
        this.selRingOuter.setVisible(false);
        this.selRingInner.setVisible(false);
        this.scene.tweens.killTweensOf(this.selRingInner);

        // Stop glow pulse, restore idle alpha
        TweenHelpers.stop(this.glowPulseTween);
        this.glowPulseTween = null;
        TweenHelpers.fadeTo(
          this.scene, this.glowRing,
          TILE_ANIM.glowIdleAlpha, 180,
        );
      }

      // Scale back
      TweenHelpers.scaleTo(
        this.scene, this,
        TILE_ANIM.deselectedScale,
        TILE_ANIM.deselectedDuration,
        TILE_ANIM.deselectedEase,
        0,
        () => {
          if (this.tileState === 'idle') this.startIdleAnimations();
        },
      );
    }
  }

  // ── Hover ─────────────────────────────────────────────────────────────────

  setHovered(hovered: boolean): void {
    if (this.tileState === 'selected' || this.tileState !== 'idle') return;

    if (hovered) {
      this.stopIdleAnimations();
      TweenHelpers.scaleTo(
        this.scene, this,
        TILE_ANIM.hoverScale,
        TILE_ANIM.hoverDuration,
        TILE_ANIM.hoverEase,
      );
    } else {
      TweenHelpers.scaleTo(
        this.scene, this,
        1.0,
        TILE_ANIM.unhoverDuration,
        TILE_ANIM.unhoverEase,
        0,
        () => {
          if (this.tileState === 'idle') this.startIdleAnimations();
        },
      );
    }
  }

  // ── Cursed modifier ───────────────────────────────────────────────────────

  applyCurse(): void {
    if (this.cursed) return;
    this.cursed = true;

    // Tint base image
    this.baseImage.setTint(TILE_ANIM.curseTint);

    // Draw and show curse overlay
    this.drawCurseOverlay();

    // Pulse the overlay alpha
    TweenHelpers.stop(this.cursePulseTween);
    this.cursePulseTween = TweenHelpers.alphaPulse(
      this.scene, this.stateOverlay,
      TILE_ANIM.curseAlphaMin,
      TILE_ANIM.curseAlphaMax,
      TILE_ANIM.cursePulseMs,
      TILE_ANIM.cursePulseEase,
    );

    // Brief scale shudder
    TweenHelpers.squashStretch(
      this.scene, this, 0.88, 1.12, 180,
    );
  }

  clearCurse(): void {
    if (!this.cursed) return;
    this.cursed = false;
    this.baseImage.clearTint();
    TweenHelpers.stop(this.cursePulseTween);
    this.cursePulseTween = null;
    TweenHelpers.fadeTo(this.scene, this.stateOverlay, 0, 200, 'Power2', 0, () => {
      this.stateOverlay.setVisible(false).setAlpha(0);
    });
  }

  // ── Phase 2+ modifier stubs ───────────────────────────────────────────────

  /** Apply frozen state (Phase 2). */
  applyFrozen(): void {
    this.frozen = true;
    this.drawFrozenOverlay();
    this.baseImage.setTint(TILE_ANIM.frozenTint);
    this.disableInteractive();
  }

  clearFrozen(): void {
    this.frozen = false;
    this.baseImage.clearTint();
    TweenHelpers.fadeTo(this.scene, this.stateOverlay, 0, 200, 'Power2', 0, () => {
      this.stateOverlay.setVisible(false);
    });
    this.setInteractive();
  }

  /** Apply locked state (Phase 2). */
  applyLocked(): void {
    this.locked = true;
    this.drawLockedOverlay();
    this.baseImage.setTint(TILE_ANIM.lockedTint);
    this.disableInteractive();
  }

  clearLocked(): void {
    this.locked = false;
    this.baseImage.clearTint();
    TweenHelpers.fadeTo(this.scene, this.stateOverlay, 0, 200, 'Power2', 0, () => {
      this.stateOverlay.setVisible(false);
    });
    this.setInteractive();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // C. ANIMATION PIPELINE
  // ══════════════════════════════════════════════════════════════════════════

  // ── Spawn ─────────────────────────────────────────────────────────────────

  /**
   * Drop-in spawn animation.  Called by Board after creating a new tile.
   * @param fromY  World Y to start the drop from (above board).
   * @param delay  Extra delay for staggered board-init spawns.
   */
  playSpawnAnimation(fromY: number, delay: number = 0): void {
    this.stopAllAnimations();
    this.tileState = 'spawning';

    const destY = this.y;
    this.y      = fromY;
    this.setAlpha(0);
    this.setScale(TILE_ANIM.spawnFromScale);

    this.scene.tweens.add({
      targets:  this,
      y:        destY,
      alpha:    TILE_ANIM.spawnAlphaTo,
      scaleX:   1,
      scaleY:   1,
      duration: TILE_ANIM.spawnDuration,
      ease:     TILE_ANIM.spawnEase,
      delay,
      onComplete: () => {
        if (this.tileState === 'spawning') {
          this.tileState = 'idle';
          this.startIdleAnimations();
        }
        this.emit('tile:spawn', { x: this.x, y: this.y });
      },
    });
  }

  // ── Swap ──────────────────────────────────────────────────────────────────

  /**
   * Slide the tile to a new world position.
   * Board calls this before committing the grid swap.
   */
  playSwapAnimation(targetX: number, targetY: number, onComplete?: () => void): void {
    this.stopIdleAnimations();
    this.tileState = 'swapping';

    TweenHelpers.moveToXY(
      this.scene, this,
      targetX, targetY,
      TILE_ANIM.swapDuration,
      TILE_ANIM.swapEase,
      () => {
        if (this.tileState === 'swapping') this.tileState = 'idle';
        onComplete?.();
      },
    );
  }

  // ── Match destruction ─────────────────────────────────────────────────────

  /**
   * Pop-scale then fade out.  Calls onComplete (which nulls the grid cell)
   * then destroys this game object.
   */
  playMatchAnimation(onComplete?: () => void): void {
    this.stopAllAnimations();
    this.tileState = 'matched';
    this.disableInteractive();

    // Simultaneously:
    //   1. Container pops and fades
    //   2. glowRing expands and fades (local burst)
    //   3. hitFlash fires
    //   4. shineLayer pops

    // 1. Container pop+fade
    TweenHelpers.popDestroy(
      this.scene, this,
      TILE_ANIM.matchPopScale,
      TILE_ANIM.matchDuration,
      TILE_ANIM.matchEase,
      () => {
        onComplete?.();
        this.destroy();
      },
    );

    // 2. Glow ring expansion
    this.scene.tweens.add({
      targets:  this.glowRing,
      scaleX:   TILE_ANIM.matchGlowScale,
      scaleY:   TILE_ANIM.matchGlowScale,
      alpha:    0,
      duration: TILE_ANIM.matchGlowDuration,
      ease:     TILE_ANIM.matchGlowEase,
    });

    // 3. Hit flash
    TweenHelpers.impactFlash(
      this.scene, this.hitFlash,
      TILE_ANIM.hitFlashPeakAlpha,
      TILE_ANIM.hitFlashRiseMs,
      TILE_ANIM.hitFlashFallMs,
    );

    // 4. Emit hook
    this.emit('tile:match', {
      x: this.x, y: this.y,
      color: this.getColor(),
      size: 1,   // Board overrides via its own burst call
    });
  }

  // ── Fall / gravity drop ───────────────────────────────────────────────────

  /**
   * Animate the tile falling to `targetY` over a distance-scaled duration.
   * @param targetY    World Y destination.
   * @param fallRows   Number of rows the tile is falling (scales duration + delay).
   * @param onComplete Fired when the tile settles (after land-bounce finishes).
   */
  playFallAnimation(targetY: number, fallRows: number = 1, onComplete?: () => void): void {
    this.stopIdleAnimations();
    this.tileState = 'falling';

    const duration = TILE_ANIM.fallBaseDuration + fallRows * TILE_ANIM.fallPerRowMs;
    const delay    = fallRows * TILE_ANIM.fallStaggerMs;

    TweenHelpers.moveToY(
      this.scene, this,
      targetY,
      duration,
      TILE_ANIM.fallEase,
      delay,
      () => {
        if (this.tileState !== 'matched') {
          this.tileState = 'idle';
          this.playLandBounce();
          this.startIdleAnimations();
          this.emit('tile:land', { x: this.x, y: this.y, color: this.getColor() });
        }
        onComplete?.();
      },
    );
  }

  // ── Land bounce (squash-stretch) ──────────────────────────────────────────

  private playLandBounce(): void {
    // Phase 1: squash down
    this.scene.tweens.add({
      targets:  this,
      scaleX:   TILE_ANIM.landSquashX,
      scaleY:   TILE_ANIM.landSquashY,
      duration: TILE_ANIM.landDuration * 0.45,
      ease:     'Power3',
      onComplete: () => {
        // Phase 2: spring back to 1
        this.scene.tweens.add({
          targets:  this,
          scaleX:   1,
          scaleY:   1,
          duration: TILE_ANIM.landDuration * 0.55,
          ease:     TILE_ANIM.landEase,
        });
      },
    });
  }

  // ── Idle animations ───────────────────────────────────────────────────────

  startIdleAnimations(): void {
    if (this.tileState !== 'idle' || this.sleeping) return;

    // Y float — random period for organic variation
    const yDur    = Phaser.Math.Between(TILE_ANIM.idleYMinMs, TILE_ANIM.idleYMaxMs);
    const yOffset = Phaser.Math.FloatBetween(-TILE_ANIM.idleYRange, TILE_ANIM.idleYRange);
    this.idleYTween = TweenHelpers.floatY(
      this.scene, this, yOffset, yDur, TILE_ANIM.idleYEase,
    );

    // Scale-breathe tween: adds organic life on desktop but is skipped on mobile
    // (touch devices) to halve the concurrent tween count from 112 → 56 and
    // reduce CPU overhead on lower-end phones.  The Y-float alone provides
    // enough motion on small screens.
    const isMobile = this.scene.sys.game.device.os.android ||
                     this.scene.sys.game.device.os.iOS;
    if (!isMobile) {
      this.idleScaleTween = TweenHelpers.scalePulse(
        this.scene, this,
        TILE_ANIM.idleScaleMax,
        TILE_ANIM.idleScaleMs,
        TILE_ANIM.idleScaleEase,
      );
    }
  }

  stopIdleAnimations(): void {
    TweenHelpers.stop(this.idleYTween);
    TweenHelpers.stop(this.idleScaleTween);
    this.idleYTween     = null;
    this.idleScaleTween = null;
  }

  /** Stop ALL active tweens (idle + selection + curse). Called before match/spawn. */
  private stopAllAnimations(): void {
    this.stopIdleAnimations();
    TweenHelpers.stop(this.glowPulseTween);
    TweenHelpers.stop(this.cursePulseTween);
    this.glowPulseTween  = null;
    this.cursePulseTween = null;
    this.scene.tweens.killTweensOf(this.selRingInner);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // D. HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  /** Primary colour for this tile — drives glow ring + particle colours. */
  getColor(): number {
    return TILE_COLORS[this.tileType] ?? 0xffffff;
  }

  /** Called by Board / GravitySystem after moving the tile in the grid. */
  updateGridPosition(col: number, row: number): void {
    this.gridCol = col;
    this.gridRow = row;
  }

  /**
   * Recolor the glow ring when the tile type changes (e.g. after a reshuffle).
   * Clears and redraws the ring graphics.
   */
  refreshGlowColor(): void {
    const color  = this.getColor();
    const radius = TILE_SIZE * 0.60;
    this.glowRing.clear();
    this.glowRing.fillStyle(color, 1);
    this.glowRing.fillCircle(0, 0, radius);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // E. LIFECYCLE
  // ══════════════════════════════════════════════════════════════════════════

  override destroy(fromScene?: boolean): void {
    this.stopAllAnimations();
    // Kill any remaining tweens targeting this object or its children
    this.scene?.tweens?.killTweensOf(this);
    this.scene?.tweens?.killTweensOf(this.glowRing);
    this.scene?.tweens?.killTweensOf(this.stateOverlay);
    super.destroy(fromScene);
  }
}
