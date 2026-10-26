import Phaser from 'phaser';
import { BlockTemplate } from '../model/BlockTemplate';
import { BlockView } from './BlockView';

/** Cópia viva de um BlockTemplate (a que o jogador arrasta e solta no Workspace) */
export class BlockInstance extends BlockView {
  readonly id: string = Phaser.Utils.String.UUID();

  next: BlockInstance | null = null;   
  inner: BlockInstance[] = [];        

  constructor(scene: Phaser.Scene, template: BlockTemplate, x = 0, y = 0) {
    super(scene, template, x, y);
  }
}
