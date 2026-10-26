import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { StartScene } from './scenes/StartScene';
import { BattleScene } from './scenes/BattleScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#111111',
  scale: {
    mode: Phaser.Scale.RESIZE, // O canvas assume 100% do tamanho da janela/telemóvel
    parent: 'game',
    width: '100%',
    height: '100%',
  },
  input: { activePointers: 2 },
  scene: [BootScene, StartScene, BattleScene],
});