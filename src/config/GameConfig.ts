import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, PALETTE } from './Constants';
import { BootScene }        from '../scenes/BootScene';
import { PreloadScene }     from '../scenes/PreloadScene';
import { HomeScene }        from '../scenes/HomeScene';
import { LevelSelectScene } from '../scenes/LevelSelectScene';
import { GameScene }        from '../scenes/GameScene';
import { VictoryScene }     from '../scenes/VictoryScene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: PALETTE.bgDeep,
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scene: [
    BootScene,
    PreloadScene,
    HomeScene,
    LevelSelectScene,
    GameScene,
    VictoryScene,
  ],
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
  },
  input: {
    activePointers: 2,
  },
};
