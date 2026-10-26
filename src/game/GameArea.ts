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

    const play = scene.add.text(80, 50, '▶', { fontSize: '56px', color: '#c0392b' })
      .setOrigin(0.5).setInteractive({ useHandCursor: true });
    play.on('pointerdown', () => this.emit('play'));
    this.add(play);

    scene.add.existing(this);
  }

  heroAttack(): void {
    this.hero.play('hero_attack');
    this.hero.once('animationcomplete', () => this.hero.setTexture(HERO_IDLE));
  }
}