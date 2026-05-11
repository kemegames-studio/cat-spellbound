import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, PALETTE } from './Constants';
import { BootScene }         from '../scenes/BootScene';
import { KemeSplashScene }   from '../scenes/KemeSplashScene';
import { CatSplashScene }    from '../scenes/CatSplashScene';
import { PreloadScene }      from '../scenes/PreloadScene';
import { HomeScene }         from '../scenes/HomeScene';
import { GameScene }         from '../scenes/GameScene';
import { VictoryScene }      from '../scenes/VictoryScene';
import { DefeatScene }       from '../scenes/DefeatScene';
// Future scenes — import and add to the array below when implemented:
// import { LevelSelectScene }  from '../scenes/LevelSelectScene';
// import { LeaderboardScene }  from '../scenes/LeaderboardScene';
// import { StoreScene }        from '../scenes/StoreScene';

// ─────────────────────────────────────────────────────────────────────────────
// GameConfig
//
// Scene pipeline order matters for Phaser's internal scene manager:
//   1. Boot      — generates procedural textures; never revisited.
//   2. KemeSplash / CatSplash / Preload — splash + asset loading.
//   3. Home      — hub / main menu.
//   4. Game      — core gameplay.
//   5. Victory / Defeat — end-of-level screens.
//
// Adding a new scene: register the import above and append to the `scene`
// array.  The SceneKeys.ts SCENE constant is the single source of truth for
// key strings — use it in every scene constructor and navigation call.
// ─────────────────────────────────────────────────────────────────────────────

export const gameConfig = {
  type:            Phaser.AUTO,
  backgroundColor: PALETTE.bgDeep,
  parent:          'game-container',
  // `resolution` is a valid Phaser config key absent from TS types
  resolution: Math.min(window.devicePixelRatio || 1, 3),
  scale: {
    mode:        Phaser.Scale.FIT,
    autoCenter:  Phaser.Scale.CENTER_BOTH,
    width:       GAME_WIDTH,
    height:      GAME_HEIGHT,
    expandParent: true,
  },
  physics: {
    default: 'arcade',
    arcade:  { gravity: { x: 0, y: 0 }, debug: false },
  },
  scene: [
    BootScene,        // 1 — texture generation
    KemeSplashScene,  // 2 — studio logo
    CatSplashScene,   // 3 — cat splash + load bar
    PreloadScene,     // 4 — background asset loader (launched by CatSplash)
    HomeScene,        // 5 — main menu
    GameScene,        // 6 — gameplay
    VictoryScene,     // 7 — level-complete
    DefeatScene,      // 8 — game-over / out-of-moves
    // LevelSelectScene,
    // LeaderboardScene,
    // StoreScene,
  ],
  render: {
    antialias:    true,
    antialiasGL:  true,
    pixelArt:     false,
    roundPixels:  false,
  },
  input: {
    activePointers: 2,
  },
} as Phaser.Types.Core.GameConfig;
