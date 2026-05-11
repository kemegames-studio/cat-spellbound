import Phaser from 'phaser';
import { PALETTE, TILE_COLORS, TILE_SIZE, TileType } from '../config/Constants';
import { fillStar } from '../utils/GraphicsUtils';
import { SCENE } from './SceneKeys';

// ─────────────────────────────────────────────────────────────────────────────
// BootScene
//
// Runs once at startup, never revisited.
// Responsibilities:
//   1. Generate all procedural textures (tiles, UI, particles, backgrounds,
//      cat sprite) synchronously via Graphics.generateTexture().
//   2. Hand off immediately to the splash pipeline.
//
// There is no visible UI here — the background colour from GameConfig
// (PALETTE.bgDeep) fills the screen while generation runs, which completes
// within a single frame.  No camera fade is needed or desirable.
// ─────────────────────────────────────────────────────────────────────────────

export class BootScene extends Phaser.Scene {
  constructor() { super({ key: SCENE.Boot }); }

  create(): void {
    this.generateTileTextures();
    this.generateUITextures();
    this.generateParticleTextures();
    this.generateBgTexture();
    this.generateCatTexture();
    this.scene.start(SCENE.KemeSplash);
  }

  private generateTileTextures(): void {
    const types: TileType[] = ['star', 'potion', 'gem', 'book', 'crystal'];
    const size = TILE_SIZE;

    types.forEach((type) => {
      const key = `tile_${type}`;
      const g = this.add.graphics();

      const color = TILE_COLORS[type];
      const darkColor = Phaser.Display.Color.IntegerToColor(color);
      darkColor.darken(30);

      // Shadow
      g.fillStyle(0x000000, 0.35);
      g.fillRoundedRect(3, 5, size - 2, size - 2, 12);

      // Tile body
      g.fillStyle(darkColor.color, 1);
      g.fillRoundedRect(1, 1, size - 2, size - 2, 12);
      g.fillStyle(color, 1);
      g.fillRoundedRect(1, 1, size - 2, size - 4, 12);

      // Shine
      const lightColor = Phaser.Display.Color.IntegerToColor(color);
      lightColor.lighten(50);
      g.fillStyle(lightColor.color, 0.55);
      g.fillRoundedRect(6, 5, size - 14, 14, 6);

      // Inner glow ring
      g.lineStyle(2, color, 0.8);
      g.strokeRoundedRect(3, 3, size - 6, size - 6, 10);

      this.drawTileIcon(g, type, color, size);
      g.generateTexture(key, size, size);
      g.destroy();

      // Selected state
      const gs = this.add.graphics();
      gs.fillStyle(0xffffff, 0.15);
      gs.fillRoundedRect(0, 0, size, size, 12);
      gs.lineStyle(3, PALETTE.gold, 1);
      gs.strokeRoundedRect(1, 1, size - 2, size - 2, 12);
      gs.generateTexture(`tile_${type}_sel`, size, size);
      gs.destroy();

      // Cursed variant
      const gc = this.add.graphics();
      gc.fillStyle(0x220033, 1);
      gc.fillRoundedRect(1, 1, size - 2, size - 2, 12);
      gc.lineStyle(2, 0x660099, 0.9);
      gc.strokeRoundedRect(2, 2, size - 4, size - 4, 10);
      gc.fillStyle(0x440066, 0.5);
      gc.fillCircle(size / 2, size / 2, size * 0.3);
      gc.generateTexture(`tile_${type}_cursed`, size, size);
      gc.destroy();
    });

    // Portal tile
    const gp = this.add.graphics();
    gp.fillStyle(PALETTE.greenDark, 1);
    gp.fillRoundedRect(1, 1, size - 2, size - 2, 12);
    gp.fillStyle(PALETTE.green, 0.7);
    gp.fillCircle(size / 2, size / 2, size * 0.35);
    gp.lineStyle(2, PALETTE.green, 1);
    gp.strokeCircle(size / 2, size / 2, size * 0.38);
    gp.lineStyle(2, 0x00ffcc, 0.6);
    gp.strokeRoundedRect(2, 2, size - 4, size - 4, 10);
    gp.generateTexture('tile_portal', size, size);
    gp.destroy();

    // Sleeping cat blocker tile
    const gcat = this.add.graphics();
    gcat.fillStyle(0x3d2060, 1);
    gcat.fillRoundedRect(1, 1, size - 2, size - 2, 12);
    gcat.lineStyle(2, PALETTE.purplePale, 0.6);
    gcat.strokeRoundedRect(2, 2, size - 4, size - 4, 10);
    gcat.fillStyle(PALETTE.purplePale, 0.8);
    gcat.fillCircle(size - 12, 12, 5);
    gcat.generateTexture('tile_sleeping_cat', size, size);
    gcat.destroy();
  }

  private drawTileIcon(g: Phaser.GameObjects.Graphics, type: TileType, color: number, size: number): void {
    const cx = size / 2;
    const cy = size / 2;
    const light = Phaser.Display.Color.IntegerToColor(color);
    light.lighten(70);

    switch (type) {
      case 'star': {
        g.fillStyle(light.color, 0.9);
        fillStar(g, cx, cy, 5, 15, 7, 0);
        g.fillStyle(0xffffff, 0.4);
        g.fillCircle(cx - 4, cy - 5, 3);
        break;
      }
      case 'potion': {
        g.fillStyle(light.color, 0.85);
        g.fillEllipse(cx, cy + 5, 18, 16);
        g.fillRect(cx - 4, cy - 8, 8, 12);
        g.fillRect(cx - 3, cy - 12, 6, 5);
        g.fillStyle(0xffffff, 0.5);
        g.fillCircle(cx + 3, cy + 4, 3);
        g.fillCircle(cx - 3, cy + 7, 2);
        break;
      }
      case 'gem': {
        g.fillStyle(light.color, 0.9);
        const pts = [
          { x: cx, y: cy - 14 }, { x: cx + 11, y: cy - 4 },
          { x: cx + 11, y: cy + 4 }, { x: cx, y: cy + 14 },
          { x: cx - 11, y: cy + 4 }, { x: cx - 11, y: cy - 4 },
        ];
        g.fillPoints(pts, true);
        g.fillStyle(0xffffff, 0.45);
        g.fillTriangle(cx, cy - 14, cx + 11, cy - 4, cx - 11, cy - 4);
        break;
      }
      case 'book': {
        g.fillStyle(light.color, 0.85);
        g.fillRoundedRect(cx - 12, cy - 9, 24, 18, 2);
        g.lineStyle(1.5, 0xffffff, 0.5);
        g.lineBetween(cx, cy - 9, cx, cy + 9);
        g.lineStyle(1, 0xffffff, 0.3);
        g.lineBetween(cx - 9, cy - 3, cx - 2, cy - 3);
        g.lineBetween(cx - 9, cy + 1, cx - 2, cy + 1);
        g.lineBetween(cx + 2, cy - 3, cx + 9, cy - 3);
        g.lineBetween(cx + 2, cy + 1, cx + 9, cy + 1);
        break;
      }
      case 'crystal': {
        g.fillStyle(light.color, 0.9);
        const cpts = [
          { x: cx, y: cy - 15 }, { x: cx + 8, y: cy - 3 },
          { x: cx + 10, y: cy + 12 }, { x: cx, y: cy + 8 },
          { x: cx - 10, y: cy + 12 }, { x: cx - 8, y: cy - 3 },
        ];
        g.fillPoints(cpts, true);
        g.fillStyle(0xffffff, 0.4);
        g.fillTriangle(cx - 4, cy - 14, cx + 2, cy - 14, cx, cy + 4);
        break;
      }
    }
  }

  private generateUITextures(): void {
    // Panel background
    const pg = this.add.graphics();
    pg.fillStyle(PALETTE.bgLight, 0.95);
    pg.fillRoundedRect(0, 0, 300, 80, 16);
    pg.lineStyle(2, PALETTE.purpleLight, 0.7);
    pg.strokeRoundedRect(0, 0, 300, 80, 16);
    pg.generateTexture('ui_panel', 300, 80);
    pg.destroy();

    // Button green
    const bg = this.add.graphics();
    bg.fillStyle(0x22aa44, 1);
    bg.fillRoundedRect(0, 0, 200, 56, 28);
    bg.lineStyle(3, 0x44ff88, 0.8);
    bg.strokeRoundedRect(1, 1, 198, 54, 27);
    bg.fillStyle(0xffffff, 0.15);
    bg.fillRoundedRect(8, 6, 184, 22, 12);
    bg.generateTexture('btn_green', 200, 56);
    bg.destroy();

    // Spell slot
    const ss = this.add.graphics();
    ss.fillStyle(PALETTE.bgDeep, 0.9);
    ss.fillCircle(32, 32, 32);
    ss.lineStyle(3, PALETTE.purpleLight, 0.6);
    ss.strokeCircle(32, 32, 31);
    ss.generateTexture('spell_slot', 64, 64);
    ss.destroy();

    // Spell slot active
    const sa = this.add.graphics();
    sa.fillStyle(PALETTE.bgDeep, 0.9);
    sa.fillCircle(32, 32, 32);
    sa.lineStyle(3, PALETTE.gold, 1);
    sa.strokeCircle(32, 32, 31);
    sa.fillStyle(PALETTE.gold, 0.2);
    sa.fillCircle(32, 32, 27);
    sa.generateTexture('spell_slot_active', 64, 64);
    sa.destroy();

    // Coin icon
    const ci = this.add.graphics();
    ci.fillStyle(PALETTE.gold, 1);
    ci.fillCircle(14, 14, 14);
    ci.fillStyle(PALETTE.goldDark, 0.6);
    ci.fillCircle(12, 12, 7);
    ci.lineStyle(2, PALETTE.goldPale, 0.8);
    ci.strokeCircle(14, 14, 13);
    ci.generateTexture('icon_coin', 28, 28);
    ci.destroy();

    // Star rating (filled)
    const sr = this.add.graphics();
    sr.fillStyle(PALETTE.gold, 1);
    fillStar(sr, 20, 20, 5, 18, 9, 0);
    sr.lineStyle(1.5, PALETTE.goldDark, 0.8);
    sr.generateTexture('icon_star', 40, 40);
    sr.destroy();

    // Star rating empty
    const se = this.add.graphics();
    se.fillStyle(0x333366, 1);
    fillStar(se, 20, 20, 5, 18, 9, 0);
    se.lineStyle(1.5, 0x554488, 0.8);
    se.generateTexture('icon_star_empty', 40, 40);
    se.destroy();

    // Level node
    const ln = this.add.graphics();
    ln.fillStyle(PALETTE.bgLight, 1);
    ln.fillCircle(36, 36, 36);
    ln.lineStyle(4, PALETTE.gold, 1);
    ln.strokeCircle(36, 36, 35);
    ln.fillStyle(PALETTE.gold, 0.15);
    ln.fillCircle(36, 36, 28);
    ln.generateTexture('level_node', 72, 72);
    ln.destroy();

    // Level node locked
    const ll = this.add.graphics();
    ll.fillStyle(0x221144, 1);
    ll.fillCircle(36, 36, 36);
    ll.lineStyle(4, 0x443366, 0.8);
    ll.strokeCircle(36, 36, 35);
    ll.generateTexture('level_node_locked', 72, 72);
    ll.destroy();

    // Level node current
    const lc = this.add.graphics();
    lc.fillStyle(PALETTE.bgLight, 1);
    lc.fillCircle(36, 36, 36);
    lc.lineStyle(5, PALETTE.green, 1);
    lc.strokeCircle(36, 36, 35);
    lc.fillStyle(PALETTE.green, 0.2);
    lc.fillCircle(36, 36, 28);
    lc.generateTexture('level_node_current', 72, 72);
    lc.destroy();

    // Combo burst bg
    const cb = this.add.graphics();
    cb.fillStyle(PALETTE.gold, 0.15);
    cb.fillCircle(60, 60, 60);
    cb.lineStyle(3, PALETTE.gold, 0.7);
    cb.strokeCircle(60, 60, 58);
    cb.generateTexture('combo_burst', 120, 120);
    cb.destroy();
  }

  private generateParticleTextures(): void {
    const sp = this.add.graphics();
    sp.fillStyle(0xffffff, 1);
    sp.fillCircle(4, 4, 4);
    sp.generateTexture('particle_spark', 8, 8);
    sp.destroy();

    const stp = this.add.graphics();
    stp.fillStyle(PALETTE.gold, 1);
    fillStar(stp, 7, 7, 5, 6, 3, 0);
    stp.generateTexture('particle_star', 14, 14);
    stp.destroy();

    const mp = this.add.graphics();
    mp.fillStyle(PALETTE.purpleLight, 0.9);
    mp.fillCircle(5, 5, 5);
    mp.fillStyle(0xffffff, 0.5);
    mp.fillCircle(3, 3, 2);
    mp.generateTexture('particle_orb', 10, 10);
    mp.destroy();

    const fp = this.add.graphics();
    fp.fillStyle(0xffffff, 1);
    fp.fillEllipse(12, 4, 24, 8);
    fp.fillEllipse(4, 12, 8, 24);
    fp.generateTexture('particle_flare', 24, 24);
    fp.destroy();
  }

  private generateBgTexture(): void {
    const w = 390, h = 844;
    const bg = this.add.graphics();
    bg.fillStyle(PALETTE.bgDeep, 1);
    bg.fillRect(0, 0, w, h);
    bg.fillStyle(PALETTE.purple, 0.18);
    bg.fillCircle(60, 200, 120);
    bg.fillStyle(PALETTE.purpleLight, 0.10);
    bg.fillCircle(340, 400, 160);
    bg.fillStyle(PALETTE.greenDark, 0.08);
    bg.fillCircle(180, 650, 130);
    bg.fillStyle(0x330066, 0.2);
    bg.fillCircle(350, 100, 90);
    for (let i = 0; i < 8; i++) {
      bg.fillStyle(0x5533aa, 0.06);
      bg.fillRect(20 + i * 48, 40, 38, 120);
    }
    bg.fillStyle(PALETTE.bgLight, 0.12);
    bg.fillRect(0, h - 150, w, 150);
    bg.generateTexture('bg_home', w, h);
    bg.destroy();

    const gbg = this.add.graphics();
    gbg.fillStyle(0x080212, 1);
    gbg.fillRect(0, 0, w, h);
    gbg.fillStyle(PALETTE.purple, 0.12);
    gbg.fillCircle(50, 150, 100);
    gbg.fillStyle(PALETTE.purpleLight, 0.06);
    gbg.fillCircle(350, 500, 140);
    gbg.generateTexture('bg_game', w, h);
    gbg.destroy();
  }

  private generateCatTexture(): void {
    const g = this.add.graphics();
    const cx = 60, cy = 80;

    // Body / robe
    g.fillStyle(0xe8d5b0, 1);
    g.fillEllipse(cx, cy + 30, 70, 80);
    g.fillStyle(0x2244aa, 1);
    g.fillEllipse(cx, cy + 50, 75, 85);

    // Robe stars
    g.fillStyle(PALETTE.gold, 0.8);
    fillStar(g, cx - 15, cy + 40, 5, 4, 2, 0);
    fillStar(g, cx + 18, cy + 55, 5, 4, 2, 0);
    fillStar(g, cx, cy + 70, 5, 4, 2, 0);

    // Head
    g.fillStyle(0xe8d5b0, 1);
    g.fillCircle(cx, cy - 10, 38);

    // Ears
    g.fillStyle(0xe8d5b0, 1);
    g.fillTriangle(cx - 28, cy - 38, cx - 42, cy - 72, cx - 10, cy - 38);
    g.fillTriangle(cx + 28, cy - 38, cx + 42, cy - 72, cx + 10, cy - 38);
    g.fillStyle(0xffaaaa, 0.7);
    g.fillTriangle(cx - 26, cy - 40, cx - 38, cy - 66, cx - 13, cy - 40);
    g.fillTriangle(cx + 26, cy - 40, cx + 38, cy - 66, cx + 13, cy - 40);

    // Wizard hat
    g.fillStyle(0x1a2255, 1);
    g.fillTriangle(cx, cy - 95, cx - 30, cy - 48, cx + 30, cy - 48);
    g.fillRect(cx - 34, cy - 52, 68, 14);
    g.fillStyle(PALETTE.gold, 0.9);
    g.fillRect(cx - 34, cy - 52, 68, 7);
    g.fillStyle(PALETTE.gold, 1);
    fillStar(g, cx, cy - 75, 5, 7, 3, 0);

    // Eyes
    g.fillStyle(0x88ff44, 1);
    g.fillCircle(cx - 13, cy - 12, 9);
    g.fillCircle(cx + 13, cy - 12, 9);
    g.fillStyle(0x000000, 1);
    g.fillCircle(cx - 12, cy - 11, 5);
    g.fillCircle(cx + 12, cy - 11, 5);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx - 10, cy - 14, 2);
    g.fillCircle(cx + 14, cy - 14, 2);

    // Nose
    g.fillStyle(0xff8899, 1);
    g.fillTriangle(cx - 3, cy - 4, cx + 3, cy - 4, cx, cy);

    // Mouth
    g.lineStyle(2, 0xaa4455, 1);
    g.lineBetween(cx - 8, cy + 2, cx - 4, cy + 5);
    g.lineBetween(cx + 8, cy + 2, cx + 4, cy + 5);

    // Whiskers
    g.lineStyle(1.5, 0xffffff, 0.7);
    g.lineBetween(cx - 22, cy - 2, cx - 8, cy);
    g.lineBetween(cx - 22, cy + 4, cx - 8, cy + 3);
    g.lineBetween(cx + 22, cy - 2, cx + 8, cy);
    g.lineBetween(cx + 22, cy + 4, cx + 8, cy + 3);

    // Wand arm + wand
    g.fillStyle(0xe8d5b0, 1);
    g.fillEllipse(cx + 50, cy + 20, 18, 28);
    g.fillStyle(0x5533aa, 1);
    g.fillRoundedRect(cx + 52, cy - 15, 8, 40, 3);
    g.fillStyle(PALETTE.gold, 1);
    fillStar(g, cx + 56, cy - 18, 5, 9, 4, 0);
    g.fillStyle(PALETTE.gold, 0.25);
    g.fillCircle(cx + 56, cy - 18, 14);

    g.generateTexture('cat_wizard', 120, 160);
    g.destroy();

    // Sparkles overlay
    const gh = this.add.graphics();
    gh.fillStyle(PALETTE.gold, 0.8);
    fillStar(gh, 20, 20, 5, 8, 4, 0);
    fillStar(gh, 100, 15, 5, 6, 3, 0);
    fillStar(gh, 110, 140, 5, 7, 3, 0);
    fillStar(gh, 15, 130, 5, 5, 2, 0);
    gh.generateTexture('cat_sparkles', 120, 160);
    gh.destroy();
  }
}
