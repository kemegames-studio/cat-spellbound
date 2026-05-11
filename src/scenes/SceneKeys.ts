// ─────────────────────────────────────────────────────────────────────────────
// SceneKeys.ts
//
// Single source of truth for every Phaser scene key string.
//
// WHY: Hard-coded strings scattered across scene files create silent bugs when
// a key is renamed or misspelled.  Import SCENE.X everywhere instead of
// writing 'GameScene' literally, and TypeScript will catch any typo at build
// time.
//
// Adding a new scene:
//   1.  Add an entry here.
//   2.  Register it in GameConfig.ts.
//   3.  Pass { key: SCENE.YourScene } to the class constructor.
// ─────────────────────────────────────────────────────────────────────────────

export const SCENE = {
  Boot:        'BootScene',
  KemeSplash:  'KemeSplashScene',
  CatSplash:   'CatSplashScene',
  Preload:     'PreloadScene',
  Home:        'HomeScene',
  LevelSelect: 'LevelSelectScene',
  Game:        'GameScene',
  Victory:     'VictoryScene',
  Defeat:      'DefeatScene',
  Leaderboard: 'LeaderboardScene',
  Store:       'StoreScene',
} as const;

/** Union of every registered scene key string. */
export type SceneKey = typeof SCENE[keyof typeof SCENE];
