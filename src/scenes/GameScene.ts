import Phaser from 'phaser';
import {
  PALETTE, GAME_WIDTH, GAME_HEIGHT, DEPTHS, LEVELS,
  TileType, SpellType, BOARD_OFFSET_X, BOARD_OFFSET_Y,
  BOARD_COLS, BOARD_ROWS, TILE_SIZE, TILE_GAP, ANIM,
} from '../config/Constants';
import { Board } from '../game/board/Board';
import { MatchGroup } from '../game/board/TileTypes';
import { SpellSystem } from '../game/spells/SpellSystem';
import { FusedSpell } from '../game/spells/SpellSystem';
import { EffectsManager } from '../game/effects/EffectsManager';
import { CatCompanion } from '../game/companion/CatCompanion';
import { HUD } from '../ui/HUD';
import { PauseMenu } from '../ui/PauseMenu';

interface LevelObjective {
  type: string;
  count: number;
  collected: number;
}

export class GameScene extends Phaser.Scene {
  private board!: Board;
  private spellSystem!: SpellSystem;
  private effects!: EffectsManager;
  private companion!: CatCompanion;
  private hud!: HUD;
  private pauseMenu!: PauseMenu;

  private levelId: number = 1;
  private movesLeft: number = 22;
  private score: number = 0;
  private scoreTarget: number = 800;
  private objectives: LevelObjective[] = [];
  private isPaused: boolean = false;
  private isGameOver: boolean = false;
  private lastComboTime: number = 0;

  // Score multipliers
  private comboMultiplier: number = 1;

  constructor() { super({ key: 'GameScene' }); }

  init(data: { levelId?: number }): void {
    this.levelId = data?.levelId ?? 1;
    const levelConfig = LEVELS.find(l => l.id === this.levelId) ?? LEVELS[0];
    this.movesLeft  = levelConfig.moves;
    this.scoreTarget = levelConfig.target;
    this.score      = 0;
    this.isPaused   = false;
    this.isGameOver = false;
    this.objectives = levelConfig.objectives.map(o => ({
      ...o,
      collected: 0,
    })) as LevelObjective[];
  }

  create(): void {
    this.createBackground();
    this.effects   = new EffectsManager(this);
    this.companion = new CatCompanion(this);
    this.spellSystem = new SpellSystem(
      this,
      (energy) => this.hud?.updateEnergy(energy),
      (spell)   => this.onSpellReady(spell),
    );

    this.board = new Board(this, this.effects, {
      onMatch:       (group)         => this.onMatch(group),
      onCombo:       (count)         => this.onCombo(count),
      onTileCleared: (type, count)   => this.onTileCleared(type, count),
      onBoardStable: ()              => this.onBoardStable(),
    });

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

    this.createBoardBackground();
    this.createObjectivesPanel();
    this.createPortalIndicators();
    this.createAmbientEffects();

    // Initial HUD update
    this.hud.updateMoves(this.movesLeft);
    this.hud.updateScore(this.score);
    this.hud.showObjectives(this.objectives);

    // Entrance animation
    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  private createBackground(): void {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ui_gameplay')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(DEPTHS.bg);
  }

  private createBoardBackground(): void {
    const boardW = BOARD_COLS * (TILE_SIZE + TILE_GAP) - TILE_GAP + 20;
    const boardH = BOARD_ROWS * (TILE_SIZE + TILE_GAP) - TILE_GAP + 20;
    const bx = BOARD_OFFSET_X - 10;
    const by = BOARD_OFFSET_Y - 10;

    const bg = this.add.graphics().setDepth(DEPTHS.board - 1);
    bg.fillStyle(0x0d0525, 0.72);
    bg.fillRoundedRect(bx, by, boardW, boardH, 18);
    bg.lineStyle(2, PALETTE.purpleLight, 0.20);
    bg.strokeRoundedRect(bx, by, boardW, boardH, 18);

    // Inner grid hint
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

    // Corner runes
    const runePositions = [
      { x: bx + 16, y: by + 16 },
      { x: bx + boardW - 16, y: by + 16 },
      { x: bx + 16, y: by + boardH - 16 },
      { x: bx + boardW - 16, y: by + boardH - 16 },
    ];
    runePositions.forEach(pos => {
      const r = this.add.graphics().setDepth(DEPTHS.board).setPosition(pos.x, pos.y);
      r.lineStyle(1.5, PALETTE.purpleLight, 0.4);
      r.strokeCircle(0, 0, 8);
      r.lineBetween(-8, 0, 8, 0);
      r.lineBetween(0, -8, 0, 8);
    });
  }

  private createObjectivesPanel(): void {
    // Small panel top-right for objectives
    const panelX = GAME_WIDTH - 105;
    const panelH = this.objectives.length * 22 + 18;
    const panelBg = this.add.graphics().setDepth(DEPTHS.ui);
    panelBg.fillStyle(0x0d0525, 0.85);
    panelBg.fillRoundedRect(panelX, 102, 100, panelH, 8);
    panelBg.lineStyle(1, PALETTE.purpleLight, 0.3);
    panelBg.strokeRoundedRect(panelX, 102, 100, panelH, 8);
  }

  private createPortalIndicators(): void {
    // Visual portal cells
    const portalPositions = [
      { col: 1, row: 2 }, { col: 5, row: 6 },
    ];
    const portalColors = [PALETTE.green, PALETTE.green];

    portalPositions.forEach(({ col, row }, i) => {
      const x = BOARD_OFFSET_X + col * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2;
      const y = BOARD_OFFSET_Y + row * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2;
      const g = this.add.graphics().setDepth(DEPTHS.board + 0.5).setPosition(x, y);
      g.lineStyle(2, portalColors[i], 0.5);
      g.strokeCircle(0, 0, TILE_SIZE * 0.52);

      // Pulsing portal ring
      this.tweens.add({
        targets: g,
        scaleX: 1.15,
        scaleY: 1.15,
        alpha: 0.4,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: i * 600,
      });
    });
  }

  private createAmbientEffects(): void {
    // Background floating orbs
    this.add.particles(0, 0, 'particle_orb', {
      x: { min: BOARD_OFFSET_X, max: BOARD_OFFSET_X + BOARD_COLS * (TILE_SIZE + TILE_GAP) },
      y: { min: BOARD_OFFSET_Y + BOARD_ROWS * (TILE_SIZE + TILE_GAP), max: BOARD_OFFSET_Y + BOARD_ROWS * (TILE_SIZE + TILE_GAP) + 10 },
      speedY: { min: -30, max: -10 },
      speedX: { min: -8, max: 8 },
      quantity: 1,
      frequency: 1200,
      lifespan: 3000,
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.4, end: 0 },
      tint: [PALETTE.purpleLight, PALETTE.gold, PALETTE.cyan],
    }).setDepth(DEPTHS.board - 0.5);
  }

  // --- Event handlers ---

  private onMatch(group: MatchGroup): void {
    const basePoints = group.size * 100 * (group.size >= 4 ? 1.5 : 1) * (group.size >= 5 ? 2 : 1);
    const points = Math.round(basePoints * this.comboMultiplier);
    this.score += points;
    this.hud.updateScore(this.score);

    // Score popup at match center
    const centerTile = group.tiles[Math.floor(group.tiles.length / 2)];
    const { x, y } = this.board.gridToWorld(centerTile.col, centerTile.row);
    this.effects.spawnScorePopup(x, y - 20, points);

    // Charge spell energy
    this.spellSystem.addEnergy(group.type, group.size);

    if (group.isSpecial) {
      this.companion.react('excited');
    }
  }

  private onCombo(count: number): void {
    this.comboMultiplier = 1 + count * 0.3;
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;
    this.effects.spawnComboText(centerX, centerY - 80, count);
    this.companion.react('excited');
    this.lastComboTime = this.time.now;
  }

  private onTileCleared(type: TileType, count: number): void {
    this.objectives.forEach(obj => {
      if (obj.type === type && obj.collected < obj.count) {
        obj.collected = Math.min(obj.collected + count, obj.count);
      }
    });
    this.hud.showObjectives(this.objectives);
  }

  private onBoardStable(): void {
    this.comboMultiplier = 1;

    // Check win
    if (this.checkWinCondition()) {
      this.triggerVictory();
      return;
    }

    // Deduct move
    this.movesLeft--;
    this.hud.updateMoves(this.movesLeft);

    if (this.movesLeft <= 0) {
      // Check if objectives still met even with no moves
      if (this.score >= this.scoreTarget) {
        this.triggerVictory();
      } else {
        this.triggerDefeat();
      }
      return;
    }

    if (this.movesLeft <= 5) {
      this.companion.react('worried');
    }

    // Check for deadlock
    if (!this.board.hasMoves()) {
      this.triggerShuffle();
    }
  }

  private onSpellReady(spell: FusedSpell): void {
    this.hud.addSpellToSlot(spell);
    this.companion.react('casting');
    this.effects.spawnComboText(GAME_WIDTH / 2, GAME_HEIGHT * 0.35, 2);

    const notif = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.32, `✨ ${spell.definition.name} READY!`, {
      fontFamily: 'Georgia, serif',
      fontSize: '16px',
      color: `#${spell.definition.color.toString(16).padStart(6, '0')}`,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(DEPTHS.overlay);

    this.tweens.add({
      targets: notif,
      y: notif.y - 50,
      alpha: 0,
      duration: 1500,
      delay: 500,
      ease: 'Power2',
      onComplete: () => notif.destroy(),
    });
  }

  private castSpell(spellType: SpellType): void {
    const spell = this.spellSystem.consumeSpell(spellType);
    if (!spell) return;

    this.board.setInteractive(false);
    this.companion.react('casting');

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.effects.spawnSpellCast(cx, cy, spell.definition.color, spell.definition.name);

    this.time.delayedCall(ANIM.spellCast, () => {
      this.executeSpell(spellType);
      this.board.triggerGravityRefill(() => {
        this.board.setInteractive(true);
      });
    });
  }

  private executeSpell(spellType: SpellType): void {
    switch (spellType) {
      case 'lightning_storm': {
        // Clear 2 random rows with lightning
        const rows = [
          Phaser.Math.Between(0, 3),
          Phaser.Math.Between(4, 7),
        ];
        rows.forEach(row => {
          this.board.clearRow(row);
          // Visual lightning across row
          for (let c = 0; c < BOARD_COLS - 1; c++) {
            const { x: x1, y: y1 } = this.board.gridToWorld(c, row);
            const { x: x2, y: y2 } = this.board.gridToWorld(c + 1, row);
            this.time.delayedCall(c * 50, () =>
              this.effects.spawnLightningEffect(x1, y1, x2, y2),
            );
          }
        });
        this.score += 500;
        break;
      }

      case 'healing_burst': {
        // Heal: remove curses + clear center 3x3
        const centerCol = Math.floor(BOARD_COLS / 2);
        const centerRow = Math.floor(BOARD_ROWS / 2);
        this.board.clearRadius(centerCol, centerRow, 1);
        this.effects.spawnMatchBurst(
          BOARD_OFFSET_X + centerCol * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2,
          BOARD_OFFSET_Y + centerRow * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2,
          PALETTE.green, 8,
        );
        this.score += 400;
        break;
      }

      case 'portal_vortex': {
        // Clear all gems (arcane tiles)
        this.board.clearAllOfType('gem');
        this.board.clearAllOfType('crystal');
        this.effects.screenShake(8, 500);
        this.score += 600;
        break;
      }

      case 'meteor': {
        // Pick a random center and blast 3x3
        const tc = Phaser.Math.Between(1, BOARD_COLS - 2);
        const tr = Phaser.Math.Between(1, BOARD_ROWS - 2);
        const { x: mx, y: my } = this.board.gridToWorld(tc, tr);
        this.effects.spawnMeteorEffect(mx, my, 0xff6644);
        this.time.delayedCall(450, () => this.board.clearRadius(tc, tr, 1));
        this.score += 700;
        break;
      }

      case 'rainbow': {
        // Clear all stars
        this.board.clearAllOfType('star');
        this.effects.screenFlash(PALETTE.gold, 400, 0.4);
        this.score += 550;
        break;
      }

      case 'cat_summon': {
        // Clear random pattern of tiles like a cat's paw print
        const targets = [
          { col: 2, row: 3 }, { col: 3, row: 2 }, { col: 3, row: 4 },
          { col: 4, row: 3 }, { col: 4, row: 5 }, { col: 5, row: 4 },
        ];
        targets.forEach(({ col, row }, i) => {
          this.time.delayedCall(i * 80, () => {
            this.board.clearRadius(col, row, 0);
            const { x, y } = this.board.gridToWorld(col, row);
            this.effects.spawnMatchBurst(x, y, PALETTE.pink, 4);
          });
        });
        this.score += 480;
        break;
      }
    }

    this.hud.updateScore(this.score);
  }

  private checkWinCondition(): boolean {
    const objectivesMet = this.objectives.every(o => o.collected >= o.count);
    return objectivesMet && this.score >= this.scoreTarget;
  }

  private triggerVictory(): void {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.board.setInteractive(false);
    this.companion.react('celebrating');
    this.effects.spawnVictoryBurst(GAME_WIDTH / 2, GAME_HEIGHT / 2);

    this.time.delayedCall(1200, () => {
      const stars = this.calculateStars();
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('VictoryScene', {
          levelId: this.levelId,
          score: this.score,
          stars,
        });
      });
    });
  }

  private triggerDefeat(): void {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.board.setInteractive(false);
    this.companion.react('worried');

    this.effects.screenShake(6, 400);

    // Show "Out of moves" and return to level select
    const defeatOverlay = this.add.graphics().setDepth(DEPTHS.overlay);
    defeatOverlay.fillStyle(0x000000, 0.7);
    defeatOverlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    defeatOverlay.setAlpha(0);

    const defeatText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, 'Out of Moves!', {
      fontFamily: 'Georgia, serif',
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#ff4444',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(DEPTHS.popup).setAlpha(0);

    const scoreText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10, `Score: ${this.score.toLocaleString()}`, {
      fontFamily: 'Georgia, serif',
      fontSize: '22px',
      color: '#ffd700',
    }).setOrigin(0.5).setDepth(DEPTHS.popup).setAlpha(0);

    this.tweens.add({
      targets: [defeatOverlay, defeatText, scoreText],
      alpha: 1,
      duration: 500,
      ease: 'Power2',
    });

    // Retry button
    this.time.delayedCall(600, () => {
      const btnBg = this.add.graphics().setDepth(DEPTHS.popup);
      btnBg.fillStyle(PALETTE.purple, 1);
      btnBg.fillRoundedRect(GAME_WIDTH / 2 - 80, GAME_HEIGHT / 2 + 60, 160, 48, 24);
      btnBg.lineStyle(2, PALETTE.purpleLight, 0.8);
      btnBg.strokeRoundedRect(GAME_WIDTH / 2 - 80, GAME_HEIGHT / 2 + 60, 160, 48, 24);

      const retryText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 84, 'TRY AGAIN', {
        fontFamily: 'Georgia, serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5).setDepth(DEPTHS.popup);

      const zone = this.add.zone(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 84, 160, 48)
        .setInteractive()
        .setDepth(DEPTHS.popup + 1);
      zone.on('pointerdown', () => {
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start('GameScene', { levelId: this.levelId });
        });
      });

      const quitZone = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 140, 'Quit', {
        fontFamily: 'Arial', fontSize: '14px', color: '#9d6fff',
      }).setOrigin(0.5).setDepth(DEPTHS.popup).setInteractive({ useHandCursor: true });
      quitZone.on('pointerdown', () => this.scene.start('LevelSelectScene'));
    });
  }

  private triggerShuffle(): void {
    // No valid moves — show notification and shuffle
    const msg = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Reshuffling...', {
      fontFamily: 'Georgia, serif',
      fontSize: '22px',
      color: '#9d6fff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(DEPTHS.overlay);

    this.tweens.add({
      targets: msg,
      alpha: 0,
      duration: 600,
      delay: 800,
      onComplete: () => msg.destroy(),
    });

    // Flash board
    this.effects.screenFlash(PALETTE.purpleLight, 400, 0.3);
  }

  private calculateStars(): number {
    const pct = this.score / this.scoreTarget;
    if (pct >= 1.5) return 3;
    if (pct >= 1.0) return 2;
    return 1;
  }

  private pauseGame(): void {
    if (this.isGameOver) return;
    this.isPaused = true;
    this.board.setInteractive(false);
    this.pauseMenu.show();
  }

  private resumeGame(): void {
    this.isPaused = false;
    this.board.setInteractive(true);
  }

  private restartGame(): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene', { levelId: this.levelId });
    });
  }

  private quitGame(): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('LevelSelectScene');
    });
  }

  shutdown(): void {
    this.board?.destroy();
    this.companion?.destroy();
  }
}
