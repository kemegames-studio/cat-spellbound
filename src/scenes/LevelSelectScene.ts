import Phaser from 'phaser';
import { PALETTE, GAME_WIDTH, GAME_HEIGHT, LEVELS, DEPTHS } from '../config/Constants';

const UNLOCKED_LEVELS = 6; // for prototype

export class LevelSelectScene extends Phaser.Scene {
  constructor() { super({ key: 'LevelSelectScene' }); }

  create(): void {
    this.createBackground();
    this.createHeader();
    this.createLevelPath();
    this.createBottomNav();
    this.createCastleDecoration();
    this.createAmbientParticles();
  }

  private createBackground(): void {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'bg_home').setDepth(DEPTHS.bg);

    // Darker overlay for level select
    const overlay = this.add.graphics().setDepth(DEPTHS.bg + 1);
    overlay.fillStyle(0x000000, 0.25);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  private createHeader(): void {
    // Header bg
    const hdr = this.add.graphics().setDepth(DEPTHS.ui);
    hdr.fillStyle(0x0d0525, 0.92);
    hdr.fillRect(0, 0, GAME_WIDTH, 80);
    hdr.lineStyle(1, PALETTE.purpleLight, 0.3);
    hdr.lineBetween(0, 80, GAME_WIDTH, 80);

    // Back button
    const back = this.add.text(28, 40, '‹', {
      fontFamily: 'Georgia, serif',
      fontSize: '34px',
      color: '#ffd700',
    }).setOrigin(0.5).setDepth(DEPTHS.hud).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('HomeScene'));

    // Title
    this.add.text(GAME_WIDTH / 2, 40, 'Choose Level', {
      fontFamily: 'Georgia, serif',
      fontSize: '22px',
      color: '#ffd700',
      stroke: '#7b2fff',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(DEPTHS.hud);

    // Coin + heart display
    this.add.image(GAME_WIDTH - 110, 30, 'icon_coin').setScale(0.8).setDepth(DEPTHS.hud);
    this.add.text(GAME_WIDTH - 93, 30, '930', {
      fontFamily: 'Arial', fontSize: '13px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(DEPTHS.hud);
    this.add.text(GAME_WIDTH - 55, 30, '❤ Full', {
      fontFamily: 'Arial', fontSize: '12px', color: '#ff6688',
    }).setOrigin(0, 0.5).setDepth(DEPTHS.hud);
  }

  private createLevelPath(): void {
    // Winding path
    const pathPts: { x: number; y: number }[] = [
      { x: 195, y: GAME_HEIGHT - 130 },
      { x: 130, y: GAME_HEIGHT - 200 },
      { x: 240, y: GAME_HEIGHT - 280 },
      { x: 160, y: GAME_HEIGHT - 370 },
      { x: 250, y: GAME_HEIGHT - 460 },
      { x: 140, y: GAME_HEIGHT - 560 },
      { x: 230, y: GAME_HEIGHT - 650 },
      { x: 180, y: GAME_HEIGHT - 740 },
    ];

    // Draw path
    const pathG = this.add.graphics().setDepth(DEPTHS.board);
    pathG.lineStyle(10, 0x4a2880, 0.9);
    pathG.beginPath();
    pathG.moveTo(pathPts[0].x, pathPts[0].y);
    for (let i = 1; i < pathPts.length; i++) {
      pathG.lineTo(pathPts[i].x, pathPts[i].y);
    }
    pathG.strokePath();

    // Path dashes
    const dashG = this.add.graphics().setDepth(DEPTHS.board + 1);
    dashG.lineStyle(3, PALETTE.purplePale, 0.4);
    for (let i = 0; i < pathPts.length - 1; i++) {
      const a = pathPts[i], b = pathPts[i + 1];
      const steps = 6;
      for (let s = 0; s < steps; s++) {
        if (s % 2 === 0) {
          const t0 = s / steps, t1 = (s + 0.5) / steps;
          dashG.lineBetween(
            Phaser.Math.Linear(a.x, b.x, t0),
            Phaser.Math.Linear(a.y, b.y, t0),
            Phaser.Math.Linear(a.x, b.x, t1),
            Phaser.Math.Linear(a.y, b.y, t1),
          );
        }
      }
    }

    // Level nodes
    const levelData = LEVELS.slice(0, pathPts.length);
    levelData.forEach((level, i) => {
      const pt = pathPts[i];
      const isUnlocked = level.id <= UNLOCKED_LEVELS;
      const isCurrent = level.id === UNLOCKED_LEVELS;

      const nodeKey = isCurrent ? 'level_node_current' : (isUnlocked ? 'level_node' : 'level_node_locked');
      const node = this.add.image(pt.x, pt.y, nodeKey).setDepth(DEPTHS.tiles).setScale(0.9);

      // Level number
      this.add.text(pt.x, pt.y - 2, `${level.id}`, {
        fontFamily: 'Georgia, serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: isUnlocked ? '#ffd700' : '#553399',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(DEPTHS.tiles + 1);

      // Star rating below node
      if (isUnlocked) {
        const stars = level.id < UNLOCKED_LEVELS ? 3 : (level.id === UNLOCKED_LEVELS ? 0 : 0);
        for (let s = 0; s < 3; s++) {
          const sx = pt.x - 18 + s * 18;
          const sy = pt.y + 32;
          const starKey = s < stars ? 'icon_star' : 'icon_star_empty';
          this.add.image(sx, sy, starKey).setScale(0.5).setDepth(DEPTHS.tiles + 1);
        }
      }

      // Make unlocked nodes interactive
      if (isUnlocked) {
        node.setInteractive({ useHandCursor: true });
        node.on('pointerdown', () => {
          this.tweens.add({
            targets: node,
            scaleX: 0.8,
            scaleY: 0.8,
            duration: 80,
            yoyo: true,
            ease: 'Power2',
            onComplete: () => {
              this.scene.start('GameScene', { levelId: level.id });
            },
          });
        });
        node.on('pointerover', () => this.tweens.add({ targets: node, scaleX: 1.0, scaleY: 1.0, duration: 80 }));
        node.on('pointerout',  () => this.tweens.add({ targets: node, scaleX: 0.9, scaleY: 0.9, duration: 80 }));

        // Pulse for current level
        if (isCurrent) {
          this.tweens.add({
            targets: node,
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }
      }
    });
  }

  private createCastleDecoration(): void {
    // Castle silhouette at top right
    const g = this.add.graphics().setDepth(DEPTHS.board - 1);
    const cx = GAME_WIDTH - 60;
    const cy = 180;

    g.fillStyle(0x3d2060, 0.7);
    // Tower left
    g.fillRect(cx - 50, cy - 60, 30, 80);
    g.fillTriangle(cx - 50, cy - 60, cx - 35, cy - 90, cx - 20, cy - 60);
    // Tower main
    g.fillRect(cx - 30, cy - 80, 60, 100);
    g.fillTriangle(cx - 30, cy - 80, cx, cy - 115, cx + 30, cy - 80);
    // Tower right
    g.fillRect(cx + 20, cy - 60, 30, 80);
    g.fillTriangle(cx + 20, cy - 60, cx + 35, cy - 90, cx + 50, cy - 60);

    // Windows
    g.fillStyle(PALETTE.gold, 0.4);
    g.fillCircle(cx, cy - 50, 8);
    g.fillCircle(cx - 35, cy - 35, 5);
    g.fillCircle(cx + 35, cy - 35, 5);

    // Flag
    g.fillStyle(PALETTE.purpleLight, 0.8);
    g.fillTriangle(cx, cy - 115, cx, cy - 90, cx + 18, cy - 102);
  }

  private createBottomNav(): void {
    const navBg = this.add.graphics().setDepth(DEPTHS.ui);
    navBg.fillStyle(0x110633, 0.96);
    navBg.fillRoundedRect(0, GAME_HEIGHT - 90, GAME_WIDTH, 90, 0);
    navBg.lineStyle(1, PALETTE.purpleLight, 0.3);
    navBg.lineBetween(0, GAME_HEIGHT - 90, GAME_WIDTH, GAME_HEIGHT - 90);

    const navY = GAME_HEIGHT - 48;
    const items = [
      { label: 'Shop',    icon: '🏪', x: GAME_WIDTH * 0.12 },
      { label: 'Trophy',  icon: '🏆', x: GAME_WIDTH * 0.30 },
      { label: 'Home',    icon: '🏠', x: GAME_WIDTH * 0.50, action: () => this.scene.start('HomeScene') },
      { label: 'Social',  icon: '👥', x: GAME_WIDTH * 0.70 },
      { label: 'Profile', icon: '👤', x: GAME_WIDTH * 0.88 },
    ];

    items.forEach(({ label, icon, x, action }) => {
      const t = this.add.text(x, navY - 22, icon, { fontSize: '22px' })
        .setOrigin(0.5).setDepth(DEPTHS.hud);
      this.add.text(x, navY + 5, label, {
        fontFamily: 'Arial, sans-serif', fontSize: '10px',
        color: label === 'Home' ? '#ffd700' : '#9d6fff',
      }).setOrigin(0.5).setDepth(DEPTHS.hud);

      if (action) {
        t.setInteractive({ useHandCursor: true }).on('pointerdown', action);
      }
    });
  }

  private createAmbientParticles(): void {
    this.add.particles(0, 0, 'particle_orb', {
      x: { min: 0, max: GAME_WIDTH },
      y: { min: GAME_HEIGHT * 0.2, max: GAME_HEIGHT * 0.9 },
      quantity: 1,
      frequency: 600,
      lifespan: 3500,
      speedX: { min: -20, max: 20 },
      speedY: { min: -40, max: -20 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.6, end: 0 },
      tint: [PALETTE.purpleLight, PALETTE.gold, PALETTE.green],
    }).setDepth(DEPTHS.effects);
  }
}
