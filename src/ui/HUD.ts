import Phaser from 'phaser';
import {
  PALETTE, GAME_WIDTH, DEPTHS, SPELL_CHARGE_NEEDED,
  EnergyType, SpellType,
} from '../config/Constants';
import { ChargedEnergy } from '../game/spells/SpellSystem';
import { FusedSpell } from '../game/spells/SpellSystem';

export class HUD {
  private scene: Phaser.Scene;
  private movesText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private energyBars: Map<EnergyType, { bar: Phaser.GameObjects.Graphics; fill: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text }> = new Map();
  private spellSlots: Phaser.GameObjects.Container[] = [];
  private objectiveTexts: Phaser.GameObjects.Text[] = [];
  private pauseBtn!: Phaser.GameObjects.Text;
  private container!: Phaser.GameObjects.Container;
  private topBg!: Phaser.GameObjects.Graphics;
  private bottomBg!: Phaser.GameObjects.Graphics;

  private onPause: () => void;
  private onSpellCast: (spell: SpellType) => void;
  private availableSpells: FusedSpell[] = [];

  constructor(
    scene: Phaser.Scene,
    levelId: number,
    onPause: () => void,
    onSpellCast: (spell: SpellType) => void,
  ) {
    this.scene = scene;
    this.onPause = onPause;
    this.onSpellCast = onSpellCast;
    this.build(levelId);
  }

  private build(levelId: number): void {
    this.buildTopBar(levelId);
    this.buildEnergyBars();
    this.buildSpellSlots();
  }

  private buildTopBar(levelId: number): void {
    // Top HUD background
    this.topBg = this.scene.add.graphics().setDepth(DEPTHS.ui);
    this.topBg.fillStyle(0x0d0525, 0.94);
    this.topBg.fillRect(0, 0, GAME_WIDTH, 100);
    this.topBg.lineStyle(1, PALETTE.purpleLight, 0.3);
    this.topBg.lineBetween(0, 100, GAME_WIDTH, 100);

    // Level label
    this.levelText = this.scene.add.text(GAME_WIDTH / 2, 20, `Level ${levelId}`, {
      fontFamily: 'Georgia, serif',
      fontSize: '15px',
      color: '#9d6fff',
    }).setOrigin(0.5).setDepth(DEPTHS.hud);

    // Pause button
    this.pauseBtn = this.scene.add.text(22, 50, '⏸', { fontSize: '22px' })
      .setOrigin(0.5).setDepth(DEPTHS.hud)
      .setInteractive({ useHandCursor: true });
    this.pauseBtn.on('pointerdown', () => this.onPause());
    this.pauseBtn.on('pointerover', () => this.pauseBtn.setScale(1.1));
    this.pauseBtn.on('pointerout',  () => this.pauseBtn.setScale(1));

    // Moves display
    const movesBox = this.scene.add.graphics().setDepth(DEPTHS.ui);
    movesBox.fillStyle(PALETTE.bgLight, 0.8);
    movesBox.fillRoundedRect(GAME_WIDTH / 2 - 35, 35, 70, 46, 10);
    movesBox.lineStyle(2, PALETTE.purpleLight, 0.5);
    movesBox.strokeRoundedRect(GAME_WIDTH / 2 - 35, 35, 70, 46, 10);

    this.scene.add.text(GAME_WIDTH / 2, 44, 'MOVES', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '9px',
      color: '#9d6fff',
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(DEPTHS.hud);

    this.movesText = this.scene.add.text(GAME_WIDTH / 2, 63, '22', {
      fontFamily: 'Georgia, serif',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(DEPTHS.hud);

    // Score display
    const scoreBox = this.scene.add.graphics().setDepth(DEPTHS.ui);
    scoreBox.fillStyle(PALETTE.bgLight, 0.6);
    scoreBox.fillRoundedRect(GAME_WIDTH - 100, 35, 90, 40, 10);

    this.scene.add.text(GAME_WIDTH - 55, 43, 'SCORE', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '9px',
      color: '#9d6fff',
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(DEPTHS.hud);

    this.scoreText = this.scene.add.text(GAME_WIDTH - 55, 62, '0', {
      fontFamily: 'Georgia, serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#ffd700',
    }).setOrigin(0.5).setDepth(DEPTHS.hud);
  }

  private buildEnergyBars(): void {
    const types: Array<{ type: EnergyType; label: string; color: number; x: number }> = [
      { type: 'light',  label: '⭐ Light',  color: PALETTE.gold,        x: 16 },
      { type: 'mana',   label: '🔮 Mana',   color: PALETTE.purpleLight, x: 148 },
      { type: 'arcane', label: '💎 Arcane', color: PALETTE.cyan,        x: 280 },
    ];

    const barY = 108;
    const barW = 100;
    const barH = 10;

    types.forEach(({ type, label, color, x }) => {
      const labelText = this.scene.add.text(x + barW / 2, barY - 2, label, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '9px',
        color: `#${color.toString(16).padStart(6, '0')}`,
      }).setOrigin(0.5).setDepth(DEPTHS.hud);

      const bgBar = this.scene.add.graphics().setDepth(DEPTHS.ui);
      bgBar.fillStyle(0x110633, 0.9);
      bgBar.fillRoundedRect(x, barY + 6, barW, barH, 5);
      bgBar.lineStyle(1, color, 0.3);
      bgBar.strokeRoundedRect(x, barY + 6, barW, barH, 5);

      const fillBar = this.scene.add.graphics().setDepth(DEPTHS.ui + 1);

      this.energyBars.set(type, { bar: bgBar, fill: fillBar, label: labelText });
      this.drawEnergyFill(type, 0, color, x, barY + 6, barW, barH);
    });
  }

  private drawEnergyFill(
    type: EnergyType, percent: number, color: number,
    x: number, y: number, w: number, h: number,
  ): void {
    const entry = this.energyBars.get(type);
    if (!entry) return;

    entry.fill.clear();
    const fillW = Math.max(0, Math.min(w * percent, w));
    if (fillW > 4) {
      entry.fill.fillStyle(color, 0.9);
      entry.fill.fillRoundedRect(x, y, fillW, h, 5);

      // Shine
      entry.fill.fillStyle(0xffffff, 0.3);
      entry.fill.fillRoundedRect(x + 2, y + 1, fillW - 4, h * 0.4, 3);

      // Full indicator
      if (percent >= 1) {
        entry.fill.fillStyle(0xffffff, 0.5);
        entry.fill.fillRoundedRect(x, y, w, h, 5);
      }
    }
  }

  private buildSpellSlots(): void {
    const slotY = 138;
    const labels = ['Spell 1', 'Spell 2', 'Spell 3'];
    const xs = [30, 108, 186];

    xs.forEach((x, i) => {
      const slot = this.scene.add.container(x, slotY).setDepth(DEPTHS.ui);
      slot.add(this.scene.add.image(0, 0, 'spell_slot'));

      const label = this.scene.add.text(0, 26, labels[i], {
        fontFamily: 'Arial, sans-serif',
        fontSize: '9px',
        color: '#553399',
      }).setOrigin(0.5);
      slot.add(label);

      slot.setAlpha(0.5);
      this.spellSlots.push(slot);
    });
  }

  updateMoves(moves: number): void {
    this.movesText.setText(`${moves}`);
    if (moves <= 5) {
      this.movesText.setColor('#ff4444');
      this.scene.tweens.add({
        targets: this.movesText,
        scaleX: 1.3, scaleY: 1.3,
        duration: 100, yoyo: true, ease: 'Power2',
      });
    } else if (moves <= 10) {
      this.movesText.setColor('#ff8800');
    } else {
      this.movesText.setColor('#ffd700');
    }
  }

  updateScore(score: number): void {
    this.scoreText.setText(score.toLocaleString());
    this.scene.tweens.add({
      targets: this.scoreText,
      scaleX: 1.15, scaleY: 1.15,
      duration: 80, yoyo: true, ease: 'Back.easeOut',
    });
  }

  updateEnergy(energy: ChargedEnergy): void {
    const colors = { light: PALETTE.gold, mana: PALETTE.purpleLight, arcane: PALETTE.cyan };
    const xs     = { light: 16, mana: 148, arcane: 280 };

    (Object.keys(energy) as EnergyType[]).forEach(type => {
      const pct = Math.min(energy[type] / SPELL_CHARGE_NEEDED, 1);
      this.drawEnergyFill(type, pct, colors[type], xs[type], 114, 100, 10);
    });
  }

  addSpellToSlot(spell: FusedSpell): void {
    this.availableSpells.push(spell);
    const slotIdx = this.availableSpells.length - 1;
    if (slotIdx >= this.spellSlots.length) return;

    const slot = this.spellSlots[slotIdx];
    slot.setAlpha(1);

    // Replace bg with active
    slot.removeAll(true);
    slot.add(this.scene.add.image(0, 0, 'spell_slot_active'));

    // Spell icon
    const icon = this.scene.add.text(0, -4, spell.definition.icon, { fontSize: '20px' }).setOrigin(0.5);
    slot.add(icon);

    // Label
    const lbl = this.scene.add.text(0, 24, spell.definition.name.split(' ')[0], {
      fontFamily: 'Arial, sans-serif',
      fontSize: '8px',
      color: `#${spell.definition.color.toString(16).padStart(6, '0')}`,
    }).setOrigin(0.5);
    slot.add(lbl);

    // Animate in
    slot.setScale(0);
    this.scene.tweens.add({
      targets: slot,
      scaleX: 1, scaleY: 1,
      duration: 300, ease: 'Back.easeOut',
    });

    // Make interactive
    slot.setInteractive(new Phaser.Geom.Circle(0, 0, 32), Phaser.Geom.Circle.Contains);
    slot.on('pointerdown', () => {
      const s = this.availableSpells.find(sp => sp.spell === spell.spell);
      if (!s) return;

      // Remove from available
      const idx = this.availableSpells.indexOf(s);
      if (idx !== -1) this.availableSpells.splice(idx, 1);

      this.onSpellCast(s.spell);
      this.clearSlot(slotIdx);
    });

    slot.on('pointerover', () => this.scene.tweens.add({ targets: slot, scaleX: 1.1, scaleY: 1.1, duration: 80 }));
    slot.on('pointerout',  () => this.scene.tweens.add({ targets: slot, scaleX: 1, scaleY: 1, duration: 80 }));
  }

  private clearSlot(idx: number): void {
    const slot = this.spellSlots[idx];
    if (!slot) return;
    this.scene.tweens.add({
      targets: slot,
      scaleX: 0, scaleY: 0,
      duration: 200, ease: 'Back.easeIn',
      onComplete: () => {
        slot.removeAll(true);
        slot.add(this.scene.add.image(0, 0, 'spell_slot'));
        const lbl = this.scene.add.text(0, 26, `Spell ${idx + 1}`, {
          fontFamily: 'Arial, sans-serif', fontSize: '9px', color: '#553399',
        }).setOrigin(0.5);
        slot.add(lbl);
        slot.setScale(1);
        slot.setAlpha(0.5);
        slot.disableInteractive();
      },
    });
  }

  showObjectives(objectives: Array<{ type: string; count: number; collected: number }>): void {
    const startX = GAME_WIDTH - 110;
    const startY = 110;

    objectives.forEach((obj, i) => {
      const existing = this.objectiveTexts[i];
      const txt = `${obj.type}: ${obj.collected}/${obj.count}`;
      const isDone = obj.collected >= obj.count;

      if (existing) {
        existing.setText(txt);
        existing.setColor(isDone ? '#00ff88' : '#ffd700');
      } else {
        const t = this.scene.add.text(startX, startY + i * 16, txt, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '11px',
          color: isDone ? '#00ff88' : '#ffd700',
          stroke: '#000000',
          strokeThickness: 2,
        }).setDepth(DEPTHS.hud);
        this.objectiveTexts.push(t);
      }
    });
  }
}
