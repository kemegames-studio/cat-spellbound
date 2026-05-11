// ─────────────────────────────────────────────────────────────────────────────
// UIStyle.ts
//
// Central styling tokens for the HUD layer.
//
// Design philosophy:
//   • Every magic number in UI code traces back to a constant here.
//   • Layout constants are derived from GAME_WIDTH / BOARD_OFFSET_Y so the
//     HUD naturally adapts if those master values change.
//   • Row heights sum to BOARD_OFFSET_Y (220 px) exactly.
//   • Text style objects are partial Phaser TextStyle records — spread them
//     into scene.add.text() calls for zero-duplication.
//
// Safe-area support:
//   Set SAFE_TOP to the device's top inset (e.g. 44 for iPhone notch) when
//   the Phaser canvas sits flush with the screen edge.  All row positions are
//   offset by this value automatically.
// ─────────────────────────────────────────────────────────────────────────────

import type Phaser from 'phaser';
import { PALETTE, GAME_WIDTH, BOARD_OFFSET_Y, SPELL_CHARGE_NEEDED } from '../config/Constants';

// ── Safe-area ─────────────────────────────────────────────────────────────────

/** CSS-style top inset.  Increase for notch-bearing devices. */
export const SAFE_TOP = 0;

// ── Typography ────────────────────────────────────────────────────────────────

export const FONT = {
  display: 'Georgia, serif',
  body:    'Arial, sans-serif',
} as const;

// ── Layout constants ──────────────────────────────────────────────────────────

const W = GAME_WIDTH;       // 390
const H = BOARD_OFFSET_Y;   // 220
const P = 14;               // horizontal gutter

/** Row bands — heights sum to H (220 px). */
export const ROW = {
  top:    { y: SAFE_TOP + 0,   h: 48 },   // pause | level | score + combo
  moves:  { y: SAFE_TOP + 48,  h: 42 },   // moves counter
  obj:    { y: SAFE_TOP + 90,  h: 42 },   // objective progress rows
  energy: { y: SAFE_TOP + 132, h: 40 },   // three power bars
  slots:  { y: SAFE_TOP + 172, h: 48 },   // spell slots
} as const;

/** Core layout measurements derived from the grid above. */
export const LY = {
  w:    W,
  h:    H,
  pad:  P,

  // ── Top bar ───────────────────────────────────────────────────────────────
  pauseBtn:    { cx: P + 18, cy: ROW.top.y + 24 },
  levelLabel:  { cx: W / 2,  cy: ROW.top.y + 24 },

  scoreBadge:  { x: W - P - 94, y: ROW.top.y + 6,  w: 94, h: 36, r: 10 },
  comboBadge:  { x: W - P - 94 - 6 - 60, y: ROW.top.y + 8, w: 58, h: 28, r: 14 },

  // ── Moves row ─────────────────────────────────────────────────────────────
  movesBadge:  {
    cx: W / 2,
    cy: ROW.moves.y + ROW.moves.h / 2,
    w: 92, h: 34, r: 17,
  },

  // ── Objectives row ────────────────────────────────────────────────────────
  objBarW:   W - P * 2 - 80,   // bar width (leaves room for icon + counter)
  objBarH:   6,
  objRowH:   18,                // height per objective item

  // ── Energy row ────────────────────────────────────────────────────────────
  energyColW:  Math.round(W / 3),   // 130 px per column
  energyBarW:  90,
  energyBarH:  8,
  energyBarR:  4,
  // Each bar's left edge: colW*i + (colW - barW)/2
  energyBarX:  (i: number) => Math.round((W / 3) * i + ((W / 3) - 90) / 2),
  energyBarY:  ROW.energy.y + 26,
  energyLblY:  ROW.energy.y + 7,
  energyIconY: ROW.energy.y + 7,

  // ── Spell-slot row ────────────────────────────────────────────────────────
  slotR:  20,
  slotCy: ROW.slots.y + Math.round(ROW.slots.h / 2),
  slotXs: [
    Math.round(W / 6),
    Math.round(W / 2),
    Math.round((W * 5) / 6),
  ] as [number, number, number],
} as const;

// ── Colours ───────────────────────────────────────────────────────────────────

export const UI_COL = {
  // Background
  panelBg:      0x0c0420,
  rowDark:      0x0f0628,
  rowMid:       0x14082e,
  divider:      0x231050,
  dividerBright: PALETTE.purpleLight,

  // Score badge
  scoreBg:      0x1a0a3a,
  scoreBorder:  PALETTE.purpleLight,
  scoreText:    PALETTE.gold,
  scoreFlash:   PALETTE.white,
  scoreLabel:   PALETTE.purplePale,

  // Combo badge
  comboBg:      0x2a0a4a,

  // Moves states  (changes based on remaining moves)
  movesOk:      PALETTE.gold,    // > 10
  movesLow:     0xff8800,        // > 5 && ≤ 10
  movesCrit:    0xff3344,        // ≤ 5
  movesGlow:    0xff2200,

  // Objectives
  objLabel:     PALETTE.purplePale,
  objCount:     PALETTE.gold,
  objCountDone: PALETTE.green,
  objBarBg:     0x110633,
  objBarFill:   PALETTE.purpleLight,
  objBarDone:   PALETTE.green,

  // Energy / power bars (mapped light→charge, mana→heat, arcane→signal)
  charge:       PALETTE.gold,
  heat:         0xff6644,
  signal:       PALETTE.cyan,
  energyBarBg:  0x0d0525,
  energyBarBgBorder: PALETTE.purpleLight,
  energyFull:   PALETTE.white,

  // Spell slots
  slotBg:       0x160830,
  slotRim:      0x2a1260,
  slotRimActive: PALETTE.purpleLight,
  slotGlow:     PALETTE.purplePale,

  // Warning vignette
  warnRed:      0xff2200,

  // Pause button
  pauseIcon:    PALETTE.purplePale,
} as const;

// ── Animation durations (ms) ──────────────────────────────────────────────────

export const UI_DUR = {
  scoreRoll:     500,
  scoreFlash:     80,
  barFill:       350,
  barFullPulse:  900,
  slotPopIn:     280,
  slotPopOut:    200,
  warnIn:        450,
  warnPulse:     800,
  warnOut:       600,
  objBarFill:    400,
  objComplete:   350,
  comboBadgeIn:  180,
  comboBadgeOut: 150,
  movesPop:      100,
  movesShake:     50,
} as const;

// ── Text-style helpers ────────────────────────────────────────────────────────
// Each object is a valid Phaser.Types.GameObjects.Text.TextStyle fragment.
// Spread into scene.add.text(x, y, str, { ...TS.foo }).

type TS = Phaser.Types.GameObjects.Text.TextStyle;

export const TEXT: Record<string, TS> = {
  pauseIcon: {
    fontFamily: FONT.body, fontSize: '20px',
    color: `#${UI_COL.pauseIcon.toString(16).padStart(6, '0')}`,
  },
  levelLabel: {
    fontFamily: FONT.display, fontSize: '14px', fontStyle: 'bold',
    color: '#c890ff', stroke: '#000000', strokeThickness: 2,
  },
  rowLabel: {
    fontFamily: FONT.body, fontSize: '9px',
    color: '#9d6fff',
  },
  scoreLabel: {
    fontFamily: FONT.body, fontSize: '8px',
    color: '#9d6fff',
  },
  scoreNum: {
    fontFamily: FONT.display, fontSize: '18px', fontStyle: 'bold',
    color: '#ffd700',
  },
  comboMult: {
    fontFamily: FONT.display, fontSize: '12px', fontStyle: 'bold',
    color: '#ffd700', stroke: '#000000', strokeThickness: 2,
  },
  movesNum: {
    fontFamily: FONT.display, fontSize: '26px', fontStyle: 'bold',
    color: '#ffd700', stroke: '#0c0420', strokeThickness: 4,
  },
  movesLabel: {
    fontFamily: FONT.body, fontSize: '8px',
    color: '#9d6fff',
  },
  objLabel: {
    fontFamily: FONT.body, fontSize: '10px',
    color: '#9d6fff', stroke: '#000000', strokeThickness: 1,
  },
  objCount: {
    fontFamily: FONT.body, fontSize: '10px', fontStyle: 'bold',
    color: '#ffd700', stroke: '#000000', strokeThickness: 1,
  },
  energyLabel: {
    fontFamily: FONT.body, fontSize: '9px',
    color: '#9d6fff',
  },
  slotEmpty: {
    fontFamily: FONT.body, fontSize: '8px',
    color: '#553399',
  },
  slotIcon: {
    fontFamily: FONT.body, fontSize: '19px',
  },
  slotName: {
    fontFamily: FONT.body, fontSize: '8px',
    color: '#9d6fff',
  },
};

// ── Re-exported helpers used by HUD ──────────────────────────────────────────

/** Convert a 0–N meter value to a 0–1 fill fraction. */
export function meterPct(value: number): number {
  return Math.min(Math.max(value / SPELL_CHARGE_NEEDED, 0), 1);
}

/** Hex color number → CSS "#rrggbb" string. */
export function hexStr(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
