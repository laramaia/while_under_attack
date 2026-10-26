import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config';

const HERO_ATTACK_FRAMES = 29;
const CURSED_KNIGHT_MOVE_FRAMES = 29;
const ANIMATION_FRAME_RATE = 14;
const pad = (n: number): string => String(n).padStart(4, '0');

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.showLoadingBar();
    this.loadAssets();
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.error(
        `Falha ao carregar o recurso: ${file.key}`,
        file.src,
      );
    });
  }

  create(): void {
    this.createAnimations();
    this.scene.start('StartScene');
  }

  private loadAssets(): void {
    this.load.image('background', 'assets/background.png');
    this.load.image('panel_palette', 'assets/ui/panel/panel_palette.png');
    this.load.image('panel_workspace', 'assets/ui/panel/panel_workspace.png');
    this.load.image('panel_arrow', 'assets/ui/panel/panel_arrow.png');
    this.load.image(
      'hero_idle',
      'assets/characters/hero/hero_idle.png',
    );
    this.load.image(
      'enemy_idle',
      'assets/characters/enemies/enemy_idle.png',
    );
    this.loadFrames(
      'hero_attack',
      'assets/characters/hero/attack',
      HERO_ATTACK_FRAMES,
    );
    this.loadFrames(
      'cursed_knight_move',
      'assets/characters/enemies/cursed_knight/move',
      CURSED_KNIGHT_MOVE_FRAMES,
    );
  }

  private loadFrames(
    keyPrefix: string,
    path: string,
    totalFrames: number,
  ): void {
    for (let i = 1; i <= totalFrames; i++) {
      const frame = `${keyPrefix}_${pad(i)}`;

      this.load.image(
        frame,
        `${path}/${frame}.png`,
      );
    }
  }

  private createAnimations(): void {
    if (!this.anims.exists('hero_attack')) {
      this.anims.create({
        key: 'hero_attack',
        frames: Array.from(
          { length: HERO_ATTACK_FRAMES },
          (_, i) => ({
            key: `hero_attack_${pad(i + 1)}`,
          }),
        ),
        frameRate: ANIMATION_FRAME_RATE,
      });
    }

    if (!this.anims.exists('cursed_knight_move')) {
      this.anims.create({
        key: 'cursed_knight_move',
        frames: Array.from(
          { length: CURSED_KNIGHT_MOVE_FRAMES },
          (_, i) => ({
            key: `cursed_knight_move_${pad(i + 1)}`,
          }),
        ),
        frameRate: ANIMATION_FRAME_RATE,
      });
    }
  }

  private showLoadingBar(): void {
    const width = 500;
    const height = 24;
    const x = (GAME_W - width) / 2;
    const y = (GAME_H - height) / 2;
    const frame = this.add.graphics()
      .lineStyle(3, 0xffffff)
      .strokeRect(x, y, width, height);
    const fill = this.add.graphics();

    this.load.on('progress', (progress: number) => {
      fill.clear()
        .fillStyle(0xffffff)
        .fillRect(
          x + 4,
          y + 4,
          (width - 8) * progress,
          height - 8,
        );
    });
    this.load.once('complete', () => {
      frame.destroy();
      fill.destroy();
    });
  }
}