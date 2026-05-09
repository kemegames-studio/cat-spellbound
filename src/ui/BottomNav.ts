import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTHS } from '../config/Constants';

export type NavLabel = 'Shop' | 'Trophy' | 'Home' | 'Social' | 'Profile';

interface NavItem { label: NavLabel; icon: string; x: number }

const ITEMS: NavItem[] = [
  { label: 'Shop',    icon: '🏪', x: 48  },
  { label: 'Trophy',  icon: '🏆', x: 130 },
  { label: 'Home',    icon: '🏠', x: 195 },
  { label: 'Social',  icon: '👥', x: 262 },
  { label: 'Profile', icon: '👤', x: 340 },
];

const PANEL_TOP = GAME_HEIGHT - 90;
const ICON_Y    = GAME_HEIGHT - 63;
const LABEL_Y   = GAME_HEIGHT - 22;
const ZONE_Y    = GAME_HEIGHT - 45;

export function createBottomNav(
  scene: Phaser.Scene,
  active: NavLabel,
  routes: Partial<Record<NavLabel, string | (() => void)>>,
): void {
  // Opaque panel — covers whatever the background image has at the bottom
  const bg = scene.add.graphics().setDepth(DEPTHS.ui);
  bg.fillStyle(0x14073a, 1);
  bg.fillRoundedRect(0, PANEL_TOP, GAME_WIDTH, 90, { tl: 20, tr: 20, bl: 0, br: 0 });
  bg.lineStyle(1.5, 0x3d1878, 1);
  bg.strokeRoundedRect(0, PANEL_TOP, GAME_WIDTH, 90, { tl: 20, tr: 20, bl: 0, br: 0 });

  ITEMS.forEach(({ label, icon, x }) => {
    const isActive = label === active;
    const action   = routes[label];

    // Active highlight bubble behind icon
    if (isActive) {
      const bubble = scene.add.graphics().setDepth(DEPTHS.ui + 0.5);
      bubble.fillStyle(0x2d1060, 1);
      bubble.fillCircle(x, ICON_Y, 26);
      bubble.lineStyle(1.5, 0xffd700, 0.6);
      bubble.strokeCircle(x, ICON_Y, 26);
    }

    // Icon
    scene.add.text(x, ICON_Y, icon, { fontSize: '22px' })
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTHS.hud);

    // Label
    scene.add.text(x, LABEL_Y, label, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      color: isActive ? '#ffd700' : '#9d6fff',
      fontStyle: isActive ? 'bold' : 'normal',
    }).setOrigin(0.5, 0.5).setDepth(DEPTHS.hud);

    // Hit zone
    const zone = scene.add.zone(x, ZONE_Y, 68, 88)
      .setInteractive({ useHandCursor: !!action })
      .setDepth(DEPTHS.popup);

    if (action) {
      zone.on('pointerdown', () => {
        scene.cameras.main.fadeOut(250, 0, 0, 0);
        scene.cameras.main.once('camerafadeoutcomplete', () => {
          if (typeof action === 'function') action();
          else scene.scene.start(action);
        });
      });
    }
  });
}
