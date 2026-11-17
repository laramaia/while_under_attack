import Phaser from 'phaser';
import { ENEMY_MAX_HP, HERO_MAX_HP, HOVER_SCALE } from '../config';

const HERO_X = 280;
const HERO_Y = 700;
const ENEMY_X = 1000;
const ENEMY_Y = 700;
const HERO_IDLE = 'hero_idle';
const ENEMY_IDLE = 'enemy_idle';

export class GameArea extends Phaser.GameObjects.Container {
  private hero: Phaser.GameObjects.Sprite;
  private enemy: Phaser.GameObjects.Sprite;

  heroHp = HERO_MAX_HP;
  enemyHp = ENEMY_MAX_HP;

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

  resetHp(): void {
    this.heroHp = HERO_MAX_HP;
    this.enemyHp = ENEMY_MAX_HP;
  }

  damageEnemy(amount: number): void {
    this.enemyHp = Math.max(0, this.enemyHp - amount);
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

    btn.on('pointerover', () => btn.setScale(baseScale * HOVER_SCALE));
    btn.on('pointerout', () => btn.setScale(baseScale));
    btn.on('pointerdown', () => this.emit(eventName));

    this.add(btn);
    return btn;
  }
}