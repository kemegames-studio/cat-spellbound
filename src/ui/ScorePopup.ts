// ─────────────────────────────────────────────────────────────────────────────
// ScorePopup.ts
//
// Factory for ephemeral floating score text.  All methods are static — there
// is no persistent state.  Each call spawns short-lived GameObjects that
// destroy themselves when their tween completes.
//
// Popup variants (chosen automatically from points + classification):
//
//   tiny    < 100 pts   — 11 px, gold, 0.8 s rise
//   small   100-199 pts — 13 px, gold, 0.9 s rise
//   medium  200-499 pts — 16 px, orange, 1.0 s rise  + label above
//   large   500-999 pts — 20 px, red-orange, 1.1 s rise + label + multiplier badge
//   huge    1000+  pts  — 26 px, white/cyan, 1.3 s rise + label + badge + pulse
//
// Usage:
//   ScorePopup.spawn(scene, x, y, event);
//   ScorePopup.spawnBonus(scene, x, y, points, label);
//   ScorePopup.spawnMultiplier(scene, x, y, multiplier);
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { DEPTHS } from '../config/Constants';
import type { ScoreMatchEvent } from '../game/scoring/ScoreSystem';

// ── Config ────────────────────────────────────────────────────────────────────

interface PopupSize {
  minPoints:  number;
  fontSize:   number;
  riseY:      number;
  duration:   number;
  showLabel:  boolean;
  showBadge:  boolean;
  pulse:      boolean;
}

const POPUP_SIZES: PopupSize[] = [
  { minPoints: 1000, fontSize: 26, riseY: 90, duration: 1300, showLabel: true,  showBadge: true,  pulse: true  },
  { minPoints:  500, fontSize: 20, riseY: 75, duration: 1100, showLabel: true,  showBadge: true,  pulse: false },
  { minPoints:  200, fontSize: 16, riseY: 62, duration: 1000, showLabel: true,  showBadge: false, pulse: false },
  { minPoints:  100, fontSize: 13, riseY: 52, duration:  900, showLabel: false, showBadge: false, pulse: false },
  { minPoints:    1, fontSize: 11, riseY: 44, duration:  800, showLabel: false, showBadge: false, pulse: false },
];

function getSizeConfig(points: number): PopupSize {
  return POPUP_SIZES.find(p => points >= p.minPoints) ?? POPUP_SIZES[POPUP_SIZES.length - 1]!;
}

// ── Factory ───────────────────────────────────────────────────────────────────

export class ScorePopup {

  // ── Primary popup — spawned from a ScoreMatchEvent ───────────────────────

  /**
   * Spawn a full-featured score popup at a world position.
   * Automatically selects variant based on points and match classification.
   */
  static spawn(
    scene: Phaser.Scene,
    x:     number,
    y:     number,
    event: ScoreMatchEvent,
  ): void {
    const { multipliedPoints: pts, classification: cls, comboMultiplier } = event;
    const cfg    = getSizeConfig(pts);
    const hexCol = `#${cls.color.toString(16).padStart(6, '0')}`;

    // ── Optional label (GREAT!, AMAZING!, …) above the points ───────────────
    if (cfg.showLabel && cls.label) {
      const lbl = scene.add.text(x, y - 20, cls.label, {
        fontFamily: 'Georgia, serif',
        fontSize:   `${Math.round(cfg.fontSize * 0.65)}px`,
        fontStyle:  'bold',
        color:      hexCol,
        stroke:     '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(DEPTHS.popup).setAlpha(0.9);

      ScorePopup.floatAndFade(scene, lbl, y - 20, cfg.riseY + 14, cfg.duration - 100);
    }

    // ── Main points text ────────────────────────────────────────────────────
    const pts_str = `+${pts.toLocaleString()}`;
    const text = scene.add.text(x, y, pts_str, {
      fontFamily: 'Georgia, serif',
      fontSize:   `${cfg.fontSize}px`,
      fontStyle:  'bold',
      color:      hexCol,
      stroke:     '#000000',
      strokeThickness: Math.round(cfg.fontSize * 0.18),
    }).setOrigin(0.5).setDepth(DEPTHS.popup);

    // Pop-in scale
    text.setScale(0.4);
    scene.tweens.add({
      targets: text, scaleX: 1, scaleY: 1,
      duration: 120, ease: 'Back.easeOut',
    });

    // Optional pulse for huge matches
    if (cfg.pulse) {
      scene.tweens.add({
        targets: text, scaleX: 1.10, scaleY: 1.10,
        duration: 200, yoyo: true, delay: 100, ease: 'Sine.easeInOut',
      });
    }

    ScorePopup.floatAndFade(scene, text, y, cfg.riseY, cfg.duration);

    // ── Multiplier badge ─────────────────────────────────────────────────────
    if (cfg.showBadge && comboMultiplier > 1.01) {
      ScorePopup.spawnMultiplier(
        scene, x + cfg.fontSize * 1.4, y - 6, comboMultiplier,
      );
    }
  }

  // ── Bonus popup (spell, objective) ──────────────────────────────────────

  static spawnBonus(
    scene:  Phaser.Scene,
    x:      number,
    y:      number,
    points: number,
    label:  string,
    color:  number = 0x00ff88,
  ): void {
    const hexCol = `#${color.toString(16).padStart(6, '0')}`;

    // Label
    const lbl = scene.add.text(x, y - 18, label, {
      fontFamily: 'Georgia, serif',
      fontSize:   '12px',
      fontStyle:  'bold',
      color:      hexCol,
      stroke:     '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(DEPTHS.popup);
    ScorePopup.floatAndFade(scene, lbl, y - 18, 55, 1000);

    // Points
    const text = scene.add.text(x, y, `+${points.toLocaleString()}`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '15px',
      fontStyle:  'bold',
      color:      hexCol,
      stroke:     '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(DEPTHS.popup);

    text.setScale(0.5);
    scene.tweens.add({ targets: text, scaleX: 1, scaleY: 1, duration: 130, ease: 'Back.easeOut' });
    ScorePopup.floatAndFade(scene, text, y, 60, 1000);
  }

  // ── Multiplier badge ──────────────────────────────────────────────────────

  static spawnMultiplier(
    scene:      Phaser.Scene,
    x:          number,
    y:          number,
    multiplier: number,
  ): void {
    const label = `×${multiplier.toFixed(1)}`;
    const badge = scene.add.text(x, y, label, {
      fontFamily: 'Arial, sans-serif',
      fontSize:   '10px',
      fontStyle:  'bold',
      color:      '#ffffff',
      backgroundColor: '#333399',
      padding:    { x: 5, y: 2 },
    }).setOrigin(0, 0.5).setDepth(DEPTHS.popup).setAlpha(0.92);

    ScorePopup.floatAndFade(scene, badge, y, 40, 900);
  }

  // ── Milestone celebration popup ───────────────────────────────────────────

  static spawnMilestone(
    scene:     Phaser.Scene,
    x:         number,
    y:         number,
    label:     string,
  ): void {
    // Large centred text with a glow behind it
    const glow = scene.add.text(x, y, label, {
      fontFamily: 'Georgia, serif',
      fontSize:   '22px',
      fontStyle:  'bold',
      color:      '#ffff88',
      stroke:     '#ffd700',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(DEPTHS.popup - 1).setAlpha(0.35);

    const text = scene.add.text(x, y, label, {
      fontFamily: 'Georgia, serif',
      fontSize:   '22px',
      fontStyle:  'bold',
      color:      '#ffd700',
      stroke:     '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(DEPTHS.popup);

    // Bounce in
    text.setScale(0.2);
    scene.tweens.add({
      targets: [text, glow], scaleX: 1, scaleY: 1,
      duration: 220, ease: 'Back.easeOut',
    });

    // Hold then float out
    scene.time.delayedCall(600, () => {
      ScorePopup.floatAndFade(scene, text, y, 60, 700);
      ScorePopup.floatAndFade(scene, glow, y, 60, 600);
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private static floatAndFade(
    scene:    Phaser.Scene,
    target:   Phaser.GameObjects.GameObject & { y: number; alpha: number },
    startY:   number,
    riseY:    number,
    duration: number,
  ): void {
    scene.tweens.add({
      targets:    target,
      y:          startY - riseY,
      alpha:      0,
      duration,
      ease:       'Power2',
      onComplete: () => target.destroy(),
    });
  }
}
