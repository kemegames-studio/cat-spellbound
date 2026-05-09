import Phaser from 'phaser';
import { gameConfig } from './config/GameConfig';

window.addEventListener('load', () => {
  const game = new Phaser.Game(gameConfig);
  (window as unknown as Record<string, unknown>).__catGame = game;

  // Hide loading overlay once Phaser boots
  game.events.once('ready', () => {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
      setTimeout(() => overlay.remove(), 600);
    }
  });

  // Prevent context menu on long-press (mobile)
  document.addEventListener('contextmenu', (e) => e.preventDefault());
});
