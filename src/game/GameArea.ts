import Phaser from 'phaser';
import {
  ATTACK_DAMAGE,
  ENEMY_MAX_HP,
  HERO_MAX_HP,
  HOVER_SCALE,
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
import { EnemyEncounter, Level } from '../model/level';

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
  private enemySprites: Phaser.GameObjects.Sprite[] = [];
  private dying: Promise<void> | null = null;
  private heroDying: Promise<void> | null = null;
  private pauseBtn!: Phaser.GameObjects.Image;
  private pauseEnabled = false;

  private encounters: EnemyEncounter[] = [];
  private currentEncounterIndex = 0;
  private nextEnemyPromise: Promise<void> | null = null;
  private currentAdvanceDistance = ADVANCE_DISTANCE;

  heroHp = HERO_MAX_HP;
  enemyHp = ENEMY_MAX_HP;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);

    this.hero = scene.add.sprite(HERO_START_X, HERO_Y, HERO_IDLE)
      .setOrigin(0.5, 1)
      .setScale(0.28);
    this.add(this.hero);

    this.createButton('button_play', 80, 52, 56, 'play');

    this.pauseBtn = this.createButton('button_pause', 134, 52, 56, 'pause', () => this.pauseEnabled);
    this.pauseBtn.setAlpha(0.4);

    scene.add.existing(this);
  }

  private get activeEnemy(): Phaser.GameObjects.Sprite | undefined {
    return this.enemySprites[this.currentEncounterIndex];
  }

  get allEnemiesDefeated(): boolean {
    if (this.encounters.length === 0) {
      return this.enemyHp <= 0;
    }
    const isLastEncounter = this.currentEncounterIndex >= this.encounters.length - 1;
    return isLastEncounter && this.enemyHp <= 0;
  }

  configureEncounters(level: Level): void {
    this.nextEnemyPromise = null;
    this.currentEncounterIndex = 0;
    this.currentAdvanceDistance = level.advanceDistance ?? ADVANCE_DISTANCE;

    if (level.enemies && level.enemies.length > 0) {
      this.encounters = level.enemies;
    } else {
      this.encounters = [
        {
          enemy: level.enemy,
          hits: level.enemyHits,
          startX: ENEMY_START_X,
          stopX: level.enemyStopX ?? ENEMY_STOP_X,
          advanceOnSpawn: true,
        },
      ];
    }

    this.rebuildEnemySprites();
    this.enemyHp = (this.encounters[0]?.hits ?? level.enemyHits) * ATTACK_DAMAGE;
  }

  private rebuildEnemySprites(): void {
    for (const sprite of this.enemySprites) {
      this.scene.tweens.killTweensOf(sprite);
      sprite.destroy();
    }
    this.enemySprites = [];

    this.encounters.forEach((encounter, idx) => {
      const initialX =
        encounter.startX ?? encounter.stopX ?? (idx === 0 ? ENEMY_X : ENEMY_X + idx * 140);
      const sprite = this.scene.add
        .sprite(initialX, ENEMY_Y, ENEMY_IDLE)
        .setOrigin(0.5, 1)
        .setScale(0.28)
        .setAlpha(1)
        .setVisible(true);

      this.add(sprite);
      this.enemySprites.push(sprite);
    });
  }

  heroAttack(): void {
    this.hero.play('hero_attack');
    this.hero.once('animationcomplete', () => this.hero.setTexture(HERO_IDLE));
  }

  heroAdvance(): Promise<void> {
    this.hero.play('hero_move');

    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.hero,
        x: this.hero.x + this.currentAdvanceDistance,
        duration: 400,
        onComplete: () => {
          this.hero.stop();
          this.hero.setTexture(HERO_IDLE);
          resolve();
        },
      });
    });
  }

  isEnemyInRange(): boolean {
    const current = this.activeEnemy;
    if (!current || !current.visible || this.enemyHp <= 0) return false;
    const distance = Math.abs(current.x - this.hero.x);
    return distance <= ATTACK_RANGE;
  }

  resetHp(maxHp: number = ENEMY_MAX_HP): void {
    this.heroHp = HERO_MAX_HP;
    const firstEncounter = this.encounters[0];
    this.enemyHp = firstEncounter ? firstEncounter.hits * ATTACK_DAMAGE : maxHp;
  }

  resetPositions(): void {
    this.currentEncounterIndex = 0;
    this.nextEnemyPromise = null;
    this.hero.setX(HERO_START_X);
    this.hero.setAlpha(1);
    this.hero.setVisible(true);

    if (this.enemySprites.length === 0) {
      const fallback = this.scene.add
        .sprite(ENEMY_X, ENEMY_Y, ENEMY_IDLE)
        .setOrigin(0.5, 1)
        .setScale(0.28);
      this.add(fallback);
      this.enemySprites.push(fallback);
    }

    this.enemySprites.forEach((sprite, idx) => {
      this.scene.tweens.killTweensOf(sprite);
      const encounter = this.encounters[idx];
      const initialX =
        encounter?.startX ?? encounter?.stopX ?? (idx === 0 ? ENEMY_X : ENEMY_X + idx * 140);
      sprite.setX(initialX);
      sprite.setAlpha(1);
      sprite.setVisible(true);
      sprite.stop();
      sprite.setTexture(ENEMY_IDLE);
    });
  }

  damageEnemy(amount: number): void {
    const before = this.enemyHp;
    this.enemyHp = Math.max(0, this.enemyHp - amount);
    if (before > 0 && this.enemyHp === 0) {
      this.dying = this.handleEnemyDefeated().finally(() => {
        this.dying = null;
      });
    }
  }

  private async handleEnemyDefeated(): Promise<void> {
    const defeatedSprite = this.activeEnemy;
    if (defeatedSprite) {
      await this.enemyDie(defeatedSprite);
    }

    const nextIndex = this.currentEncounterIndex + 1;
    if (nextIndex < this.encounters.length) {
      this.nextEnemyPromise = this.activateNextEncounter(nextIndex);
      await this.nextEnemyPromise;
      this.nextEnemyPromise = null;
    }
  }

  private activateNextEncounter(index: number): Promise<void> {
    this.currentEncounterIndex = index;
    const encounter = this.encounters[index];
    this.enemyHp = encounter.hits * ATTACK_DAMAGE;

    const sprite = this.activeEnemy;
    if (!sprite) return Promise.resolve();

    const targetX = encounter.stopX ?? sprite.x;
    this.scene.tweens.killTweensOf(sprite);
    sprite.stop();
    sprite.setAlpha(1);
    sprite.setVisible(true);
    sprite.setTexture(ENEMY_IDLE);

    if (encounter.advanceOnSpawn === false || Math.abs(sprite.x - targetX) < 1) {
      sprite.setX(targetX);
      return Promise.resolve();
    }

    sprite.play({ key: 'cursed_knight_move', repeat: -1 });

    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: sprite,
        x: targetX,
        duration: ENEMY_WALK_MS,
        onComplete: () => {
          sprite.stop();
          sprite.setTexture(ENEMY_IDLE);
          resolve();
        },
      });
    });
  }

  async waitNextEnemyReady(): Promise<void> {
    if (this.dying) {
      await this.dying;
    }
    if (this.nextEnemyPromise) {
      await this.nextEnemyPromise;
    }
  }

  async waitEnemyDeath(): Promise<void> {
    await this.dying;
    this.dying = null;
  }

  async waitHeroDeath(): Promise<void> {
    await this.heroDying;
    this.heroDying = null;
  }

  private enemyDie(target: Phaser.GameObjects.Sprite): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: target,
        alpha: 0,
        delay: ENEMY_DEATH_DELAY_MS,
        duration: ENEMY_FADE_MS,
        onComplete: () => {
          target.setVisible(false);
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
    canPress: () => boolean = () => true,
  ): Phaser.GameObjects.Image {
    const btn = this.scene.add.image(x, y, key).setOrigin(0.5);
    const baseScale = height / btn.height;
    btn.setScale(baseScale);
    btn.setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => {
      if (canPress()) btn.setScale(baseScale * HOVER_SCALE);
    });
    btn.on('pointerout', () => btn.setScale(baseScale));
    btn.on('pointerdown', () => {
      if (canPress()) this.emit(eventName);
    });

    this.add(btn);
    return btn;
  }

  setPauseEnabled(enabled: boolean): void {
    this.pauseEnabled = enabled;
    this.pauseBtn.setAlpha(enabled ? 1 : 0.4);
  }

  enemyApproach(stopX?: number, phase: 1 | 2 = 1): Promise<void> {
    const firstEncounter = this.encounters[0];
    const targetX = stopX ?? firstEncounter?.stopX ?? (phase === 2 ? ENEMY_STOP_X_F02 : ENEMY_STOP_X);
    const firstSprite = this.enemySprites[0];

    if (!firstSprite) return Promise.resolve();

    const startX = firstEncounter?.startX ?? ENEMY_START_X;
    this.scene.tweens.killTweensOf(firstSprite);
    firstSprite.stop();
    firstSprite.setX(startX);
    firstSprite.setAlpha(1);
    firstSprite.setVisible(true);
    firstSprite.setTexture(ENEMY_IDLE);
    firstSprite.play({ key: 'cursed_knight_move', repeat: -1 });

    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: firstSprite,
        x: targetX,
        duration: ENEMY_WALK_MS,
        onComplete: () => {
          firstSprite.stop();
          firstSprite.setTexture(ENEMY_IDLE);
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
    if (before > 0 && this.heroHp === 0) this.heroDying = this.heroDie();
  }

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
    const target = this.activeEnemy ?? this.enemySprites[0];
    if (!target) return Promise.resolve();

    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: target,
        x: target.x - 60,
        duration: 150,
        yoyo: true,
        onComplete: () => resolve(),
      });
    });
  }
}