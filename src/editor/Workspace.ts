import Phaser from 'phaser';
import { GAME_H } from '../config';
import { BlockInstance } from './BlockInstance';

export class Workspace extends Phaser.GameObjects.Container {
  readonly activeBlocks: BlockInstance[] = [];
  readonly roots: BlockInstance[] = [];

  private readonly areaW: number;
  private readonly areaH = GAME_H;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number) {
    super(scene, x, y);
    this.areaW = width;
    this.setSize(width, this.areaH);

    const title = scene.add.text(40, 36, 'Workspace', {
      fontFamily: 'Georgia, serif', fontSize: '34px', color: '#4a4242',
    }).setOrigin(0, 0.5);
    this.add(title);
  }

  containsWorldPoint(wx: number, wy: number): boolean {
    const m = this.getWorldTransformMatrix();
    return wx >= m.tx && wx <= m.tx + this.areaW && wy >= m.ty && wy <= m.ty + this.areaH;
  }

  addBlockInstance(inst: BlockInstance, wx: number, wy: number): void {
    const m = this.getWorldTransformMatrix();
    const lx = Phaser.Math.Clamp(wx - m.tx, 0, this.areaW - inst.width);
    const ly = Phaser.Math.Clamp(wy - m.ty, 70, this.areaH - inst.height);

    this.add(inst); 
    inst.setPosition(lx, ly).setDepth(0).setAlpha(1);

    if (!inst.input) inst.enableHit();
    inst.removeAllListeners('pointerdown');
    inst.on('pointerdown', (p: Phaser.Input.Pointer) => this.emit('block-pressed', inst, p));

    this.activeBlocks.push(inst);
    this.roots.push(inst); 
    this.emit('block-dropped', inst);
  }

  removeBlockInstance(inst: BlockInstance): void {
    this.remove(inst, false);
    this.activeBlocks.splice(this.activeBlocks.indexOf(inst), 1);
    const r = this.roots.indexOf(inst);
    if (r >= 0) this.roots.splice(r, 1);
  }
}
