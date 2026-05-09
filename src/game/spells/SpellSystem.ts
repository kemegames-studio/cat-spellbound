import Phaser from 'phaser';
import {
  EnergyType, SpellType, SPELL_CHARGE_NEEDED, SPELL_FUSIONS,
  TILE_TO_ENERGY, PALETTE,
} from '../../config/Constants';
import { TileType } from '../board/TileTypes';
import { SPELL_DEFINITIONS, SpellDefinition } from './SpellTypes';

export interface ChargedEnergy {
  light: number;
  mana: number;
  arcane: number;
}

export interface FusedSpell {
  spell: SpellType;
  definition: SpellDefinition;
}

export class SpellSystem {
  private scene: Phaser.Scene;
  private energy: ChargedEnergy = { light: 0, mana: 0, arcane: 0 };
  private availableSpells: FusedSpell[] = [];
  private onEnergyChange: (energy: ChargedEnergy) => void;
  private onSpellReady: (spell: FusedSpell) => void;

  constructor(
    scene: Phaser.Scene,
    onEnergyChange: (energy: ChargedEnergy) => void,
    onSpellReady: (spell: FusedSpell) => void,
  ) {
    this.scene = scene;
    this.onEnergyChange = onEnergyChange;
    this.onSpellReady = onSpellReady;
  }

  addEnergy(type: TileType, count: number): void {
    const energyType = TILE_TO_ENERGY[type];
    const prev = this.energy[energyType];
    this.energy[energyType] = Math.min(this.energy[energyType] + count, SPELL_CHARGE_NEEDED * 2);
    this.onEnergyChange({ ...this.energy });
    this.checkFusion(energyType, prev);
  }

  private checkFusion(changed: EnergyType, _prevValue: number): void {
    SPELL_FUSIONS.forEach(({ a, b, spell }) => {
      if (this.energy[a] >= SPELL_CHARGE_NEEDED && this.energy[b] >= SPELL_CHARGE_NEEDED) {
        const def = SPELL_DEFINITIONS.find(d => d.type === spell);
        if (!def) return;
        if (this.availableSpells.some(s => s.spell === spell)) return;

        this.energy[a] -= SPELL_CHARGE_NEEDED;
        this.energy[b] -= SPELL_CHARGE_NEEDED;
        const fused: FusedSpell = { spell, definition: def };
        this.availableSpells.push(fused);
        this.onEnergyChange({ ...this.energy });
        this.onSpellReady(fused);
      }
    });

    // Single-energy spells (double charge)
    const doubleSpells: Array<{ energy: EnergyType; spell: SpellType }> = [
      { energy: 'arcane', spell: 'meteor' },
      { energy: 'light',  spell: 'rainbow' },
      { energy: 'mana',   spell: 'cat_summon' },
    ];

    doubleSpells.forEach(({ energy, spell }) => {
      if (this.energy[energy] >= SPELL_CHARGE_NEEDED * 1.5) {
        const def = SPELL_DEFINITIONS.find(d => d.type === spell);
        if (!def) return;
        if (this.availableSpells.some(s => s.spell === spell)) return;

        this.energy[energy] -= SPELL_CHARGE_NEEDED * 1.5;
        const fused: FusedSpell = { spell, definition: def };
        this.availableSpells.push(fused);
        this.onEnergyChange({ ...this.energy });
        this.onSpellReady(fused);
      }
    });
  }

  getAvailableSpells(): FusedSpell[] {
    return [...this.availableSpells];
  }

  consumeSpell(spell: SpellType): FusedSpell | null {
    const idx = this.availableSpells.findIndex(s => s.spell === spell);
    if (idx === -1) return null;
    const [consumed] = this.availableSpells.splice(idx, 1);
    return consumed;
  }

  getEnergy(): ChargedEnergy {
    return { ...this.energy };
  }

  getEnergyPercent(type: EnergyType): number {
    return Math.min(this.energy[type] / SPELL_CHARGE_NEEDED, 1);
  }

  reset(): void {
    this.energy = { light: 0, mana: 0, arcane: 0 };
    this.availableSpells = [];
    this.onEnergyChange({ ...this.energy });
  }
}
