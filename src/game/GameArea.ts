import Phaser from 'phaser';

const HERO_X = 280;
const HERO_Y = 700;
const ENEMY_X = 1000;
const ENEMY_Y = 700;
const HERO_IDLE = 'hero_idle';
const ENEMY_IDLE = 'enemy_idle';

export class GameArea extends Phaser.GameObjects.Container {
  private hero: Phaser.GameObjects.Sprite;
  private enemy: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);

    this.hero = scene.add.sprite(HERO_X, HERO_Y, HERO_IDLE)
      .setOrigin(0.5, 1)
      .setScale(0.28);
    this.add(this.hero);

    this.enemy = scene.add.sprite(ENEMY_X, ENEMY_Y, ENEMY_IDLE)
      .setOrigin(0.5, 1)
      .setScale(0.28);
    this.add(this.enemy);

    this.createButton('button_play', 80, 52, 56, 'play');
    this.createButton('button_pause', 134, 52, 56, 'pause');

    scene.add.existing(this);
  }

  heroAttack(): void {
    this.hero.play('hero_attack');
    this.hero.once('animationcomplete', () => this.hero.setTexture(HERO_IDLE));
  }

  private createButton(
    key: string,
    x: number,
    y: number,
    height: number,
    eventName: string,
  ): Phaser.GameObjects.Image {
    const btn = this.scene.add.image(x, y, key).setOrigin(0.5);
    const baseScale = height / btn.height;
    btn.setScale(baseScale);
    btn.setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setScale(baseScale * 1.08));
    btn.on('pointerout', () => btn.setScale(baseScale));
    btn.on('pointerdown', () => this.emit(eventName));

    this.add(btn);
    return btn;
  }
}