import Phaser from 'phaser';
import { PALETTE, GAME_WIDTH, GAME_HEIGHT, DEPTHS } from '../config/Constants';

export class StoreScene extends Phaser.Scene {
  constructor() { super({ key: 'StoreScene' }); }

  create(): void {
    this.cameras.main.fadeIn(300, 0, 0, 0);

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ui_store')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(DEPTHS.bg);

    this.createPurchaseZones();
    this.createBottomNavZones();
  }

  private createPurchaseZones(): void {
    // Coin pack row — 4 items at y≈340, x: 55, 133, 210, 318
    const coinPackX = [55, 133, 210, 318];
    const coinPackPrices = ['$1.99', '$4.99', '$9.99', '$19.99'];
    coinPackX.forEach((x, i) => {
      this.add.zone(x, 340, 72, 110)
        .setInteractive({ useHandCursor: true })
        .setDepth(DEPTHS.ui)
        .on('pointerdown', () => this.showPurchaseFlash(x, 340, coinPackPrices[i]));
    });

    // Heart refill row — 4 items at y≈468
    const heartX = [55, 133, 210, 318];
    heartX.forEach((x) => {
      this.add.zone(x, 468, 72, 100)
        .setInteractive({ useHandCursor: true })
        .setDepth(DEPTHS.ui)
        .on('pointerdown', () => this.showPurchaseFlash(x, 468, ''));
    });

    // Magical boosters row — 4 items at y≈600
    const boosterX = [55, 133, 210, 318];
    boosterX.forEach((x) => {
      this.add.zone(x, 600, 72, 100)
        .setInteractive({ useHandCursor: true })
        .setDepth(DEPTHS.ui)
        .on('pointerdown', () => this.showPurchaseFlash(x, 600, ''));
    });
  }

  private showPurchaseFlash(x: number, y: number, _price: string): void {
    const flash = this.add.graphics().setDepth(DEPTHS.overlay);
    flash.fillStyle(PALETTE.gold, 0.35);
    flash.fillRoundedRect(x - 36, y - 50, 72, 100, 8);
    this.tweens.add({
      targets: flash, alpha: 0, duration: 350, ease: 'Power2',
      onComplete: () => flash.destroy(),
    });
  }

  private createBottomNavZones(): void {
    // Bottom nav: Home, Map, Shop(active), Events, Settings at y≈812
    const items = [
      { x: 48,  action: () => this.scene.start('HomeScene') },
      { x: 117, action: () => this.scene.start('LevelSelectScene') },
      { x: 195, action: null },  // Shop (current)
      { x: 273, action: null },
      { x: 352, action: null },
    ] as const;

    items.forEach(({ x, action }) => {
      const zone = this.add.zone(x, 812, 68, 80)
        .setInteractive({ useHandCursor: !!action })
        .setDepth(DEPTHS.ui);
      if (action) zone.on('pointerdown', action);
    });
  }
}
