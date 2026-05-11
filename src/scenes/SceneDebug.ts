// ─────────────────────────────────────────────────────────────────────────────
// SceneDebug.ts
//
// Lightweight per-scene debug overlay: live FPS counter, scene key, and a
// custom state label that the host scene can update.
//
// Usage:
//   // Enable globally (e.g. in main.ts or a dev-only build flag):
//   SceneDebug.enabled = true;
//
//   // Attach to any scene's create():
//   private debug!: SceneDebug;
//   create() {
//     this.debug = SceneDebug.attach(this);
//   }
//
//   // Update the state label from anywhere in the scene:
//   this.debug.setState('playing');
//
//   // Detach is automatic on scene SHUTDOWN; call manually if needed:
//   SceneDebug.detach(this);
//
// The overlay renders above everything else (depth 9999) and is scroll-fixed.
// It has zero runtime cost when `enabled` is false.
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/Constants';

// ── Null object returned when debug is disabled ────────────────────────────
const NULL_DEBUG: SceneDebug = {
  setState:   () => { /* noop */ },
  setInfo:    () => { /* noop */ },
  destroy:    () => { /* noop */ },
} as unknown as SceneDebug;

export class SceneDebug {

  /** Set to `true` before any scene loads to enable the overlay globally. */
  static enabled = false;

  // ── Factory ───────────────────────────────────────────────────────────────

  /**
   * Attach a debug overlay to the given scene.
   * Returns a null-object (all methods are no-ops) when `enabled` is false,
   * so call sites need no guard conditions.
   */
  static attach(scene: Phaser.Scene): SceneDebug {
    if (!SceneDebug.enabled) return NULL_DEBUG;

    const existing = SceneDebug._registry.get(scene.scene.key);
    if (existing) return existing;

    const inst = new SceneDebug(scene);
    SceneDebug._registry.set(scene.scene.key, inst);
    return inst;
  }

  /** Remove and destroy the overlay attached to a scene (if any). */
  static detach(scene: Phaser.Scene): void {
    const inst = SceneDebug._registry.get(scene.scene.key);
    if (inst) {
      inst.destroy();
      SceneDebug._registry.delete(scene.scene.key);
    }
  }

  private static _registry = new Map<string, SceneDebug>();

  // ── Instance ──────────────────────────────────────────────────────────────

  private scene:     Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private fpsText:   Phaser.GameObjects.Text;
  private keyText:   Phaser.GameObjects.Text;
  private stateText: Phaser.GameObjects.Text;
  private infoText:  Phaser.GameObjects.Text;

  private frameCount  = 0;
  private lastFpsTime = 0;
  private updateCb:   () => void;
  private shutdownCb: () => void;

  private constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = null!;  // assigned in build()
    this.fpsText   = null!;
    this.keyText   = null!;
    this.stateText = null!;
    this.infoText  = null!;

    this.build();

    this.updateCb   = () => this.onUpdate();
    this.shutdownCb = () => SceneDebug.detach(scene);
    scene.events.on(Phaser.Scenes.Events.UPDATE,   this.updateCb);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdownCb);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Update the "state: …" label (e.g. 'playing', 'paused', 'casting'). */
  setState(label: string): void {
    this.stateText.setText(`state: ${label}`);
  }

  /** Update the free-form info line (e.g. 'moves: 12 | score: 480'). */
  setInfo(label: string): void {
    this.infoText.setText(label);
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE,   this.updateCb);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.shutdownCb);
    if (this.container?.active) this.container.destroy();
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  private build(): void {
    const STYLE = { fontFamily: 'monospace', fontSize: '10px' };
    const H     = 40;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.68);
    bg.fillRect(0, 0, GAME_WIDTH, H);
    bg.lineStyle(1, 0x00ff88, 0.25);
    bg.lineBetween(0, H, GAME_WIDTH, H);

    this.fpsText = this.scene.add.text(6, 4, 'FPS: --', {
      ...STYLE, color: '#00ff88',
    });

    this.keyText = this.scene.add.text(6, 17, `scene: ${this.scene.scene.key}`, {
      ...STYLE, color: '#9d6fff',
    });

    this.stateText = this.scene.add.text(GAME_WIDTH / 2, 4, 'state: ---', {
      ...STYLE, color: '#ffd700',
    }).setOrigin(0.5, 0);

    this.infoText = this.scene.add.text(GAME_WIDTH / 2, 17, '', {
      ...STYLE, color: '#aaaaaa',
    }).setOrigin(0.5, 0);

    const memText = this.scene.add.text(GAME_WIDTH - 6, 4, 'objs: --', {
      ...STYLE, color: '#ff8844',
    }).setOrigin(1, 0);

    this.container = this.scene.add
      .container(0, 0, [bg, this.fpsText, this.keyText, this.stateText, this.infoText, memText])
      .setDepth(9999)
      .setScrollFactor(0);

    // Store memText ref for update
    (this as unknown as Record<string, unknown>)._memText = memText;
  }

  // ── Per-frame update ──────────────────────────────────────────────────────

  private onUpdate(): void {
    const now  = this.scene.time.now;
    this.frameCount++;

    if (now - this.lastFpsTime >= 500) {
      const elapsed = now - this.lastFpsTime;
      const fps     = Math.round(this.frameCount * (1000 / elapsed));
      this.fpsText.setText(`FPS: ${fps}`);
      this.frameCount  = 0;
      this.lastFpsTime = now;

      // Object count (rough perf signal)
      const count = this.scene.children.length;
      const mem   = (this as unknown as Record<string, unknown>)._memText as Phaser.GameObjects.Text;
      mem?.setText?.(`objs: ${count}`);
    }
  }
}
