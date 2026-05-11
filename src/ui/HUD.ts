// ─────────────────────────────────────────────────────────────────────────────
// HUD.ts  —  Gameplay HUD (full redesign)
//
// Architecture: each visual section is built by a dedicated private method and
// updated through a matching public method.  All animated elements use tween
// proxy objects so Phaser handles every interpolation (no per-frame callbacks).
//
// Sections (top → bottom, 220 px total):
//   TopBar    (48 px) — pause button · level label · score badge · combo badge
//   MovesRow  (42 px) — animated moves counter with color-state system
//   ObjRow    (42 px) — per-objective fill bars (built dynamically)
//   EnergyRow (40 px) — three animated power-meter bars
//   SlotRow   (48 px) — three interactive spell-slot buttons
//
// Additionally the HUD owns:
//   LowMoveWarning — full-screen red vignette, activates at ≤ 5 moves
//
// Public API (backward-compatible with pre-redesign GameScene):
//   updateMoves(n)                 — animate counter + warn state
//   updateScore(n)                 — rolling counter + pulse flash
//   updateEnergy(energy)           — smooth-fill all three bars
//   addSpellToSlot(spell)          — pop-in slot with icon + name
//   showObjectives(objectives)     — build/update objective bars
//   setComboState(state)           — show/update combo multiplier badge
//   clearComboState()              — hide combo badge
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTHS, SpellType } from '../config/Constants';
import type { ChargedEnergy } from '../game/spells/SpellSystem';
import type { FusedSpell }    from '../game/spells/SpellSystem';
import type { ComboState }    from '../game/scoring/ComboSystem';
import {
  ROW, LY, UI_COL, UI_DUR, TEXT, FONT,
  meterPct, hexStr,
} from './UIStyle';

// ── Internal types ────────────────────────────────────────────────────────────

interface AnimBar {
  fill:  Phaser.GameObjects.Graphics;
  proxy: { pct: number };
  x: number; y: number; w: number; h: number; r: number;
  color: number;
}

interface ObjRow {
  bar:       AnimBar;
  labelText: Phaser.GameObjects.Text;
  countText: Phaser.GameObjects.Text;
  doneIcon:  Phaser.GameObjects.Text;
  lastDone:  boolean;
}

interface SlotState {
  bg:    Phaser.GameObjects.Graphics;
  rim:   Phaser.GameObjects.Graphics;
  icon:  Phaser.GameObjects.Text | null;
  name:  Phaser.GameObjects.Text | null;
  glow:  Phaser.GameObjects.Graphics | null;
  spell: FusedSpell | null;
  cx: number;
  cy: number;
}

// ── Energy bar display config (light/mana/arcane → Charge Up theme) ──────────

const ENERGY_DISPLAY = [
  { key: 'light'  as keyof ChargedEnergy, icon: '⚡', label: 'CHARGE', color: UI_COL.charge  },
  { key: 'mana'   as keyof ChargedEnergy, icon: '🔥', label: 'HEAT',   color: UI_COL.heat    },
  { key: 'arcane' as keyof ChargedEnergy, icon: '📡', label: 'SIGNAL', color: UI_COL.signal  },
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// HUD
// ══════════════════════════════════════════════════════════════════════════════

export class HUD {
  private scene: Phaser.Scene;

  // ── Callbacks ─────────────────────────────────────────────────────────────
  private onPause:     () => void;
  private onSpellCast: (spell: SpellType) => void;

  // ── Score ─────────────────────────────────────────────────────────────────
  private scoreText!:  Phaser.GameObjects.Text;
  private scoreProxy = { value: 0 };

  // ── Combo badge ───────────────────────────────────────────────────────────
  private comboBadgeBg!:   Phaser.GameObjects.Graphics;
  private comboMultText!:  Phaser.GameObjects.Text;
  private comboVisible = false;

  // ── Moves ─────────────────────────────────────────────────────────────────
  private movesText!:     Phaser.GameObjects.Text;
  private movesRingBg!:   Phaser.GameObjects.Graphics;
  private movesRingFill!: Phaser.GameObjects.Graphics;
  private movesProxy = { pct: 1 };
  private movesMax = 22;

  // ── Objectives ────────────────────────────────────────────────────────────
  private objRows:   ObjRow[]  = [];
  private objBuilt = false;

  // ── Energy bars ───────────────────────────────────────────────────────────
  private energyBars: AnimBar[] = [];
  private energyFullTweens: (Phaser.Tweens.Tween | null)[] = [null, null, null];

  // ── Spell slots ───────────────────────────────────────────────────────────
  private slots: SlotState[] = [];
  private availableSpells: FusedSpell[] = [];

  // ── Low-move warning ──────────────────────────────────────────────────────
  private warnOverlay!:   Phaser.GameObjects.Graphics;
  private warnPulse:      Phaser.Tweens.Tween | null = null;
  private warnActive = false;

  // ─────────────────────────────────────────────────────────────────────────

  constructor(
    scene:       Phaser.Scene,
    levelId:     number,
    onPause:     () => void,
    onSpellCast: (spell: SpellType) => void,
  ) {
    this.scene       = scene;
    this.onPause     = onPause;
    this.onSpellCast = onSpellCast;
    this.movesMax    = 22;   // updated by first updateMoves() call

    this.buildBackground();
    this.buildTopBar(levelId);
    this.buildMovesRow();
    this.buildEnergyRow();
    this.buildSlotRow();
    this.buildWarnOverlay();
    // ObjectiveRow is built lazily from showObjectives()
  }

  // ── Public API ────────────────────────────────────────────────────────────

  updateMoves(moves: number): void {
    if (moves > this.movesMax) this.movesMax = moves;
    this.movesText.setText(`${moves}`);

    // Color state
    const color =
      moves <= 5  ? UI_COL.movesCrit :
      moves <= 10 ? UI_COL.movesLow  :
                    UI_COL.movesOk;
    this.movesText.setColor(hexStr(color));

    // Scale pop on each change
    this.scene.tweens.add({
      targets: this.movesText, scaleX: 1.22, scaleY: 1.22,
      duration: UI_DUR.movesPop, yoyo: true, ease: 'Back.easeOut',
    });

    // Shake on critical low
    if (moves <= 3 && moves > 0) this.shakeMoves();

    // Animated arc ring fill
    const targetPct = this.movesMax > 0 ? moves / this.movesMax : 0;
    this.scene.tweens.killTweensOf(this.movesProxy);
    this.scene.tweens.add({
      targets:  this.movesProxy,
      pct:      targetPct,
      duration: 300,
      ease:     'Power2',
      onUpdate: () => this.redrawMovesRing(color),
    });

    // Warning overlay
    if (moves <= 5 && !this.warnActive)       this.activateWarning();
    else if (moves > 5 && this.warnActive)    this.deactivateWarning();
  }

  updateScore(score: number): void {
    this.scene.tweens.killTweensOf(this.scoreProxy);
    this.scene.tweens.add({
      targets:  this.scoreProxy,
      value:    score,
      duration: UI_DUR.scoreRoll,
      ease:     'Power2.easeOut',
      onUpdate: () => {
        this.scoreText.setText(Math.round(this.scoreProxy.value).toLocaleString());
      },
      onComplete: () => {
        this.scoreText.setText(score.toLocaleString());
      },
    });

    // Pulse flash
    this.scene.tweens.add({
      targets: this.scoreText, scaleX: 1.18, scaleY: 1.18,
      duration: UI_DUR.scoreFlash, yoyo: true, ease: 'Back.easeOut',
    });
  }

  updateEnergy(energy: ChargedEnergy): void {
    ENERGY_DISPLAY.forEach(({ key }, i) => {
      const pct = meterPct(energy[key]);
      this.animateBar(this.energyBars[i]!, pct, i);
    });
  }

  addSpellToSlot(spell: FusedSpell): void {
    this.availableSpells.push(spell);
    const slotIdx = this.availableSpells.length - 1;
    if (slotIdx >= this.slots.length) return;

    const slot = this.slots[slotIdx]!;
    this.fillSlot(slot, spell, slotIdx);
  }

  showObjectives(objectives: Array<{ type: string; count: number; collected: number }>): void {
    if (!this.objBuilt) {
      this.buildObjectivesRow(objectives);
      this.objBuilt = true;
      return;
    }
    this.updateObjectiveRows(objectives);
  }

  /** Show the combo multiplier badge in the top bar. */
  setComboState(state: ComboState): void {
    if (state.tier === 'none') {
      this.clearComboState();
      return;
    }

    this.comboMultText.setText(state.multiplierFmt);
    this.comboMultText.setColor(hexStr(state.tierColor));

    if (!this.comboVisible) {
      this.comboVisible = true;
      this.comboBadgeBg.setVisible(true);
      this.comboMultText.setVisible(true);
      this.scene.tweens.add({
        targets: [this.comboBadgeBg, this.comboMultText],
        alpha: 1, y: `+=${6}`,
        duration: UI_DUR.comboBadgeIn,
        ease: 'Back.easeOut',
        from: 0,
      });
    }
  }

  /** Hide the combo multiplier badge. */
  clearComboState(): void {
    if (!this.comboVisible) return;
    this.comboVisible = false;
    this.scene.tweens.add({
      targets:  [this.comboBadgeBg, this.comboMultText],
      alpha:    0,
      duration: UI_DUR.comboBadgeOut,
      ease:     'Power2',
      onComplete: () => {
        this.comboBadgeBg.setVisible(false);
        this.comboMultText.setVisible(false);
      },
    });
  }

  // ── Section builders ──────────────────────────────────────────────────────

  private buildBackground(): void {
    const g = this.scene.add.graphics().setDepth(DEPTHS.ui);

    // Base panel fill
    g.fillStyle(UI_COL.panelBg, 0.98);
    g.fillRect(0, 0, GAME_WIDTH, ROW.slots.y + ROW.slots.h);

    // Per-row alternating tone for visual rhythm
    const rowDefs = [ROW.top, ROW.moves, ROW.obj, ROW.energy, ROW.slots];
    rowDefs.forEach((r, i) => {
      const shade = i % 2 === 0 ? UI_COL.rowDark : UI_COL.rowMid;
      g.fillStyle(shade, 0.5);
      g.fillRect(0, r.y, GAME_WIDTH, r.h);
    });

    // Row separator lines
    const sepColor  = UI_COL.divider;
    const sepBright = UI_COL.dividerBright;
    const sepY = [ROW.moves.y, ROW.obj.y, ROW.energy.y, ROW.slots.y];
    sepY.forEach((y, i) => {
      const bright = i === 0;   // first separator (below top bar) is bolder
      g.lineStyle(bright ? 1 : 0.5, bright ? sepBright : sepColor, bright ? 0.4 : 0.22);
      g.lineBetween(0, y, GAME_WIDTH, y);
    });

    // Bottom separator (board starts here)
    const boardTop = ROW.slots.y + ROW.slots.h;
    g.lineStyle(2, sepBright, 0.55);
    g.lineBetween(0, boardTop, GAME_WIDTH, boardTop);

    // Subtle left and right edge glow
    g.lineStyle(1, UI_COL.dividerBright, 0.08);
    g.lineBetween(0, 0, 0, boardTop);
    g.lineBetween(GAME_WIDTH, 0, GAME_WIDTH, boardTop);
  }

  private buildTopBar(levelId: number): void {
    const depth = DEPTHS.hud;
    const cy    = ROW.top.y + ROW.top.h / 2;

    // ── Pause button ─────────────────────────────────────────────────────────
    const pauseBg = this.scene.add.graphics().setDepth(DEPTHS.ui + 1);
    pauseBg.fillStyle(UI_COL.slotBg, 0.9);
    pauseBg.fillCircle(LY.pauseBtn.cx, cy, 16);
    pauseBg.lineStyle(1.5, UI_COL.dividerBright, 0.4);
    pauseBg.strokeCircle(LY.pauseBtn.cx, cy, 16);

    const pauseBtn = this.scene.add.text(
      LY.pauseBtn.cx, cy, '⏸', { ...TEXT.pauseIcon },
    ).setOrigin(0.5).setDepth(depth)
      .setInteractive({ useHandCursor: true });
    pauseBtn.on('pointerdown',  () => this.onPause());
    pauseBtn.on('pointerover',  () => this.scene.tweens.add({ targets: pauseBtn, scaleX: 1.2, scaleY: 1.2, duration: 80 }));
    pauseBtn.on('pointerout',   () => this.scene.tweens.add({ targets: pauseBtn, scaleX: 1,   scaleY: 1,   duration: 80 }));

    // ── Level label ──────────────────────────────────────────────────────────
    this.scene.add.text(
      LY.levelLabel.cx, cy, `Level ${levelId}`, { ...TEXT.levelLabel },
    ).setOrigin(0.5).setDepth(depth);

    // ── Score badge ──────────────────────────────────────────────────────────
    const { x: sx, y: sy, w: sw, h: sh, r: sr } = LY.scoreBadge;
    const scorePanelBg = this.scene.add.graphics().setDepth(DEPTHS.ui + 1);
    scorePanelBg.fillStyle(UI_COL.scoreBg, 0.9);
    scorePanelBg.fillRoundedRect(sx, sy, sw, sh, sr);
    scorePanelBg.lineStyle(1.5, UI_COL.scoreBorder, 0.5);
    scorePanelBg.strokeRoundedRect(sx, sy, sw, sh, sr);
    // Shimmer highlight
    scorePanelBg.fillStyle(0xffffff, 0.06);
    scorePanelBg.fillRoundedRect(sx + 3, sy + 2, sw - 6, sh * 0.38, sr - 2);

    this.scene.add.text(
      sx + sw / 2, sy + 9, 'SCORE', { ...TEXT.scoreLabel },
    ).setOrigin(0.5).setDepth(depth);

    this.scoreText = this.scene.add.text(
      sx + sw / 2, sy + sh - 10, '0', { ...TEXT.scoreNum },
    ).setOrigin(0.5).setDepth(depth);

    // ── Combo badge (hidden until a combo triggers) ──────────────────────────
    const { x: cbx, y: cby, w: cbw, h: cbh, r: cbr } = LY.comboBadge;
    this.comboBadgeBg = this.scene.add.graphics().setDepth(DEPTHS.ui + 1);
    this.comboBadgeBg.fillStyle(UI_COL.comboBg, 0.92);
    this.comboBadgeBg.fillRoundedRect(cbx, cby, cbw, cbh, cbr);
    this.comboBadgeBg.lineStyle(1.5, UI_COL.dividerBright, 0.5);
    this.comboBadgeBg.strokeRoundedRect(cbx, cby, cbw, cbh, cbr);
    this.comboBadgeBg.setAlpha(0).setVisible(false);

    this.comboMultText = this.scene.add.text(
      cbx + cbw / 2, cby + cbh / 2, '×1.0', { ...TEXT.comboMult },
    ).setOrigin(0.5).setDepth(depth).setAlpha(0).setVisible(false);
  }

  private buildMovesRow(): void {
    const { cx, cy, w, h, r } = LY.movesBadge;
    const depth = DEPTHS.hud;

    // Badge background
    const badgeBg = this.scene.add.graphics().setDepth(DEPTHS.ui + 1);
    badgeBg.fillStyle(UI_COL.scoreBg, 0.88);
    badgeBg.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
    badgeBg.lineStyle(2, UI_COL.dividerBright, 0.5);
    badgeBg.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
    // Gold top shimmer
    badgeBg.lineStyle(1, UI_COL.movesOk, 0.22);
    badgeBg.lineBetween(cx - w / 2 + 14, cy - h / 2 + 1, cx + w / 2 - 14, cy - h / 2 + 1);

    // Thin arc progress ring (drawn dynamically)
    this.movesRingBg   = this.scene.add.graphics().setDepth(DEPTHS.ui + 2);
    this.movesRingFill = this.scene.add.graphics().setDepth(DEPTHS.ui + 2);
    this.drawMovesArcBg();
    this.redrawMovesRing(UI_COL.movesOk);

    // "MOVES" label above number
    this.scene.add.text(cx, cy - 13, 'MOVES', { ...TEXT.movesLabel })
      .setOrigin(0.5).setDepth(depth);

    // Big counter
    this.movesText = this.scene.add.text(cx, cy + 4, '—', { ...TEXT.movesNum })
      .setOrigin(0.5).setDepth(depth);
  }

  private buildObjectivesRow(
    objectives: Array<{ type: string; count: number; collected: number }>,
  ): void {
    // Limit to 2 visible objectives
    const visible = objectives.slice(0, 2);
    const totalH  = visible.length * LY.objRowH;
    const startY  = ROW.obj.y + Math.round((ROW.obj.h - totalH) / 2);
    const depth   = DEPTHS.hud;
    const padL    = LY.pad;

    const ICON_MAP: Record<string, string> = {
      star: '⭐', potion: '💊', gem: '💎', book: '📖', crystal: '🔷',
    };
    const COLOR_MAP: Record<string, number> = {
      star: UI_COL.charge, potion: UI_COL.heat,
      gem: UI_COL.signal,  book: 0xff9966, crystal: UI_COL.signal,
    };

    visible.forEach((obj, i) => {
      const rowY   = startY + i * LY.objRowH;
      const rowCY  = rowY + LY.objRowH / 2;
      const barX   = padL + 24;
      const barW   = LY.objBarW;
      const barY   = rowCY - LY.objBarH / 2;
      const isDone = obj.collected >= obj.count;
      const barColor = isDone ? UI_COL.objBarDone : (COLOR_MAP[obj.type] ?? UI_COL.objBarFill);

      // Bar background track
      const bgG = this.scene.add.graphics().setDepth(DEPTHS.ui + 1);
      bgG.fillStyle(UI_COL.objBarBg, 0.85);
      bgG.fillRoundedRect(barX, barY, barW, LY.objBarH, 3);
      bgG.lineStyle(0.5, UI_COL.divider, 0.5);
      bgG.strokeRoundedRect(barX, barY, barW, LY.objBarH, 3);

      // Animated fill
      const fillG  = this.scene.add.graphics().setDepth(DEPTHS.ui + 2);
      const proxy  = { pct: 0 };
      const animBar: AnimBar = {
        fill: fillG, proxy,
        x: barX, y: barY, w: barW, h: LY.objBarH, r: 3,
        color: barColor,
      };

      // Icon
      const icon = ICON_MAP[obj.type] ?? '◆';
      this.scene.add.text(padL + 10, rowCY, icon, { fontSize: '11px' })
        .setOrigin(0.5).setDepth(depth);

      // Label
      const labelText = this.scene.add.text(
        barX + 2, rowCY - 1,
        `${obj.type[0].toUpperCase()}${obj.type.slice(1)}`,
        { ...TEXT.objLabel },
      ).setOrigin(0, 0.5).setDepth(depth);

      // Count text (right-aligned)
      const countX  = barX + barW + 6;
      const countText = this.scene.add.text(
        countX, rowCY,
        `${obj.collected}/${obj.count}`,
        { ...TEXT.objCount },
      ).setOrigin(0, 0.5).setDepth(depth);

      // Completion tick (hidden initially)
      const doneIcon = this.scene.add.text(
        barX + barW - 2, rowCY, '✓',
        { fontFamily: FONT.display, fontSize: '10px', color: hexStr(UI_COL.objBarDone) },
      ).setOrigin(1, 0.5).setDepth(depth).setAlpha(0);

      this.objRows.push({ bar: animBar, labelText, countText, doneIcon, lastDone: false });

      // Animate bar in
      const initPct = isDone ? 1 : obj.collected / obj.count;
      this.animateBar(animBar, initPct);
      if (isDone) this.markObjDone(this.objRows[this.objRows.length - 1]!);
    });
  }

  private buildEnergyRow(): void {
    const depth = DEPTHS.hud;

    ENERGY_DISPLAY.forEach(({ icon, label, color }, i) => {
      const colCX = LY.energyBarX(i) + LY.energyBarW / 2;
      const barX  = LY.energyBarX(i);
      const barY  = LY.energyBarY;
      const lblY  = LY.energyLblY;

      // Column label with icon
      this.scene.add.text(colCX, lblY, `${icon} ${label}`, {
        ...TEXT.energyLabel,
        color: hexStr(color),
      }).setOrigin(0.5, 0).setDepth(depth);

      // Track background
      const bgG = this.scene.add.graphics().setDepth(DEPTHS.ui + 1);
      bgG.fillStyle(UI_COL.energyBarBg, 1);
      bgG.fillRoundedRect(barX, barY, LY.energyBarW, LY.energyBarH, LY.energyBarR);
      bgG.lineStyle(1, color, 0.25);
      bgG.strokeRoundedRect(barX, barY, LY.energyBarW, LY.energyBarH, LY.energyBarR);

      // Segment ticks (at 25%, 50%, 75%)
      const ticks = this.scene.add.graphics().setDepth(DEPTHS.ui + 3);
      ticks.lineStyle(0.5, 0xffffff, 0.12);
      [0.25, 0.5, 0.75].forEach(t => {
        const tx = barX + LY.energyBarW * t;
        ticks.lineBetween(tx, barY, tx, barY + LY.energyBarH);
      });

      // Animated fill
      const fillG = this.scene.add.graphics().setDepth(DEPTHS.ui + 2);
      const proxy = { pct: 0 };
      this.energyBars.push({
        fill: fillG, proxy,
        x: barX, y: barY,
        w: LY.energyBarW, h: LY.energyBarH, r: LY.energyBarR,
        color,
      });
    });
  }

  private buildSlotRow(): void {
    const slotCount = LY.slotXs.length;

    for (let i = 0; i < slotCount; i++) {
      const cx = LY.slotXs[i]!;
      const cy = LY.slotCy;
      const r  = LY.slotR;

      // Slot background disc
      const bg = this.scene.add.graphics().setDepth(DEPTHS.ui + 1);
      bg.fillStyle(UI_COL.slotBg, 0.95);
      bg.fillCircle(cx, cy, r);

      // Rim ring (redrawn when active)
      const rim = this.scene.add.graphics().setDepth(DEPTHS.ui + 2);
      this.drawSlotRim(rim, cx, cy, r, false);

      // Slot number (placeholder)
      const emptyLbl = this.scene.add.text(cx, cy, `${i + 1}`, {
        fontFamily: FONT.body, fontSize: '14px',
        color: '#331166', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(DEPTHS.hud);

      this.slots.push({
        bg, rim, icon: emptyLbl, name: null, glow: null,
        spell: null, cx, cy,
      });
    }
  }

  private buildWarnOverlay(): void {
    // Full-screen red vignette (edges only — 4 gradient rects)
    const g = this.scene.add.graphics()
      .setDepth(DEPTHS.overlay - 2)
      .setAlpha(0)
      .setVisible(false);

    // Simple approach: full-screen tinted rect at low alpha
    g.fillStyle(UI_COL.warnRed, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Edge intensifier strips
    const edgeW = 32;
    g.fillStyle(UI_COL.warnRed, 1);
    g.fillRect(0,                       0,         edgeW,  GAME_HEIGHT); // left
    g.fillRect(GAME_WIDTH - edgeW,      0,         edgeW,  GAME_HEIGHT); // right
    g.fillRect(0,                       0,         GAME_WIDTH, edgeW);   // top
    g.fillRect(0, GAME_HEIGHT - edgeW,  GAME_WIDTH, edgeW);              // bottom

    this.warnOverlay = g;
  }

  // ── Warning state ─────────────────────────────────────────────────────────

  private activateWarning(): void {
    this.warnActive = true;
    this.warnOverlay.setVisible(true);
    this.scene.tweens.add({
      targets: this.warnOverlay, alpha: 0.15,
      duration: UI_DUR.warnIn, ease: 'Power2',
    });

    // Pulse in/out repeatedly
    this.warnPulse?.stop();
    this.warnPulse = this.scene.tweens.add({
      targets:  this.warnOverlay,
      alpha:    0.25,
      duration: UI_DUR.warnPulse,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
      delay:    UI_DUR.warnIn,
    });

    // Pulse the ring in red
    this.redrawMovesRing(UI_COL.movesCrit);
  }

  private deactivateWarning(): void {
    this.warnActive = false;
    this.warnPulse?.stop();
    this.warnPulse = null;
    this.scene.tweens.add({
      targets:  this.warnOverlay,
      alpha:    0,
      duration: UI_DUR.warnOut,
      ease:     'Power2',
      onComplete: () => this.warnOverlay.setVisible(false),
    });
    this.drawMovesArcBg();
  }

  // ── Moves arc ring ────────────────────────────────────────────────────────

  private drawMovesArcBg(): void {
    const { cx, cy } = LY.movesBadge;
    const r = LY.movesBadge.r + 18;
    this.movesRingBg.clear();
    this.movesRingBg.lineStyle(3, UI_COL.rowDark, 0.9);
    this.movesRingBg.strokeCircle(cx, cy, r);
    this.movesRingBg.lineStyle(3, UI_COL.divider, 0.45);
    this.movesRingBg.strokeCircle(cx, cy, r);
  }

  private redrawMovesRing(color: number): void {
    const { cx, cy, r: br } = LY.movesBadge;
    const r    = br + 18;
    const pct  = this.movesProxy.pct;
    const span = Math.max(0, Math.min(pct * Math.PI * 2, Math.PI * 2));

    this.movesRingFill.clear();
    if (span < 0.05) return;
    this.movesRingFill.lineStyle(3, color, 0.92);
    // Draw arc manually via line segments (Phaser's arc is fill-only for clean lines)
    const startAngle = -Math.PI / 2;   // top of circle
    const steps = Math.max(3, Math.round(span * 16));
    for (let s = 0; s < steps; s++) {
      const a1 = startAngle + (s / steps) * span;
      const a2 = startAngle + ((s + 1) / steps) * span;
      this.movesRingFill.lineBetween(
        cx + Math.cos(a1) * r, cy + Math.sin(a1) * r,
        cx + Math.cos(a2) * r, cy + Math.sin(a2) * r,
      );
    }
  }

  // ── Animated bar ──────────────────────────────────────────────────────────

  private animateBar(bar: AnimBar, toPct: number, energyIdx?: number): void {
    const from = bar.proxy.pct;

    this.scene.tweens.killTweensOf(bar.proxy);
    this.scene.tweens.add({
      targets:  bar.proxy,
      pct:      toPct,
      duration: UI_DUR.barFill,
      ease:     'Power2.easeOut',
      onUpdate: () => this.redrawBar(bar),
      onComplete: () => {
        this.redrawBar(bar);
        // Full-charge glow pulse for energy bars
        if (energyIdx !== undefined && toPct >= 1 && from < 1) {
          this.startEnergyFullPulse(energyIdx, bar);
        } else if (energyIdx !== undefined && toPct < 1) {
          this.stopEnergyFullPulse(energyIdx);
        }
      },
    });
  }

  private redrawBar(bar: AnimBar): void {
    const fillW = Math.max(0, bar.w * bar.proxy.pct);
    bar.fill.clear();
    if (fillW < 2) return;

    bar.fill.fillStyle(bar.color, 0.9);
    bar.fill.fillRoundedRect(bar.x, bar.y, fillW, bar.h, bar.r);

    // Shine highlight (top third)
    bar.fill.fillStyle(0xffffff, 0.28);
    bar.fill.fillRoundedRect(bar.x + 2, bar.y + 1, fillW - 4, bar.h * 0.38, bar.r);

    // Full-charge white overlay
    if (bar.proxy.pct >= 1) {
      bar.fill.fillStyle(0xffffff, 0.18);
      bar.fill.fillRoundedRect(bar.x, bar.y, bar.w, bar.h, bar.r);
    }
  }

  private startEnergyFullPulse(idx: number, bar: AnimBar): void {
    this.stopEnergyFullPulse(idx);
    const glowProxy = { alpha: 0.18 };
    this.energyFullTweens[idx] = this.scene.tweens.add({
      targets:  glowProxy,
      alpha:    0.45,
      duration: UI_DUR.barFullPulse,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
      onUpdate: () => {
        if (bar.proxy.pct < 1) return;
        bar.fill.clear();
        const fillW = bar.w;
        bar.fill.fillStyle(bar.color, 0.9);
        bar.fill.fillRoundedRect(bar.x, bar.y, fillW, bar.h, bar.r);
        bar.fill.fillStyle(0xffffff, glowProxy.alpha);
        bar.fill.fillRoundedRect(bar.x, bar.y, fillW, bar.h, bar.r);
      },
    });
  }

  private stopEnergyFullPulse(idx: number): void {
    this.energyFullTweens[idx]?.stop();
    this.energyFullTweens[idx] = null;
  }

  // ── Objective rows ────────────────────────────────────────────────────────

  private updateObjectiveRows(
    objectives: Array<{ type: string; count: number; collected: number }>,
  ): void {
    const visible = objectives.slice(0, 2);
    visible.forEach((obj, i) => {
      const row = this.objRows[i];
      if (!row) return;

      const isDone  = obj.collected >= obj.count;
      const newPct  = isDone ? 1 : Math.min(obj.collected / obj.count, 1);
      const justDone = isDone && !row.lastDone;

      // Update bar color for done state
      if (isDone) row.bar.color = UI_COL.objBarDone;

      this.animateBar(row.bar, newPct);

      row.countText.setText(`${obj.collected}/${obj.count}`);
      row.countText.setColor(isDone ? hexStr(UI_COL.objCountDone) : hexStr(UI_COL.objCount));

      if (justDone) {
        row.lastDone = true;
        this.markObjDone(row);
      }
    });
  }

  private markObjDone(row: ObjRow): void {
    // Green flash on bar
    row.bar.color = UI_COL.objBarDone;
    this.redrawBar(row.bar);

    // Tick mark fade-in
    row.doneIcon.setAlpha(0).setVisible(true);
    this.scene.tweens.add({
      targets: row.doneIcon, alpha: 1,
      duration: UI_DUR.objComplete, ease: 'Power2',
    });

    // Label dim
    row.labelText.setAlpha(0.55);

    // Brief scale celebration
    this.scene.tweens.add({
      targets: row.countText, scaleX: 1.25, scaleY: 1.25,
      duration: 120, yoyo: true, ease: 'Back.easeOut',
    });
  }

  // ── Spell slots ───────────────────────────────────────────────────────────

  private fillSlot(slot: SlotState, spell: FusedSpell, slotIdx: number): void {
    const { cx, cy } = slot;
    const r          = LY.slotR;
    const depth      = DEPTHS.hud;
    const hexColor   = hexStr(spell.definition.color);

    // Clear old placeholder icon
    slot.icon?.destroy();
    slot.name?.destroy();
    slot.glow?.destroy();
    slot.icon = null;
    slot.name = null;
    slot.glow = null;

    // Glow ring behind slot
    const glow = this.scene.add.graphics().setDepth(DEPTHS.ui);
    glow.lineStyle(8, spell.definition.color, 0.25);
    glow.strokeCircle(cx, cy, r + 6);
    glow.lineStyle(4, spell.definition.color, 0.18);
    glow.strokeCircle(cx, cy, r + 11);
    slot.glow = glow;

    // Redraw rim as active
    this.drawSlotRim(slot.rim, cx, cy, r, true, spell.definition.color);

    // Icon
    const iconText = this.scene.add.text(cx, cy - 4, spell.definition.icon, {
      ...TEXT.slotIcon,
    }).setOrigin(0.5).setDepth(depth);
    slot.icon = iconText;

    // Name badge
    const nameText = this.scene.add.text(
      cx, cy + r + 7,
      spell.definition.name.split(' ')[0] ?? spell.definition.name,
      { ...TEXT.slotName, color: hexColor },
    ).setOrigin(0.5).setDepth(depth);
    slot.name = nameText;

    // Pop-in animation
    const targets = [slot.bg, slot.rim, iconText, nameText, glow];
    targets.forEach(t => { if (t) { (t as Phaser.GameObjects.GameObject & { setScale: (n: number) => void }).setScale?.(0.3); } });
    this.scene.tweens.add({
      targets, scaleX: 1, scaleY: 1,
      duration: UI_DUR.slotPopIn, ease: 'Back.easeOut',
    });

    slot.spell = spell;

    // Make interactive
    slot.bg.setInteractive(
      new Phaser.Geom.Circle(cx, cy, r + 4),
      Phaser.Geom.Circle.Contains,
    );
    slot.bg.on('pointerdown', () => this.onSlotTap(slotIdx));
    slot.bg.on('pointerover', () => {
      this.scene.tweens.add({ targets: slot.bg, scaleX: 1.1, scaleY: 1.1, duration: 80 });
    });
    slot.bg.on('pointerout',  () => {
      this.scene.tweens.add({ targets: slot.bg, scaleX: 1, scaleY: 1, duration: 80 });
    });

    // Idle glow pulse
    this.scene.tweens.add({
      targets: glow, alpha: 0.55,
      duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  private onSlotTap(slotIdx: number): void {
    const slot = this.slots[slotIdx];
    if (!slot?.spell) return;

    const spell = slot.spell;
    const idx   = this.availableSpells.findIndex(s => s.spell === spell.spell);
    if (idx !== -1) this.availableSpells.splice(idx, 1);

    // Pop-out animation
    const targets = [slot.bg, slot.rim, slot.icon, slot.name, slot.glow].filter(Boolean);
    this.scene.tweens.add({
      targets, scaleX: 1.15, scaleY: 1.15,
      duration: 60, ease: 'Power2',
      onComplete: () => {
        this.scene.tweens.add({
          targets, scaleX: 0, scaleY: 0,
          duration: UI_DUR.slotPopOut, ease: 'Back.easeIn',
          onComplete: () => this.clearSlot(slotIdx),
        });
      },
    });

    this.onSpellCast(spell.spell);
  }

  private clearSlot(idx: number): void {
    const slot = this.slots[idx];
    if (!slot) return;

    slot.icon?.destroy();
    slot.name?.destroy();
    slot.glow?.destroy();
    slot.icon  = null;
    slot.name  = null;
    slot.glow  = null;
    slot.spell = null;

    // Reset rim
    slot.bg.setScale(1);
    slot.rim.setScale(1);
    this.drawSlotRim(slot.rim, slot.cx, slot.cy, LY.slotR, false);
    slot.bg.disableInteractive();

    // Put placeholder number back
    const lbl = this.scene.add.text(slot.cx, slot.cy, `${idx + 1}`, {
      fontFamily: FONT.body, fontSize: '14px',
      color: '#331166', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(DEPTHS.hud);
    slot.icon = lbl;
    slot.bg.setScale(1);
  }

  private drawSlotRim(
    g:      Phaser.GameObjects.Graphics,
    cx:     number,
    cy:     number,
    r:      number,
    active: boolean,
    color?: number,
  ): void {
    g.clear();
    const rimColor = active ? (color ?? UI_COL.slotRimActive) : UI_COL.slotRim;
    const alpha    = active ? 0.9 : 0.5;
    const width    = active ? 3   : 1.5;

    g.lineStyle(width + 4, rimColor, 0.08);
    g.strokeCircle(cx, cy, r);
    g.lineStyle(width, rimColor, alpha);
    g.strokeCircle(cx, cy, r);
  }

  // ── Move counter shake ────────────────────────────────────────────────────

  private shakeMoves(): void {
    const orig = this.movesText.x;
    this.scene.tweens.add({
      targets: this.movesText,
      x: orig + 5,
      duration: UI_DUR.movesShake, yoyo: true,
      repeat: 2, ease: 'Power1',
      onComplete: () => { this.movesText.x = orig; },
    });
  }
}
