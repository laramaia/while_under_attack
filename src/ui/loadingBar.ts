import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config';

export function showLoadingBar(scene: Phaser.Scene): void {
  if (scene.load.list.size === 0) return;

  const width = 500;
  const height = 24;
  const x = (GAME_W - width) / 2;
  const y = (GAME_H - height) / 2;
  const frame = scene.add.graphics().lineStyle(3, 0xffffff).strokeRect(x, y, width, height);
  const fill = scene.add.graphics();

  scene.load.on('progress', (progress: number) => {
    fill.clear().fillStyle(0xffffff).fillRect(x + 4, y + 4, (width - 8) * progress, height - 8);
  });
  scene.load.once('complete', () => {
    frame.destroy();
    fill.destroy();
  });
}