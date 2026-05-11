import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTHS } from '../config/Constants';
import { TRANSITION } from '../scenes/TransitionConfig';

export type NavLabel = 'Home' | 'Shop' | 'Trophy' | 'Social' | 'Profile';

const NAV_H      = 88;
const NAV_Y      = GAME_HEIGHT - NAV_H;   // 756

// Center FAB (Home) — elevated rounded square sitting on top of the nav bar
const FAB_SIZE   = 82;
const FAB_X0     = GAME_WIDTH / 2 - FAB_SIZE / 2;
const FAB_Y0     = NAV_Y - FAB_SIZE + 14;

// Regular icon slots
const ICON_SIZE   = 54;
const HOLDER_SIZE = 66;
const ICON_CY     = NAV_Y + 22;
const LABEL_Y     = NAV_Y + 60;

const ITEMS: { label: NavLabel; key: string; x: number }[] = [
  { label: 'Shop',    key: 'tab_store',   x: Math.round(GAME_WIDTH * 0.10) },  //  39
  { label: 'Trophy', key: 'tab_rank',    x: Math.round(GAME_WIDTH * 0.30) },  // 117
  { label: 'Home',   key: 'tab_home',    x: Math.round(GAME_WIDTH * 0.50) },  // 195 FAB
  { label: 'Social', key: 'tab_social',  x: Math.round(GAME_WIDTH * 0.70) },  // 273
  { label: 'Profile',key: 'tab_profile', x: Math.round(GAME_WIDTH * 0.90) },  // 351
];

export function createBottomNav(
  scene: Phaser.Scene,
  active: NavLabel,
  routes: Partial<Record<NavLabel, string | (() => void)>>,
): void {
  // ── Nav bar background ──────────────────────────────────────────────────
  const bar = scene.add.graphics().setDepth(DEPTHS.ui);
  bar.fillStyle(0x130828, 0.97);
  bar.fillRect(0, NAV_Y, GAME_WIDTH, NAV_H);
  bar.lineStyle(1.5, 0x5028a0, 0.5);
  bar.lineBetween(0, NAV_Y, GAME_WIDTH, NAV_Y);

  ITEMS.forEach(({ label, key, x }) => {
    const isActive = label === active;
    const action   = routes[label];

    // ── Center FAB (Home) ─────────────────────────────────────────────────
    if (label === 'Home') {
      // Drop shadow behind FAB
      const shadow = scene.add.graphics().setDepth(DEPTHS.ui + 1);
      shadow.fillStyle(0x000000, 0.35);
      shadow.fillRoundedRect(FAB_X0 + 3, FAB_Y0 + 5, FAB_SIZE, FAB_SIZE, FAB_SIZE / 2);

      // FAB holder
      const fab = scene.add.graphics().setDepth(DEPTHS.ui + 2);
      fab.fillStyle(isActive ? 0x6030c8 : 0x2e1470, 1);
      fab.fillRoundedRect(FAB_X0, FAB_Y0, FAB_SIZE, FAB_SIZE, FAB_SIZE / 2);
      fab.lineStyle(2, isActive ? 0xb070ff : 0x6040b0, isActive ? 0.95 : 0.55);
      fab.strokeRoundedRect(FAB_X0, FAB_Y0, FAB_SIZE, FAB_SIZE, FAB_SIZE / 2);

      // Home icon inside FAB
      scene.add.image(x, FAB_Y0 + FAB_SIZE / 2, 'tab_home')
        .setDisplaySize(50, 50)
        .setAlpha(isActive ? 1 : 0.75)
        .setDepth(DEPTHS.ui + 3);

      // Hit zone covers FAB above bar + tab area below
      const hitH  = FAB_SIZE + NAV_H - 14;
      const hitCY = FAB_Y0 + FAB_SIZE / 2;
      const fabZone = scene.add.zone(x, hitCY, 90, hitH)
        .setInteractive({ useHandCursor: !!action })
        .setDepth(DEPTHS.popup);

      if (action) {
        fabZone.on('pointerdown', () => {
          scene.cameras.main.fadeOut(TRANSITION.fadeOut, 0, 0, 0);
          scene.cameras.main.once('camerafadeoutcomplete', () => {
            if (typeof action === 'function') action();
            else scene.scene.start(action);
          });
        });
      }
      return;
    }

    // ── Regular tab ───────────────────────────────────────────────────────
    const hx = x - HOLDER_SIZE / 2;
    const hy = ICON_CY - HOLDER_SIZE / 2;

    const holder = scene.add.graphics().setDepth(DEPTHS.ui + 1);
    if (isActive) {
      holder.fillStyle(0x6030c8, 0.55);
      holder.fillRoundedRect(hx, hy, HOLDER_SIZE, HOLDER_SIZE, 13);
      holder.lineStyle(1.5, 0xb878ff, 0.85);
      holder.strokeRoundedRect(hx, hy, HOLDER_SIZE, HOLDER_SIZE, 13);
    } else {
      holder.fillStyle(0x241050, 0.7);
      holder.fillRoundedRect(hx, hy, HOLDER_SIZE, HOLDER_SIZE, 13);
      holder.lineStyle(1, 0x4828a0, 0.5);
      holder.strokeRoundedRect(hx, hy, HOLDER_SIZE, HOLDER_SIZE, 13);
    }

    // Icon
    scene.add.image(x, ICON_CY, key)
      .setDisplaySize(ICON_SIZE, ICON_SIZE)
      .setAlpha(isActive ? 1 : 0.7)
      .setDepth(DEPTHS.hud);

    // Label
    scene.add.text(x, LABEL_Y, label, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      fontStyle: isActive ? 'bold' : 'normal',
      color: isActive ? '#c890ff' : '#7055a8',
    }).setOrigin(0.5, 0).setDepth(DEPTHS.hud);

    // Hit zone
    const zone = scene.add.zone(x, NAV_Y + NAV_H / 2, 80, NAV_H)
      .setInteractive({ useHandCursor: !!action })
      .setDepth(DEPTHS.popup);

    if (action) {
      zone.on('pointerdown', () => {
        scene.cameras.main.fadeOut(TRANSITION.fadeOut, 0, 0, 0);
        scene.cameras.main.once('camerafadeoutcomplete', () => {
          if (typeof action === 'function') action();
          else scene.scene.start(action);
        });
      });
    }
  });
}

