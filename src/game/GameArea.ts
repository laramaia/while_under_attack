import Phaser from 'phaser';
import {
  ENEMY_MAX_HP, HERO_MAX_HP, HOVER_SCALE,
  ENEMY_DAMAGE,
  ENEMY_START_X,
  ENEMY_STOP_X,
  ENEMY_WALK_MS,
  ENEMY_FADE_MS,
  ENEMY_DEATH_DELAY_MS,
  ENEMY_STOP_X_F02,
  HERO_FADE_MS,
  HERO_DEATH_DELAY_MS,
} from '../config';

const HERO_START_X = 280;
const HERO_Y = 700;
const ENEMY_X = 1000;
const ENEMY_Y = 700;
const HERO_IDLE = 'hero_idle';
const ENEMY_IDLE = 'enemy_idle';
const ATTACK_RANGE = 300;
const ADVANCE_DISTANCE = 250;

export class GameArea extends Phaser.GameObjects.Container {
  private hero: Phaser.GameObjects.Sprite;
  private enemy: Phaser.GameObjects.Sprite;
  private dying: Promise<void> | null = null;
  private heroDying: Promise<void> | null = null;

  heroHp = HERO_MAX_HP;
  enemyHp = ENEMY_MAX_HP;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);

    this.hero = scene.add.sprite(HERO_START_X, HERO_Y, HERO_IDLE)
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

  heroAdvance(): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.hero,
        x: this.hero.x + ADVANCE_DISTANCE,
        duration: 400,
        onComplete: () => resolve(),
      });
    });
  }

  isEnemyInRange(): boolean {
    const distance = Math.abs(this.enemy.x - this.hero.x);
    return distance <= ATTACK_RANGE;
  }

  resetHp(maxHp: number = ENEMY_MAX_HP): void {
    this.heroHp = HERO_MAX_HP;
    this.enemyHp = maxHp;
  }

  resetPositions(): void {
    this.hero.setX(HERO_START_X);
    this.hero.setAlpha(1);
    this.hero.setVisible(true);
    this.enemy.setX(ENEMY_X);
    this.enemy.setAlpha(1);
    this.enemy.setVisible(true);
    this.enemy.setTexture(ENEMY_IDLE);
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

  /** Espera a animacao de morte do guerreiro, se ela estiver rodando. */
  async waitHeroDeath(): Promise<void> {
    await this.heroDying;
    this.heroDying = null;
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

  enemyApproach(stopX?: number, phase: 1 | 2 = 1): Promise<void> {
    const targetX = stopX ?? (phase === 2 ? ENEMY_STOP_X_F02 : ENEMY_STOP_X);

    this.scene.tweens.killTweensOf(this.enemy);
    this.enemy.stop();
    this.enemy.setX(ENEMY_START_X);
    this.enemy.setAlpha(1);
    this.enemy.setVisible(true);
    this.enemy.setTexture(ENEMY_IDLE);
    this.enemy.play({ key: 'cursed_knight_move', repeat: -1 });

    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.enemy,
        x: targetX,
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
    const before = this.heroHp;
    this.heroHp = Math.max(0, this.heroHp - amount);
    // Mesma condicao do damageEnemy: dispara na travessia do zero, e nao
    // sempre que a vida esta em zero. Sem isso, o `enemyAttacksUntilHeroDies`
    // comecaria uma animacao de morte por golpe depois do primeiro.
    if (before > 0 && this.heroHp === 0) this.heroDying = this.heroDie();
  }

  /** O guerreiro cai: some da cena, como o inimigo faz ao morrer.
   *
   * Nao ha sprite de morte do guerreiro -- `public/assets/characters/hero`
   * tem idle e attack. Entao a queda e um tween de alpha, igual a do inimigo.
   * Quando houver arte propria, e aqui que ela entra.
   */
  private heroDie(): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.hero,
        alpha: 0,
        delay: HERO_DEATH_DELAY_MS,
        duration: HERO_FADE_MS,
        onComplete: () => {
          this.hero.setVisible(false);
          resolve();
        },
      });
    });
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