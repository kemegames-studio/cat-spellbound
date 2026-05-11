// ─────────────────────────────────────────────────────────────────────────────
// PreloadScene.ts
//
// Silent background asset loader — never has a camera or visible UI.
// CatSplashScene launches this as a parallel scene and owns the progress bar.
//
// Events emitted (listened to by CatSplashScene):
//   'load-progress'    (value: number 0–1)   — during preload(), on progress
//   'preload-complete' ()                     — in create(), after all assets
//
// One-time post-load setup:
//   • Extracts the nav-bar texture frame from ui_levels.png so any scene can
//     render it without redundant image loads.
//   • Removes the HTML loading overlay if it is still in the DOM.
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { GAME_HEIGHT } from '../config/Constants';
import { SCENE }       from './SceneKeys';

export class PreloadScene extends Phaser.Scene {
  constructor() { super({ key: SCENE.Preload }); }

  // ── Asset manifest ─────────────────────────────────────────────────────────

  preload(): void {
    // ── Full-screen reference backgrounds / UI sheets ──────────────────────
    this.load.image('splash',          'assets/splash.png');
    this.load.image('ui_home',         'assets/ui_home.jpg');
    this.load.image('ui_levels',       'assets/ui_levels.png');
    this.load.image('ui_gameplay',     'assets/ui_gameplay.jpg');
    this.load.image('ui_victory',      'assets/ui_victory.png');
    this.load.image('ui_store',        'assets/ui_store.png');
    this.load.image('ui_leaderboard',  'assets/ui_leaderboard.png');

    // ── SVG icons (rasterised at import-time by Phaser) ────────────────────
    this.load.svg('icon_settings',    'assets/icons/icon_settings.svg',  { width: 156, height: 156 });
    this.load.svg('icon_coin',        'assets/icons/icon_coin.svg',      { width: 44,  height: 44  });
    this.load.svg('icon_btn_plus',    'assets/icons/icon_btn_plus.svg',  { width: 32,  height: 32  });
    this.load.svg('icon_nav_home',    'assets/icons/icon_nav_home.svg',  { width: 72,  height: 72  });
    this.load.svg('icon_nav_cats',    'assets/icons/icon_nav_cats.svg',  { width: 72,  height: 72  });
    this.load.svg('icon_nav_spells',  'assets/icons/icon_nav_spells.svg',{ width: 72,  height: 72  });
    this.load.svg('icon_nav_quests',  'assets/icons/icon_nav_quests.svg',{ width: 72,  height: 72  });

    // ── PNG icons ──────────────────────────────────────────────────────────
    this.load.image('tab_home',               'assets/icons/tab_home.png');
    this.load.image('tab_store',              'assets/icons/tab_store.png');
    this.load.image('tab_profile',            'assets/icons/tab_profile.png');
    this.load.image('tab_social',             'assets/icons/tab_social.png');
    this.load.image('tab_rank',               'assets/icons/tab_rank.png');
    this.load.image('icon_coin_paw',          'assets/icons/icon_coin_paw.png');
    this.load.image('icon_heart',             'assets/icons/icon_heart.png');
    this.load.image('ui_plus_icon',           'assets/icons/ui_plus_icon.png');
    this.load.image('ui_holder',              'assets/icons/ui_holder.png');
    this.load.image('ui_green_circle_button', 'assets/icons/ui_green_circle_button.png');

    // ── Progress forwarding (CatSplashScene owns the visual bar) ──────────
    this.load.on('progress', (value: number) => {
      this.events.emit('load-progress', value);
    });

    this.load.on('complete', () => {
      this.events.emit('load-progress', 1);
    });
  }

  // ── Post-load setup ────────────────────────────────────────────────────────

  create(): void {
    this.extractNavBarFrame();
    this.removeHtmlOverlay();
    // Signal CatSplashScene (or any launcher listening on this scene)
    this.events.emit('preload-complete');
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Slice the bottom nav strip from ui_levels.png and register it as a named
   * frame ('nav_bar') so any scene can render it via:
   *   this.add.image(x, y, 'ui_levels', 'nav_bar')
   */
  private extractNavBarFrame(): void {
    const NAV_H_PCT = 90 / GAME_HEIGHT;
    const tex = this.textures.get('ui_levels');
    const src = tex.source[0];
    if (!src) return;

    const navY = Math.round((1 - NAV_H_PCT) * src.height);
    tex.add('nav_bar', 0, 0, navY, src.width, src.height - navY);

    // Restore __BASE so unframed uses keep rendering the full background
    tex.firstFrame = '__BASE';
  }

  /** Remove the HTML loading overlay if it is still in the DOM. */
  private removeHtmlOverlay(): void {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
      setTimeout(() => overlay.remove(), 600);
    }

    // Update the HTML progress bar to 100 % in case it was never synced
    const bar = document.getElementById('loading-bar');
    if (bar) bar.style.width = '100%';
  }
}
