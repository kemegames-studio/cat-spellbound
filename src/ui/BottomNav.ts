import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTHS } from '../config/Constants';

export type NavLabel = 'Shop' | 'Trophy' | 'Home' | 'Social' | 'Profile';

// X centres of each nav item as they appear in the ui_levels.png reference
const ITEMS: { label: NavLabel; x: number }[] = [
  { label: 'Shop',    x: 48  },
  { label: 'Trophy',  x: 130 },
  { label: 'Home',    x: 195 },
  { label: 'Social',  x: 262 },
  { label: 'Profile', x: 340 },
];

const NAV_H  = 90;
const ZONE_Y = GAME_HEIGHT - 45;

/**
 * Stamps the reference nav bar image at the bottom of any scene, then adds
 * invisible hit-zones so the tabs route correctly.
 *
 * Call extractNavBarFrame() in PreloadScene.create() once before using this.
 */
export function createBottomNav(
  scene: Phaser.Scene,
  _active: NavLabel,
  routes: Partial<Record<NavLabel, string | (() => void)>>,
): void {
  // Stamp the real reference image — gives us the exact 3-D icons
  scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT - NAV_H / 2, 'ui_levels', 'nav_bar')
    .setDisplaySize(GAME_WIDTH, NAV_H)
    .setOrigin(0.5, 0.5)
    .setDepth(DEPTHS.ui);

  // Invisible zones wired to navigation actions
  ITEMS.forEach(({ label, x }) => {
    const action = routes[label];
    const zone = scene.add.zone(x, ZONE_Y, 68, NAV_H)
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
