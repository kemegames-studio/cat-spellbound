// ─────────────────────────────────────────────────────────────────────────────
// GameScene.ts
//
// Core gameplay scene.  Orchestrates all game systems without owning
// business logic itself — it wires events between subsystems and drives
// the level lifecycle via a typed state machine.
//
// ── State machine ──────────────────────────────────────────────────────────
//
//   loading  ──(fadeIn complete)──► playing
//   playing  ──(pause tap)────────► paused
//   paused   ──(resume)───────────► playing
//   playing  ──(spell tap)────────► casting
//   casting  ──(ability:complete)─► playing
//   playing  ──(win condition)────► game_over  → VictoryScene
//   playing  ──(0 moves left)─────► game_over  → DefeatScene
//
// setState() is the single point that toggles board interactivity.  All
// subsystem calls that affect interactivity go through it.
//
// ── Navigation ─────────────────────────────────────────────────────────────
//
// All cross-scene transitions use SceneNavigator.fadeTo() — no raw
// this.cameras.main.fadeOut() calls in this file.
//
// ── Defeat / Victory flows ─────────────────────────────────────────────────
//
// Both flows navigate to dedicated scenes (VictoryScene / DefeatScene),
// keeping GameScene free of any overlay-building code for those states.
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import {
  PALETTE, GAME_WIDTH, GAME_HEIGHT, DEPTHS, LEVELS,
  TileType, SpellType, BOARD_OFFSET_X, BOARD_OFFSET_Y,
  BOARD_COLS, BOARD_ROWS, TILE_SIZE, TILE_GAP, ANIM,
} from '../config/Constants';
import { createBottomNav }       from '../ui/BottomNav';
import { Board }                 from '../game/board/Board';
import { MatchGroup }            from '../game/board/TileTypes';
import { AbilitySystem }         from '../game/abilities/AbilitySystem';
import type { AbilityCompleteEvent } from '../game/abilities/AbilitySystem';
import type { AbilityEffectContext } from '../game/abilities/AbilityEffectHandler';
import type { FusedSpell, ChargedEnergy } from '../game/spells/SpellSystem';
import { EffectsManager }        from '../game/effects/EffectsManager';
import { CatCompanion }          from '../game/companion/CatCompanion';
import { HUD }                   from '../ui/HUD';
import { PauseMenu }             from '../ui/PauseMenu';
import { ScorePopup }            from '../ui/ScorePopup';
import { ComboAnnouncement }     from '../ui/ComboAnnouncement';
import { ScoreSystem }           from '../game/scoring/ScoreSystem';
import { ComboSystem }           from '../game/scoring/ComboSystem';
import type { ScoreMatchEvent, ScoreBonusEvent, MilestoneEvent } from '../game/scoring/ScoreSystem';
import type { ComboState }       from '../game/scoring/ComboSystem';
import { SCENE }                 from './SceneKeys';
import { SceneNavigator }        from './SceneNavigator';
import { SceneDebug }            from './SceneDebug';
import { TRANSITION }            from './TransitionConfig';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LevelObjective {
  type:      string;
  count:     number;
  collected: number;
}

/**
 * Typed state machine for the gameplay session.
 *
 *   loading   — scene is fading in; board not interactive yet.
 *   playing   — normal gameplay; board is fully interactive.
 *   paused    — pause menu open; board locked.
 *   casting   — spell effect running; board locked until complete.
 *   game_over — victory / defeat triggered; no further input accepted.
 */
type GameState = 'loading' | 'playing' | 'paused' | 'casting' | 'game_over';

// ══════════════════════════════════════════════════════════════════════════════
// GameScene
// ══════════════════════════════════════════════════════════════════════════════

export class GameScene extends Phaser.Scene {

  // ── Core systems ──────────────────────────────────────────────────────────
  private board!:         Board;
  private abilitySystem!: AbilitySystem;
  private effects!:       EffectsManager;
  private companion!:     CatCompanion;
  private hud!:           HUD;
  private pauseMenu!:     PauseMenu;

  // ── Scoring systems ───────────────────────────────────────────────────────
  private comboSystem!:       ComboSystem;
  private scoreSystem!:       ScoreSystem;
  private comboAnnouncement!: ComboAnnouncement;

  // ── Level state ───────────────────────────────────────────────────────────
  private levelId:     number = 1;
  private movesLeft:   number = 22;
  private scoreTarget: number = 800;
  private objectives:  LevelObjective[] = [];

  // ── Scene state machine ───────────────────────────────────────────────────
  private gameState: GameState = 'loading';

  // ── Debug overlay ─────────────────────────────────────────────────────────
  private dbg!: SceneDebug;

  constructor() { super({ key: SCENE.Game }); }

  // ── Scene lifecycle ───────────────────────────────────────────────────────

  init(data: { levelId?: number }): void {
    const cfg        = LEVELS.find(l => l.id === (data?.levelId ?? 1)) ?? LEVELS[0]!;
    this.levelId     = cfg.id;
    this.movesLeft   = cfg.moves;
    this.scoreTarget = cfg.target;
    this.objectives  = cfg.objectives.map(o => ({ ...o, collected: 0 })) as LevelObjective[];
    this.gameState   = 'loading';
  }

  create(): void {
    this.dbg = SceneDebug.attach(this);

    this.createBackground();

    // ── Scoring layer (pure logic, no rendering) ───────────────────────────
    this.comboSystem = new ComboSystem({
      onCascade: (state) => this.onCascadeState(state),
      onReset:   ()      => { /* no direct UI action needed here */ },
    });
    this.scoreSystem = new ScoreSystem(this.comboSystem);
    this.wireScoreEvents();

    // ── Game systems ───────────────────────────────────────────────────────
    this.effects       = new EffectsManager(this);
    this.companion     = new CatCompanion(this);
    this.abilitySystem = new AbilitySystem(this);
    this.wireAbilityEvents();

    this.board = new Board(this, this.effects, {
      onMatch:       (group, allGroups, count) => this.onMatch(group, allGroups, count),
      onCombo:       (count)                   => this.onCombo(count),
      onTileCleared: (type, count)             => this.onTileCleared(type, count),
      onBoardStable: ()                        => this.onBoardStable(),
    });

    // ── UI ─────────────────────────────────────────────────────────────────
    this.hud = new HUD(
      this,
      this.levelId,
      () => this.pauseGame(),
      (spell) => this.castSpell(spell),
    );

    this.pauseMenu = new PauseMenu(
      this,
      () => this.resumeGame(),
      () => this.restartGame(),
      () => this.quitGame(),
    );

    this.comboAnnouncement = new ComboAnnouncement(this);

    this.createBoardBackground();
    this.createBottomCover();
    this.createPortalIndicators();
    this.createAmbientEffects();

    createBottomNav(this, 'Home', { Home: () => this.quitGame() });

    // Initial HUD sync
    this.hud.updateMoves(this.movesLeft);
    this.hud.updateScore(0);
    this.hud.showObjectives(this.objectives);

    // Fade in → unlock gameplay
    this.cameras.main.fadeIn(TRANSITION.game.fadeIn, 0, 0, 0);
    this.cameras.main.once('camerafadeincomplete', () => {
      this.setState('playing');
    });
  }

  shutdown(): void {
    this.scoreSystem?.removeAllListeners();
    this.abilitySystem?.removeAllListeners();
    this.comboAnnouncement?.destroy();
    this.effects?.destroy();
    this.board?.destroy();
    this.companion?.destroy();
    SceneDebug.detach(this);
  }

  // ── State machine ─────────────────────────────────────────────────────────

  /**
   * Transition to a new game state.
   * Board interactivity is derived solely from this method — call sites
   * must never call board.setInteractive() directly.
   */
  private setState(next: GameState): void {
    this.gameState = next;
    this.board?.setInteractive(next === 'playing');
    this.dbg.setState(next);
    this.dbg.setInfo(`moves: ${this.movesLeft} | score: ${this.score}`);
  }

  // ── Score event wiring ────────────────────────────────────────────────────

  private wireScoreEvents(): void {
    this.scoreSystem.on('score:match', (e: ScoreMatchEvent) => {
      this.hud.updateScore(e.totalScore);
      ScorePopup.spawn(this, e.position.x, e.position.y - 20, e);
    });

    this.scoreSystem.on('score:bonus', (e: ScoreBonusEvent) => {
      this.hud.updateScore(e.totalScore);
      ScorePopup.spawnBonus(
        this, GAME_WIDTH / 2, BOARD_OFFSET_Y + 60,
        e.points, e.source, 0x00ff88,
      );
    });

    this.scoreSystem.on('score:milestone', (e: MilestoneEvent) => {
      ScorePopup.spawnMilestone(this, GAME_WIDTH / 2, BOARD_OFFSET_Y + 100, e.label);
      this.companion.react('excited');
    });

    this.scoreSystem.on('score:combo', (state: ComboState) => {
      this.hud?.setComboState(state);
    });
  }

  // ── Board callbacks ───────────────────────────────────────────────────────

  private onMatch(group: MatchGroup, allGroups: MatchGroup[], _comboCount: number): void {
    const midTile   = group.tiles[Math.floor(group.tiles.length / 2)];
    const centerPos = midTile
      ? this.board.gridToWorld(midTile.col, midTile.row)
      : { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 };

    this.scoreSystem.processMatch(group, allGroups, centerPos);
    this.abilitySystem.addEnergy(group.type, group.size);

    if (group.size >= 4) this.companion.react('excited');
  }

  private onCombo(count: number): void {
    this.comboSystem.update(count);
    this.scoreSystem.processCombo(this.comboSystem.getState());
  }

  private onCascadeState(state: ComboState): void {
    if (state.tier === 'none') return;
    this.comboAnnouncement.show(state);
    this.companion.react('excited');
  }

  private onTileCleared(type: TileType, count: number): void {
    this.objectives.forEach(obj => {
      if (obj.type !== type || obj.collected >= obj.count) return;
      const before     = obj.collected;
      obj.collected    = Math.min(obj.collected + count, obj.count);
      const justDone   = before < obj.count && obj.collected >= obj.count;
      if (justDone) this.scoreSystem.addObjectiveBonus(type as TileType);
    });
    this.hud.showObjectives(this.objectives);
  }

  private onBoardStable(): void {
    // Guard: stale callbacks from an animation that completed after the
    // level already ended (victory burst, spell effect, etc.)
    if (this.gameState !== 'playing') return;

    this.comboSystem.reset();
    this.comboAnnouncement.hide();
    this.hud?.clearComboState();

    // Win check runs BEFORE decrementing moves so the winning move
    // doesn't cost the player a move.
    if (this.checkWinCondition()) {
      this.triggerVictory();
      return;
    }

    this.movesLeft--;
    this.hud.updateMoves(this.movesLeft);
    this.dbg.setInfo(`moves: ${this.movesLeft} | score: ${this.score}`);

    if (this.movesLeft <= 0) {
      this.score >= this.scoreTarget
        ? this.triggerVictory()
        : this.triggerDefeat();
      return;
    }

    if (this.movesLeft <= 5) this.companion.react('worried');

    if (!this.board.hasMoves()) this.triggerShuffle();
  }

  // ── Ability system event wiring ───────────────────────────────────────────

  private wireAbilityEvents(): void {
    this.abilitySystem.on('energy:change', (energy: ChargedEnergy) => {
      this.hud?.updateEnergy(energy);
    });

    this.abilitySystem.on('ability:ready', (spell: FusedSpell) => {
      this.onSpellReady(spell);
    });

    this.abilitySystem.on('ability:complete', (event: AbilityCompleteEvent) => {
      this.onAbilityComplete(event);
    });
  }

  private onSpellReady(spell: FusedSpell): void {
    this.hud.addSpellToSlot(spell);
    this.companion.react('casting');

    const hexColor = `#${spell.definition.color.toString(16).padStart(6, '0')}`;
    const notif = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.32,
      `⚡ ${spell.definition.name} READY!`, {
        fontFamily:      'Georgia, serif',
        fontSize:        '16px',
        color:           hexColor,
        stroke:          '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(DEPTHS.overlay);

    this.tweens.add({
      targets:    notif,
      y:          notif.y - 50,
      alpha:      0,
      duration:   TRANSITION.game.spellReady,
      delay:      500,
      ease:       'Power2',
      onComplete: () => notif.destroy(),
    });
  }

  // ── Spell casting ─────────────────────────────────────────────────────────

  /**
   * Called when the HUD fires a spell-slot tap.
   * Locks the board (state = 'casting'), shows the visual buildup, then
   * delegates all board effects to AbilitySystem (data-driven via catalog).
   */
  private castSpell(spellType: SpellType): void {
    if (this.gameState !== 'playing') return;

    const spell = this.abilitySystem.consumeBySpellType(spellType);
    if (!spell) return;

    this.setState('casting');
    this.companion.react('casting');
    this.effects.spawnSpellCast(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      spell.definition.color,
      spell.definition.name,
    );

    const context: AbilityEffectContext = {
      scene:   this,
      board:   this.board,
      effects: this.effects,
      onMovesRestored: (n: number) => {
        this.movesLeft += n;
        this.hud.updateMoves(this.movesLeft);
      },
    };

    // Visual buildup delay → fire ability
    this.time.delayedCall(ANIM.spellCast, () => {
      this.abilitySystem.castAbility(spellType, context);
      // 'ability:complete' fires from AbilitySystem after castDuration →
      // onAbilityComplete() handles scoring + board refill + state reset.
    });
  }

  private onAbilityComplete(event: AbilityCompleteEvent): void {
    this.scoreSystem.addSpellBonus(event.tilesCleared, event.abilityName);
    this.board.triggerGravityRefill(() => this.setState('playing'));
  }

  // ── Win / lose / shuffle ──────────────────────────────────────────────────

  private checkWinCondition(): boolean {
    const objectivesMet = this.objectives.every(o => o.collected >= o.count);
    return objectivesMet && this.score >= this.scoreTarget;
  }

  private triggerVictory(): void {
    if (this.gameState === 'game_over') return;
    this.setState('game_over');

    this.companion.react('celebrating');
    this.effects.spawnVictoryBurst(GAME_WIDTH / 2, GAME_HEIGHT / 2);

    this.time.delayedCall(TRANSITION.victory.burstDelay, () => {
      SceneNavigator.fadeTo(this, SCENE.Victory, {
        levelId:     this.levelId,
        score:       this.score,
        stars:       this.scoreSystem.calculateStars(this.scoreTarget),
        sessionData: this.scoreSystem.getSessionData(),
      }, TRANSITION.victory.fadeOut);
    });
  }

  private triggerDefeat(): void {
    if (this.gameState === 'game_over') return;
    this.setState('game_over');

    this.companion.react('worried');
    this.effects.shakeHard();

    // Brief pause after the shake so the player registers the failure,
    // then fade out to DefeatScene.
    this.time.delayedCall(TRANSITION.defeat.overlayFade, () => {
      SceneNavigator.fadeTo(this, SCENE.Defeat, {
        levelId: this.levelId,
        score:   this.score,
      }, TRANSITION.defeat.fadeOut);
    });
  }

  private triggerShuffle(): void {
    const msg = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Reshuffling…', {
      fontFamily:      'Georgia, serif',
      fontSize:        '22px',
      color:           '#9d6fff',
      stroke:          '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(DEPTHS.overlay);

    this.tweens.add({
      targets:    msg,
      alpha:      0,
      duration:   600,
      delay:      TRANSITION.game.shuffleHold,
      onComplete: () => msg.destroy(),
    });

    this.effects.screenFlash(PALETTE.purpleLight, 400, 0.3);
  }

  // ── Pause / resume ────────────────────────────────────────────────────────

  private pauseGame(): void {
    if (this.gameState !== 'playing') return;
    this.setState('paused');
    this.pauseMenu.show(this.score);
  }

  private resumeGame(): void {
    if (this.gameState !== 'paused') return;
    this.setState('playing');
  }

  // ── Retry / quit ──────────────────────────────────────────────────────────

  private restartGame(): void {
    SceneNavigator.fadeTo(
      this, SCENE.Game,
      { levelId: this.levelId },
      TRANSITION.game.retryFade,
    );
  }

  private quitGame(): void {
    SceneNavigator.fadeTo(this, SCENE.Home, undefined, TRANSITION.game.quitFade);
  }

  // ── Score accessor ────────────────────────────────────────────────────────

  private get score(): number { return this.scoreSystem.getScore(); }

  // ── Background / board rendering ──────────────────────────────────────────

  private createBackground(): void {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ui_gameplay')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(DEPTHS.bg);
  }

  private createBoardBackground(): void {
    const boardW = BOARD_COLS * (TILE_SIZE + TILE_GAP) - TILE_GAP + 20;
    const boardH = BOARD_ROWS * (TILE_SIZE + TILE_GAP) - TILE_GAP + 20;
    const bx     = BOARD_OFFSET_X - 10;
    const by     = BOARD_OFFSET_Y - 10;

    // Board backing panel
    const bg = this.add.graphics().setDepth(DEPTHS.board - 1);
    bg.fillStyle(0x0d0525, 0.72);
    bg.fillRoundedRect(bx, by, boardW, boardH, 18);
    bg.lineStyle(2, PALETTE.purpleLight, 0.20);
    bg.strokeRoundedRect(bx, by, boardW, boardH, 18);

    // Grid lines
    const gridG = this.add.graphics().setDepth(DEPTHS.board - 1);
    gridG.lineStyle(0.5, PALETTE.purpleLight, 0.08);
    for (let c = 1; c < BOARD_COLS; c++) {
      const lx = BOARD_OFFSET_X + c * (TILE_SIZE + TILE_GAP) - TILE_GAP / 2;
      gridG.lineBetween(lx, by + 8, lx, by + boardH - 8);
    }
    for (let r = 1; r < BOARD_ROWS; r++) {
      const ly = BOARD_OFFSET_Y + r * (TILE_SIZE + TILE_GAP) - TILE_GAP / 2;
      gridG.lineBetween(bx + 8, ly, bx + boardW - 8, ly);
    }

    // Corner rune accents
    [
      { x: bx + 16,         y: by + 16          },
      { x: bx + boardW - 16, y: by + 16          },
      { x: bx + 16,         y: by + boardH - 16  },
      { x: bx + boardW - 16, y: by + boardH - 16  },
    ].forEach(pos => {
      const r = this.add.graphics().setDepth(DEPTHS.board).setPosition(pos.x, pos.y);
      r.lineStyle(1.5, PALETTE.purpleLight, 0.4);
      r.strokeCircle(0, 0, 8);
      r.lineBetween(-8, 0, 8, 0);
      r.lineBetween(0, -8, 0, 8);
    });
  }

  private createBottomCover(): void {
    const boardBottom = BOARD_OFFSET_Y + BOARD_ROWS * (TILE_SIZE + TILE_GAP) - TILE_GAP;
    const navTop      = GAME_HEIGHT - 88;
    const cover = this.add.graphics().setDepth(DEPTHS.ui - 2);
    cover.fillStyle(0x0d0525, 0.96);
    cover.fillRect(0, boardBottom, GAME_WIDTH, navTop - boardBottom);
    cover.lineStyle(1, PALETTE.purpleLight, 0.25);
    cover.lineBetween(0, boardBottom, GAME_WIDTH, boardBottom);
  }

  private createPortalIndicators(): void {
    [{ col: 1, row: 2 }, { col: 5, row: 6 }].forEach(({ col, row }, i) => {
      const x = BOARD_OFFSET_X + col * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2;
      const y = BOARD_OFFSET_Y + row * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2;
      const g = this.add.graphics().setDepth(DEPTHS.board + 0.5).setPosition(x, y);
      g.lineStyle(2, PALETTE.green, 0.5);
      g.strokeCircle(0, 0, TILE_SIZE * 0.52);
      this.tweens.add({
        targets: g, scaleX: 1.15, scaleY: 1.15, alpha: 0.4,
        duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        delay: i * 600,
      });
    });
  }

  private createAmbientEffects(): void {
    this.add.particles(0, 0, 'particle_orb', {
      x: {
        min: BOARD_OFFSET_X,
        max: BOARD_OFFSET_X + BOARD_COLS * (TILE_SIZE + TILE_GAP),
      },
      y: {
        min: BOARD_OFFSET_Y + BOARD_ROWS * (TILE_SIZE + TILE_GAP),
        max: BOARD_OFFSET_Y + BOARD_ROWS * (TILE_SIZE + TILE_GAP) + 10,
      },
      speedY:    { min: -30, max: -10 },
      speedX:    { min: -8,  max: 8   },
      quantity:   1,
      frequency:  1200,
      lifespan:   3000,
      scale:     { start: 0.5, end: 0 },
      alpha:     { start: 0.4, end: 0 },
      tint:      [PALETTE.purpleLight, PALETTE.gold, PALETTE.cyan],
    }).setDepth(DEPTHS.board - 0.5);
  }
}
