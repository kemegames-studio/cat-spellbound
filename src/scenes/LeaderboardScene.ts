import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTHS } from '../config/Constants';

export class LeaderboardScene extends Phaser.Scene {
  constructor() { super({ key: 'LeaderboardScene' }); }

  create(): void {
    this.cameras.main.fadeIn(300, 0, 0, 0);

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ui_leaderboard')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(DEPTHS.bg);

    this.createNavZones();
  }

  private createNavZones(): void {
    // Back arrow — top-left ~(38, 45)
    this.add.zone(38, 45, 60, 60)
      .setInteractive({ useHandCursor: true })
      .setDepth(DEPTHS.ui)
      .on('pointerdown', () => {
        this.cameras.main.fadeOut(250, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () =>
          this.scene.start('LevelSelectScene'),
        );
      });

    // Help button — top-right ~(352, 45)
    this.add.zone(352, 45, 60, 60)
      .setInteractive({ useHandCursor: true })
      .setDepth(DEPTHS.ui);
  }
}
