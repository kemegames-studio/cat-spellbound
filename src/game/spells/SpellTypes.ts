import { EnergyType, SpellType, PALETTE } from '../../config/Constants';

export interface SpellDefinition {
  type: SpellType;
  name: string;
  description: string;
  color: number;
  icon: string;
  energyA: EnergyType;
  energyB: EnergyType;
}

export const SPELL_DEFINITIONS: SpellDefinition[] = [
  {
    type: 'lightning_storm',
    name: 'Lightning Storm',
    description: 'Clears entire rows with lightning!',
    color: 0x00eeff,
    icon: '⚡',
    energyA: 'light',
    energyB: 'arcane',
  },
  {
    type: 'healing_burst',
    name: 'Healing Burst',
    description: 'Removes all curse and clears 3×3 area',
    color: 0x00ff88,
    icon: '💚',
    energyA: 'light',
    energyB: 'mana',
  },
  {
    type: 'portal_vortex',
    name: 'Portal Vortex',
    description: 'Shuffles board and clears all of one color',
    color: 0x7b2fff,
    icon: '🌀',
    energyA: 'mana',
    energyB: 'arcane',
  },
  {
    type: 'meteor',
    name: 'Meteor Spell',
    description: 'Destroys 3×3 zone with explosive impact',
    color: 0xff6644,
    icon: '☄️',
    energyA: 'arcane',
    energyB: 'arcane',
  },
  {
    type: 'rainbow',
    name: 'Rainbow Potion',
    description: 'Clears all tiles of the most common color',
    color: 0xffd700,
    icon: '🌈',
    energyA: 'light',
    energyB: 'light',
  },
  {
    type: 'cat_summon',
    name: 'Cat Summon',
    description: 'Summons magical kittens to help clear!',
    color: 0xff44aa,
    icon: '🐱',
    energyA: 'mana',
    energyB: 'mana',
  },
];
