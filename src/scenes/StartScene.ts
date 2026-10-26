import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config';
import { AddBackground } from '../game/AddBackground';

export class StartScene extends Phaser.Scene {
  private background!: Phaser.GameObjects.Image;
  private logo!: Phaser.GameObjects.Image;
  private playButton!: Phaser.GameObjects.Text;

  constructor() { 
    super('StartScene'); 
  }

  preload(): void {
    this.load.image('logo', 'assets/logo.png');
  }

  create(): void {
    this.background = AddBackground(this);
    this.logo = this.add.image(0, 0, 'logo').setOrigin(0.5).setScale(0.30);
    this.playButton = this.add.text(0, 0, 'Jogar', {
      fontFamily: 'Georgia, serif', 
      fontSize: '28px', 
      color: '#ffffff',
      backgroundColor: '#8c3b3b', 
      padding: { x: 40, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.playButton.on('pointerdown', () => this.scene.start('BattleScene'));
    this.updateLayout();
    this.scale.on('resize', () => {
      this.updateLayout();
    });
  }

  private updateLayout(): void {
    const screenWidth = this.scale.width;
    const screenHeight = this.scale.height;
    const scaleX = screenWidth / GAME_W;
    const scaleY = screenHeight / GAME_H;
    const zoom = Math.min(scaleX, scaleY);

    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(GAME_W / 2, GAME_H / 2);

    if (this.background) {
      this.background.setPosition(GAME_W / 2, GAME_H / 2);
      const effectiveWidth = screenWidth / zoom;
      const effectiveHeight = screenHeight / zoom;
      const bgScaleX = effectiveWidth / this.background.width;
      const bgScaleY = effectiveHeight / this.background.height;
      this.background.setScale(Math.max(bgScaleX, bgScaleY));
    }

    if (this.logo) {
      this.logo.setPosition(GAME_W / 2, (GAME_H / 2) - 120);
    }

    if (this.playButton) {
      this.playButton.setPosition(GAME_W / 2, (GAME_H / 2) + 130);
    }
  }
}