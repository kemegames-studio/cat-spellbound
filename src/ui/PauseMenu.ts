import Phaser from 'phaser';
import { PALETTE, GAME_WIDTH, GAME_HEIGHT, DEPTHS } from '../config/Constants';

export class PauseMenu {
  private scene: Phaser.Scene;
  private overlay!: Phaser.GameObjects.Graphics;
  private panel!: Phaser.GameObjects.Container;
  private isVisible = false;

  private onResume: () => void;
  private onQuit:   () => void;
  private onRestart: () => void;

  constructor(
    scene: Phaser.Scene,
    onResume: () => void,
    onRestart: () => void,
    onQuit: () => void,
  ) {
    this.scene = scene;
    this.onResume  = onResume;
    this.onRestart = onRestart;
    this.onQuit    = onQuit;
    this.build();
  }

  private build(): void {
    // Dim overlay
    this.overlay = this.scene.add.graphics().setDepth(DEPTHS.overlay);
    this.overlay.fillStyle(0x000000, 0.65);
    this.overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.overlay.setAlpha(0);

    // Panel
    this.panel = this.scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(DEPTHS.popup);

    // Panel bg
    const panelBg = this.scene.add.graphics();
    panelBg.fillStyle(0x1a0a3a, 0.98);
    panelBg.fillRoundedRect(-140, -200, 280, 360, 20);
    panelBg.lineStyle(3, PALETTE.gold, 0.8);
    panelBg.strokeRoundedRect(-140, -200, 280, 360, 20);
    // Inner border
    panelBg.lineStyle(1.5, PALETTE.purpleLight, 0.4);
    panelBg.strokeRoundedRect(-133, -193, 266, 346, 17);
    this.panel.add(panelBg);

    // Title
    const title = this.scene.add.text(0, -155, 'PAUSED', {
      fontFamily: 'Georgia, serif',
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#ffd700',
      stroke: '#7b2fff',
      strokeThickness: 5,
      shadow: { offsetX: 0, offsetY: 3, color: '#000000aa', blur: 8, fill: true },
    }).setOrigin(0.5);
    this.panel.add(title);

    // Cat icon
    const catIcon = this.scene.add.text(0, -90, '🐱', { fontSize: '48px' }).setOrigin(0.5);
    this.panel.add(catIcon);

    // Buttons
    this.addButton(0, -5, '▶  RESUME',  PALETTE.green,       () => this.hide(this.onResume));
    this.addButton(0, 70,  '↺  RESTART', PALETTE.purpleLight, () => this.hide(this.onRestart));
    this.addButton(0, 135, '⌂  QUIT',    0x334455,            () => this.hide(this.onQuit));

    this.panel.setAlpha(0);
    this.panel.setScale(0.85);
    this.overlay.setVisible(false);
    this.panel.setVisible(false);
  }

  private addButton(x: number, y: number, label: string, color: number, action: () => void): void {
    const btnW = 220, btnH = 50;
    const btn = this.scene.add.container(x, y);

    const bg = this.scene.add.graphics();
    bg.fillStyle(color, 0.9);
    bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 25);
    bg.lineStyle(2, 0xffffff, 0.2);
    bg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 25);
    bg.fillStyle(0xffffff, 0.12);
    bg.fillRoundedRect(-btnW / 2 + 8, -btnH / 2 + 6, btnW - 16, btnH * 0.4, 12);
    btn.add(bg);

    const txt = this.scene.add.text(0, 1, label, {
      fontFamily: 'Georgia, serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#00000066',
      strokeThickness: 2,
    }).setOrigin(0.5);
    btn.add(txt);

    btn.setSize(btnW, btnH);
    btn.setInteractive(new Phaser.Geom.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH), Phaser.Geom.Rectangle.Contains);
    btn.on('pointerdown', () => {
      this.scene.tweens.add({
        targets: btn, scaleX: 0.94, scaleY: 0.94,
        duration: 70, yoyo: true, ease: 'Power2',
        onComplete: action,
      });
    });
    btn.on('pointerover', () => this.scene.tweens.add({ targets: btn, scaleX: 1.04, scaleY: 1.04, duration: 80 }));
    btn.on('pointerout',  () => this.scene.tweens.add({ targets: btn, scaleX: 1, scaleY: 1, duration: 80 }));

    this.panel.add(btn);
  }

  show(): void {
    if (this.isVisible) return;
    this.isVisible = true;
    this.overlay.setVisible(true);
    this.panel.setVisible(true);

    this.scene.tweens.add({
      targets: this.overlay,
      alpha: 1,
      duration: 200,
      ease: 'Power2',
    });
    this.scene.tweens.add({
      targets: this.panel,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 300,
      ease: 'Back.easeOut',
    });
  }

  hide(callback?: () => void): void {
    if (!this.isVisible) return;
    this.isVisible = false;

    this.scene.tweens.add({
      targets: [this.overlay, this.panel],
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.overlay.setVisible(false);
        this.panel.setVisible(false);
        callback?.();
      },
    });
  }
}
