import Phaser from 'phaser';
import { PALETTE, GAME_WIDTH, GAME_HEIGHT, DEPTHS } from '../../config/Constants';
import { fillStar } from '../../utils/GraphicsUtils';

type CatMood = 'idle' | 'excited' | 'casting' | 'celebrating' | 'worried';

export class CatCompanion {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private catImage!: Phaser.GameObjects.Image;
  private speechBubble!: Phaser.GameObjects.Container;
  private speechText!: Phaser.GameObjects.Text;
  private currentMood: CatMood = 'idle';
  private idleTween: Phaser.Tweens.Tween | null = null;
  private sparkleTimer: Phaser.Time.TimerEvent | null = null;
  private readonly homeX: number;
  private readonly homeY: number;

  private readonly messages = {
    idle:        ['Tap to swap!', 'Make a match!', 'Let\'s go!', '✨ Magic awaits...'],
    excited:     ['COMBO!', 'Purrfect!', 'Meowgic!', 'AMAZING!', 'Keep going!'],
    casting:     ['SPELL CAST!', 'MEOWGIC!!!', '⚡ UNLEASH!', '🌀 VORTEX!'],
    celebrating: ['YOU WIN! 🎉', 'PURRFECT!', 'Meow-nificent!', '🏆 BRILLIANT!'],
    worried:     ['Only a few moves!', 'Watch out!', 'Stay focused!', 'Hmm...'],
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.homeX = GAME_WIDTH - 52;
    this.homeY = GAME_HEIGHT - 180;
    this.build();
  }

  private build(): void {
    this.container = this.scene.add.container(this.homeX, this.homeY);
    this.container.setDepth(DEPTHS.companion);

    // Shadow
    const shadow = this.scene.add.graphics();
    shadow.fillStyle(0x000000, 0.25);
    shadow.fillEllipse(0, 42, 60, 16);
    this.container.add(shadow);

    // Cat wizard image
    this.catImage = this.scene.add.image(0, 0, 'cat_wizard').setScale(0.52);
    this.container.add(this.catImage);

    // Build speech bubble (hidden by default)
    this.buildSpeechBubble();

    // Start idle
    this.startIdleAnimation();
    this.startAmbientSparkles();
  }

  private buildSpeechBubble(): void {
    this.speechBubble = this.scene.add.container(-55, -70);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0xffffff, 0.95);
    bg.fillRoundedRect(-55, -18, 110, 36, 8);
    bg.lineStyle(2, PALETTE.purpleLight, 0.8);
    bg.strokeRoundedRect(-55, -18, 110, 36, 8);
    // Tail
    bg.fillStyle(0xffffff, 0.95);
    bg.fillTriangle(10, 18, 20, 18, 15, 28);
    bg.lineStyle(2, PALETTE.purpleLight, 0.8);
    bg.lineBetween(10, 18, 15, 28);
    bg.lineBetween(15, 28, 20, 18);

    this.speechText = this.scene.add.text(0, 0, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#2d1b69',
    }).setOrigin(0.5);

    this.speechBubble.add([bg, this.speechText]);
    this.speechBubble.setAlpha(0);
    this.container.add(this.speechBubble);
  }

  private startIdleAnimation(): void {
    this.idleTween?.stop();
    this.idleTween = this.scene.tweens.add({
      targets: this.container,
      y: this.homeY - 8,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private startAmbientSparkles(): void {
    this.sparkleTimer = this.scene.time.addEvent({
      delay: 900,
      loop: true,
      callback: this.emitSparkle,
      callbackScope: this,
    });
  }

  private emitSparkle(): void {
    if (this.currentMood === 'idle') {
      const g = this.scene.add.graphics()
        .setDepth(DEPTHS.companion + 1)
        .setPosition(
          this.container.x + Phaser.Math.Between(-20, 20),
          this.container.y + Phaser.Math.Between(-50, 0),
        );
      g.fillStyle(PALETTE.gold, 0.85);
      fillStar(g, 0, 0, 4, 4, 2, 0);

      this.scene.tweens.add({
        targets: g,
        y: g.y - 25,
        alpha: 0,
        scaleX: 0,
        scaleY: 0,
        duration: 600,
        ease: 'Power2',
        onComplete: () => g.destroy(),
      });
    }
  }

  react(mood: CatMood): void {
    this.currentMood = mood;

    const msgs = this.messages[mood];
    const msg = msgs[Math.floor(Math.random() * msgs.length)];
    this.showSpeech(msg);

    switch (mood) {
      case 'excited':     this.playExcitedAnim(); break;
      case 'casting':     this.playCastAnim();    break;
      case 'celebrating': this.playCelebAnim();   break;
      case 'worried':     this.playWorriedAnim(); break;
      default:            break;
    }

    // Return to idle after a bit
    this.scene.time.delayedCall(2500, () => {
      if (this.currentMood === mood) {
        this.currentMood = 'idle';
        this.startIdleAnimation();
      }
    });
  }

  private showSpeech(text: string): void {
    this.speechText.setText(text);
    this.speechBubble.setAlpha(0);
    this.speechBubble.setScale(0.7);

    this.scene.tweens.add({
      targets: this.speechBubble,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });

    this.scene.time.delayedCall(2000, () => {
      this.scene.tweens.add({
        targets: this.speechBubble,
        alpha: 0,
        duration: 300,
        ease: 'Power2',
      });
    });
  }

  private playExcitedAnim(): void {
    this.idleTween?.stop();
    this.scene.tweens.chain({
      targets: this.container,
      tweens: [
        { y: this.homeY - 20, scaleX: 1.15, scaleY: 0.9,  duration: 100, ease: 'Power2' },
        { y: this.homeY + 5,  scaleX: 0.9,  scaleY: 1.15, duration: 80,  ease: 'Bounce' },
        { y: this.homeY - 12, scaleX: 1.1,  scaleY: 0.95, duration: 100 },
        { y: this.homeY,      scaleX: 1,    scaleY: 1,    duration: 100, ease: 'Back.easeOut' },
      ],
      onComplete: () => this.startIdleAnimation(),
    });

    // Burst sparkles
    for (let i = 0; i < 6; i++) {
      this.scene.time.delayedCall(i * 60, () => {
        const g = this.scene.add.graphics()
          .setDepth(DEPTHS.companion + 2)
          .setPosition(
            this.container.x + Phaser.Math.Between(-30, 30),
            this.container.y + Phaser.Math.Between(-60, 10),
          );
        g.fillStyle(PALETTE.gold, 1);
        fillStar(g, 0, 0, 5, 7, 3, 0);
        this.scene.tweens.add({
          targets: g, y: g.y - 40, alpha: 0, duration: 500, ease: 'Power2',
          onComplete: () => g.destroy(),
        });
      });
    }
  }

  private playCastAnim(): void {
    this.idleTween?.stop();
    this.scene.tweens.add({
      targets: this.container,
      x: this.homeX - 20,
      y: this.homeY - 15,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 200,
      ease: 'Back.easeOut',
      yoyo: true,
      onComplete: () => {
        this.container.setPosition(this.homeX, this.homeY);
        this.container.setScale(1);
        this.startIdleAnimation();
      },
    });

    // Wand flash
    const flash = this.scene.add.graphics()
      .setDepth(DEPTHS.companion + 3)
      .setPosition(this.container.x + 20, this.container.y - 50);
    flash.fillStyle(PALETTE.gold, 1);
    flash.fillCircle(0, 0, 18);
    this.scene.tweens.add({
      targets: flash,
      scaleX: 3,
      scaleY: 3,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => flash.destroy(),
    });
  }

  private playCelebAnim(): void {
    this.idleTween?.stop();
    let bounces = 0;
    const doBounce = () => {
      if (bounces >= 4) {
        this.scene.tweens.add({
          targets: this.container,
          x: this.homeX,
          y: this.homeY,
          scaleX: 1,
          scaleY: 1,
          duration: 200,
          onComplete: () => this.startIdleAnimation(),
        });
        return;
      }
      bounces++;
      this.scene.tweens.add({
        targets: this.container,
        y: this.homeY - 30,
        scaleX: 1.1,
        scaleY: 1.1,
        duration: 150,
        yoyo: true,
        ease: 'Bounce',
        onComplete: doBounce,
      });
    };
    doBounce();
  }

  private playWorriedAnim(): void {
    this.idleTween?.stop();
    this.scene.tweens.add({
      targets: this.container,
      x: this.homeX - 6,
      duration: 80,
      yoyo: true,
      repeat: 5,
      ease: 'Power1',
      onComplete: () => {
        this.container.x = this.homeX;
        this.startIdleAnimation();
      },
    });
  }

  destroy(): void {
    this.idleTween?.stop();
    this.sparkleTimer?.remove();
    this.container.destroy();
  }
}
