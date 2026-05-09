import type { TileType, EnergyType } from '../../config/Constants';
import { TILE_TO_ENERGY } from '../../config/Constants';

export type { TileType };

export interface TileData {
  type: TileType;
  col: number;
  row: number;
  energy: EnergyType;
  cursed: boolean;
  sleeping: boolean;
  isPortal: boolean;
}

export const ALL_TILE_TYPES: TileType[] = ['star', 'potion', 'gem', 'book', 'crystal'];

export function randomTileType(): TileType {
  return ALL_TILE_TYPES[Math.floor(Math.random() * ALL_TILE_TYPES.length)];
}

export function tileEnergy(type: TileType): EnergyType {
  return TILE_TO_ENERGY[type];
}

export interface MatchGroup {
  tiles: Array<{ col: number; row: number }>;
  type: TileType;
  size: number;
  isSpecial: boolean; // 4+ match
  isMegaMatch: boolean; // 5+ match
}
