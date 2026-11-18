import Phaser from 'phaser';
import {
  ENEMY_MAX_HP, HERO_MAX_HP, HOVER_SCALE,
  ENEMY_DAMAGE,
  ENEMY_START_X,
  ENEMY_STOP_X,
  ENEMY_WALK_MS,
  ENEMY_FADE_MS,
  ENEMY_DEATH_DELAY_MS,

} from '../config';

const HERO_X = 280;
const HERO_Y = 700;
const ENEMY_X = 1000;
const ENEMY_Y = 700;
const HERO_IDLE = 'hero_idle';
const ENEMY_IDLE = 'enemy_idle';

export class GameArea extends Phaser.GameObjects.Container {
  private hero: Phaser.GameObjects.Sprite;
  private enemy: Phaser.GameObjects.Sprite;
  private dying: Promise<void> | null = null;

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
    const before = this.enemyHp;
    this.enemyHp = Math.max(0, this.enemyHp - amount);
    if (before > 0 && this.enemyHp === 0) this.dying = this.enemyDie();
  }

  async waitEnemyDeath(): Promise<void> {
    await this.dying;
    this.dying = null;
  }

  private enemyDie(): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.enemy,
        alpha: 0,
        delay: ENEMY_DEATH_DELAY_MS,
        duration: ENEMY_FADE_MS,
        onComplete: () => {
          this.enemy.setVisible(false);
          resolve();
        },
      });
    });
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

  enemyApproach(): Promise<void> {
    this.enemy.setX(ENEMY_START_X);
    this.enemy.play({ key: 'cursed_knight_move', repeat: -1 });

    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.enemy,
        x: ENEMY_STOP_X,
        duration: ENEMY_WALK_MS,
        onComplete: () => {
          this.enemy.stop();
          this.enemy.setTexture(ENEMY_IDLE);
          resolve();
        },
      });
    });
  }

  async enemyAttacksUntilHeroDies(): Promise<void> {
    while (this.heroHp > 0) {
      await this.lunge();
      this.damageHero(ENEMY_DAMAGE);
    }
  }

  damageHero(amount: number): void {
    this.heroHp = Math.max(0, this.heroHp - amount);
  }

  private lunge(): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.enemy,
        x: this.enemy.x - 60,
        duration: 150,
        yoyo: true,
        onComplete: () => resolve(),
      });
    });
  }
}