import Phaser from 'phaser';
import { PALETTE, GAME_WIDTH, GAME_HEIGHT } from '../config/Constants';

export class PreloadScene extends Phaser.Scene {
  private loadingBar!: Phaser.GameObjects.Graphics;
  private loadingFill!: Phaser.GameObjects.Graphics;
  private loadingText!: Phaser.GameObjects.Text;
  private splashShown = false;

  constructor() { super({ key: 'PreloadScene' }); }

  preload(): void {
    // Load all real UI assets
    this.load.image('splash',        'assets/splash.png');
    this.load.image('ui_home',       'assets/ui_home.png');
    this.load.image('ui_levels',     'assets/ui_levels.png');
    this.load.image('ui_gameplay',   'assets/ui_gameplay.jpg');
    this.load.image('ui_victory',    'assets/ui_victory.png');
    this.load.image('ui_store',      'assets/ui_store.png');
    this.load.image('ui_leaderboard','assets/ui_leaderboard.png');

    this.load.on('progress', (value: number) => {
      this.updateProgress(value);
    });

    this.load.on('complete', () => {
      this.updateProgress(1);
    });
  }

  private buildLoadingUI(): void {
    // Attempt to show splash image if already loaded, else dark screen
    try {
      const splashImg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'splash')
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
        .setDepth(0);
      this.splashShown = true;

      // Dim overlay so bar is readable
      const dim = this.add.graphics().setDepth(1);
      dim.fillStyle(0x000000, 0.35);
      dim.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    } catch {
      const bg = this.add.graphics().setDepth(0);
      bg.fillStyle(PALETTE.bgDeep, 1);
      bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    // Loading bar
    const barW = 260, barH = 10;
    const barX = (GAME_WIDTH - barW) / 2;
    const barY = GAME_HEIGHT - 90;

    const barBg = this.add.graphics().setDepth(2);
    barBg.fillStyle(0x221144, 0.9);
    barBg.fillRoundedRect(barX - 3, barY - 3, barW + 6, barH + 6, 8);
    barBg.lineStyle(1.5, PALETTE.purpleLight, 0.5);
    barBg.strokeRoundedRect(barX - 3, barY - 3, barW + 6, barH + 6, 8);

    this.loadingFill = this.add.graphics().setDepth(3);

    this.loadingText = this.add.text(GAME_WIDTH / 2, barY - 22, 'Loading...', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      color: '#9d6fff',
      letterSpacing: 3,
    }).setOrigin(0.5).setDepth(3);

    this._barX = barX; this._barY = barY; this._barW = barW; this._barH = barH;
  }

  private _barX = 0; private _barY = 0; private _barW = 0; private _barH = 0;

  private updateProgress(value: number): void {
    if (!this.loadingFill) return;
    const pct = Math.min(value, 1);
    this.loadingFill.clear();
    if (pct > 0.01) {
      this.loadingFill.fillStyle(PALETTE.gold, 1);
      this.loadingFill.fillRoundedRect(
        this._barX, this._barY,
        this._barW * pct, this._barH,
        5,
      );
      this.loadingFill.fillStyle(0xffffff, 0.25);
      this.loadingFill.fillRoundedRect(
        this._barX + 2, this._barY + 1,
        this._barW * pct - 4, this._barH * 0.4,
        3,
      );
    }
    if (this.loadingText) {
      this.loadingText.setText(pct >= 1 ? 'Ready!' : `Loading... ${Math.round(pct * 100)}%`);
    }

    // Also update HTML overlay bar
    const bar = document.getElementById('loading-bar');
    if (bar) bar.style.width = `${Math.round(pct * 100)}%`;
  }

  create(): void {
    this.buildLoadingUI();
    this.updateProgress(1);
    this.time.delayedCall(500, () => {
      const overlay = document.getElementById('loading-overlay');
      if (overlay) {
        overlay.classList.add('hidden');
        setTimeout(() => overlay.remove(), 600);
      }
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('HomeScene');
      });
    });
  }
}
