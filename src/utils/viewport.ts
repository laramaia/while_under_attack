import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config';

export function getVisibleArea(scene: Phaser.Scene) {
  const zoom = Math.min(scene.scale.width / GAME_W, scene.scale.height / GAME_H);
  const width = scene.scale.width / zoom;
  const height = scene.scale.height / zoom;

  return {
    zoom,
    width,
    height,
    top: GAME_H / 2 - height / 2,
    right: GAME_W / 2 + width / 2,
  };
}