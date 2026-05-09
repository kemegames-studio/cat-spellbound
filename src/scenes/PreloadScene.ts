import Phaser from 'phaser';
import { PALETTE } from '../config/Constants';

export class PreloadScene extends Phaser.Scene {
  constructor() { super({ key: 'PreloadScene' }); }

  preload(): void {
    // All textures are procedurally generated in BootScene.
    // This scene handles any external assets (audio, fonts, etc.)
    // For the prototype, we generate everything programmatically.
    this.simulateProgress();
  }

  private simulateProgress(): void {
    let p = 0;
    const bar = document.getElementById('loading-bar');
    const timer = setInterval(() => {
      p += 8;
      if (bar) bar.style.width = `${Math.min(p, 98)}%`;
      if (p >= 98) clearInterval(timer);
    }, 60);
  }

  create(): void {
    const bar = document.getElementById('loading-bar');
    if (bar) bar.style.width = '100%';
    this.time.delayedCall(300, () => this.scene.start('HomeScene'));
  }
}
