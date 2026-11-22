import Phaser from 'phaser';
import { showLoadingBar } from '../ui/loadingBar';

const HERO_ATTACK_FRAMES = 29;
const CURSED_KNIGHT_MOVE_FRAMES = 29;
const HERO_MOVE_FRAMES = 2;
const HERO_MOVE_FRAME_RATE = 6;
const ANIMATION_FRAME_RATE = 14;

const pad = (n: number): string => String(n).padStart(4, '0');

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.error(
        `Falha ao carregar o recurso: ${file.key}`,
        file.src,
      );
    });
    this.loadAssets();
    showLoadingBar(this);
  }

  create(): void {
    this.createAnimations();
    this.scene.start('LoginScene');
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
    this.loadFrames(
      'hero_move',
      'assets/characters/hero/move',
      HERO_MOVE_FRAMES,
    );
    this.loadFrames(
      'hero_attack',
      'assets/characters/hero/attack',
      HERO_ATTACK_FRAMES,
    );
    this.load.image(
      'enemy_idle',
      'assets/characters/enemies/enemy_idle.png',
    );
    this.loadFrames(
      'cursed_knight',
      'assets/characters/enemies/move',
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

    if (!this.anims.exists('hero_move')) {
      this.anims.create({
        key: 'hero_move',
        frames: Array.from(
          { length: HERO_MOVE_FRAMES },
          (_, i) => ({ key: `hero_move_${pad(i + 1)}` }),
        ),
        frameRate: HERO_MOVE_FRAME_RATE,
        repeat: -1,
      });
    }

    if (!this.anims.exists('cursed_knight_move')) {
      this.anims.create({
        key: 'cursed_knight_move',
        frames: Array.from(
          { length: CURSED_KNIGHT_MOVE_FRAMES },
          (_, i) => ({
            key: `cursed_knight_${pad(i + 1)}`,
          }),
        ),
        frameRate: ANIMATION_FRAME_RATE,
      });
    }
  }
}