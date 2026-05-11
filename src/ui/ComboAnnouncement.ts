// ─────────────────────────────────────────────────────────────────────────────
// ComboAnnouncement.ts
//
// Persistent overlay component that displays combo tier banners.
//
// Lifecycle:
//   const banner = new ComboAnnouncement(scene);
//   banner.show(state);   // called from ScoreSystem 'score:combo' event
//   banner.hide();        // called on board stable (or auto after 1.4 s)
//   banner.destroy();     // called on scene shutdown
//
// Screen feedback levels (escalating):
//   none    — no screen effect
//   subtle  — very gentle camera offset (no shake)
//   light   — fast screen flash, low alpha
//   medium  — flash + small shake
//   strong  — brighter flash + moderate shake + brief vignette
//   heavy   — full shake + colored flash + banner slides
//   extreme — max shake + strobe effect + full-width banner
//
// The banner itself sits at BOARD_CENTER_Y (above the board's midpoint),
// hidden under the UI layer (DEPTHS.overlay - 1) so it doesn't cover HUD.
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import {
  GAME_WIDTH, GAME_HEIGHT, DEPTHS,
  BOARD_OFFSET_Y, BOARD_ROWS, TILE_SIZE, TILE_GAP,
} from '../config/Constants';
import { COMBO_TIERS, ComboTier, ScreenFeedbackLevel } from '../game/scoring/ScoringConfig';
import type { ComboState } from '../game/scoring/ComboSystem';

// ── Layout constants ──────────────────────────────────────────────────────────

const BOARD_CENTER_Y = BOARD_OFFSET_Y + (BOARD_ROWS * (TILE_SIZE + TILE_GAP)) / 2;
const ANNOUNCE_Y     = BOARD_CENTER_Y - 30;   // slightly above board center
const BANNER_W       = 270;
const BANNER_H       = 54;
const BANNER_RADIUS  = 27;

// ══════════════════════════════════════════════════════════════════════════════
// ComboAnnouncement
// ══════════════════════════════════════════════════════════════════════════════

export class ComboAnnouncement {
  private scene:        Phaser.Scene;
  private container!:   Phaser.GameObjects.Container;
  private bg!:          Phaser.GameObjects.Graphics;
  private tierText!:    Phaser.GameObjects.Text;
  private multText!:    Phaser.GameObjects.Text;
  private flashOverlay!: Phaser.GameObjects.Graphics;

  private hideTimer:    Phaser.Time.TimerEvent   | null = null;
  private inTween:      Phaser.Tweens.Tween      | null = null;
  private outTween:     Phaser.Tweens.Tween      | null = null;
  /** Tracks every delayedCall created by the strobe chain for proper cleanup. */
  private strobeTimers: Phaser.Time.TimerEvent[]        = [];

  private currentTier: ComboTier = 'none';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.buildBanner();
    this.buildFlashOverlay();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Show the banner for the given combo state. */
  show(state: ComboState): void {
    if (state.tier === 'none') return;

    this.currentTier = state.tier;
    this.cancelTimers();

    // Update content
    this.updateBannerContent(state);

    // Animate in based on tier
    this.animateIn(state.tier);

    // Apply escalating screen feedback
    this.applyScreenFeedback(state);

    // Auto-dismiss
    const holdMs = this.getHoldDuration(state.tier);
    this.hideTimer = this.scene.time.delayedCall(holdMs, () => this.animateOut());
  }

  /** Immediately dismiss. */
  hide(): void {
    this.cancelTimers();
    this.animateOut();
  }

  destroy(): void {
    this.cancelTimers();
    // Ensure the camera zoom is always restored to 1:1, even if the scene
    // is torn down mid-animation (e.g. defeat transition during an extreme combo).
    if (this.scene?.cameras?.main) {
      this.scene.cameras.main.setZoom(1.0);
    }
    this.container.destroy();
    this.flashOverlay.destroy();
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  private buildBanner(): void {
    // Container starts hidden above board
    this.container = this.scene.add.container(GAME_WIDTH / 2, ANNOUNCE_Y - 40)
      .setDepth(DEPTHS.overlay - 1)
      .setAlpha(0)
      .setScale(0.7);

    // Background pill
    this.bg = this.scene.add.graphics();
    this.drawBg(0xffd700, 0.88);
    this.container.add(this.bg);

    // Tier label (e.g. "COMBO!")
    this.tierText = this.scene.add.text(0, -7, '', {
      fontFamily: 'Georgia, serif',
      fontSize:   '22px',
      fontStyle:  'bold',
      color:      '#ffffff',
      stroke:     '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.container.add(this.tierText);

    // Multiplier badge (e.g. "×1.9")
    this.multText = this.scene.add.text(0, 16, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize:   '13px',
      color:      '#ffffff',
      stroke:     '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.container.add(this.multText);
  }

  private buildFlashOverlay(): void {
    const g = this.scene.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.setAlpha(0)
     .setDepth(DEPTHS.overlay + 1)
     .setVisible(false);
    this.flashOverlay = g;
  }

  private drawBg(color: number, alpha: number): void {
    this.bg.clear();
    this.bg.fillStyle(color, alpha);
    this.bg.fillRoundedRect(
      -BANNER_W / 2, -BANNER_H / 2,
       BANNER_W,      BANNER_H,
       BANNER_RADIUS,
    );
    this.bg.lineStyle(2, 0xffffff, 0.45);
    this.bg.strokeRoundedRect(
      -BANNER_W / 2, -BANNER_H / 2,
       BANNER_W,      BANNER_H,
       BANNER_RADIUS,
    );
  }

  // ── Content update ────────────────────────────────────────────────────────

  private updateBannerContent(state: ComboState): void {
    const entry = COMBO_TIERS.find(t => t.tier === state.tier)!;
    const hexCol = `#${entry.color.toString(16).padStart(6, '0')}`;

    this.tierText
      .setText(entry.label)
      .setFontSize(`${entry.announcePx}px`)
      .setColor('#ffffff');

    this.multText
      .setText(state.multiplierFmt !== '' ? `${state.multiplierFmt} multiplier` : '')
      .setColor(hexCol);

    this.drawBg(entry.color, 0.92);
  }

  // ── Animate in ────────────────────────────────────────────────────────────

  private animateIn(tier: ComboTier): void {
    this.inTween?.stop();
    this.outTween?.stop();

    const isStrong = tier === 'super' || tier === 'ultra' || tier === 'max';

    // Reset position for strong tiers (slide from top)
    if (isStrong) {
      this.container.y     = ANNOUNCE_Y - 50;
      this.container.setScale(0.6);
    } else {
      this.container.y     = ANNOUNCE_Y - 20;
      this.container.setScale(0.8);
    }

    this.inTween = this.scene.tweens.add({
      targets:  this.container,
      y:        ANNOUNCE_Y,
      alpha:    1,
      scaleX:   1,
      scaleY:   1,
      duration: isStrong ? 240 : 180,
      ease:     isStrong ? 'Back.easeOut' : 'Power2',
    });
  }

  // ── Animate out ───────────────────────────────────────────────────────────

  private animateOut(): void {
    this.inTween?.stop();
    this.outTween = this.scene.tweens.add({
      targets:  this.container,
      y:        this.container.y - 18,
      alpha:    0,
      scaleX:   0.85,
      scaleY:   0.85,
      duration: 250,
      ease:     'Power2',
    });
  }

  // ── Escalating screen feedback ────────────────────────────────────────────

  private applyScreenFeedback(state: ComboState): void {
    const level = state.feedback;

    switch (level) {
      case 'none':
        break;

      case 'subtle':
        // Tiny camera bump — barely perceptible
        this.scene.cameras.main.shake(60, 0.0012);
        break;

      case 'light':
        this.screenFlash(0xffd700, 0.12, 180);
        this.scene.cameras.main.shake(80, 0.002);
        break;

      case 'medium':
        this.screenFlash(0xffaa00, 0.18, 220);
        this.scene.cameras.main.shake(120, 0.004);
        break;

      case 'strong':
        this.screenFlash(0xff6600, 0.24, 280);
        this.scene.cameras.main.shake(200, 0.007);
        // Brief zoom-in accent
        this.scene.cameras.main.zoomTo(1.018, 120, 'Sine.easeOut', false, (_: Phaser.Cameras.Scene2D.Camera, p: number) => {
          if (p >= 1) this.scene.cameras.main.zoomTo(1.000, 180, 'Sine.easeInOut');
        });
        break;

      case 'heavy':
        this.screenFlash(0xff44aa, 0.32, 360);
        this.scene.cameras.main.shake(280, 0.012);
        this.scene.cameras.main.zoomTo(1.025, 150, 'Back.easeOut', false, (_: Phaser.Cameras.Scene2D.Camera, p: number) => {
          if (p >= 1) this.scene.cameras.main.zoomTo(1.000, 250, 'Sine.easeInOut');
        });
        break;

      case 'extreme': {
        // Full shake + strobe effect
        this.scene.cameras.main.shake(400, 0.018);
        this.scene.cameras.main.zoomTo(1.035, 180, 'Back.easeOut', false, (_: Phaser.Cameras.Scene2D.Camera, p: number) => {
          if (p >= 1) this.scene.cameras.main.zoomTo(1.000, 320, 'Sine.easeInOut');
        });
        // Strobe: rapid flashes — every timer is tracked so cancelTimers() can
        // stop the chain immediately (prevents orphaned flashes after hide()).
        let strobeCount = 0;
        const doStrobe = () => {
          if (strobeCount++ >= 4) return;
          this.screenFlash(0xffffff, 0.22, 80, () => {
            const t = this.scene.time.delayedCall(60, doStrobe);
            this.strobeTimers.push(t);
          });
        };
        doStrobe();
        break;
      }
    }
  }

  // ── Screen flash helper ───────────────────────────────────────────────────

  private screenFlash(
    color:      number,
    peakAlpha:  number,
    duration:   number,
    onComplete?: () => void,
  ): void {
    const g = this.flashOverlay;
    g.clear();
    g.fillStyle(color, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.setVisible(true).setAlpha(0);

    this.scene.tweens.add({
      targets:  g,
      alpha:    peakAlpha,
      duration: duration * 0.25,
      ease:     'Power3',
      onComplete: () => {
        this.scene.tweens.add({
          targets:    g,
          alpha:      0,
          duration:   duration * 0.75,
          ease:       'Power2',
          onComplete: () => {
            g.setVisible(false);
            onComplete?.();
          },
        });
      },
    });
  }

  // ── Timing ────────────────────────────────────────────────────────────────

  private getHoldDuration(tier: ComboTier): number {
    const durations: Partial<Record<ComboTier, number>> = {
      nice:  900,
      great: 1000,
      combo: 1100,
      super: 1300,
      ultra: 1500,
      max:   2000,
    };
    return durations[tier] ?? 900;
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  private cancelTimers(): void {
    this.hideTimer?.destroy();
    this.hideTimer = null;
    // Cancel every pending strobe delayedCall so the flash chain stops
    // immediately when the combo is superseded or the banner is hidden.
    this.strobeTimers.forEach(t => t.destroy());
    this.strobeTimers = [];
  }
}

