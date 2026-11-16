import Phaser from 'phaser';
import {
  GAME_H,
  HOVER_SCALE,
  RESTART_GAP,
  RESTART_H,
  WORKSPACE_DROP_MIN_Y,
  WORKSPACE_TITLE_COLOR,
  WORKSPACE_TITLE_FONT,
  WORKSPACE_TITLE_SIZE,
  WORKSPACE_TITLE_X,
  WORKSPACE_TITLE_Y,
} from '../config';
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

    const title = this.buildTitle();
    this.buildRestartButton(title);
  }

  containsWorldPoint(wx: number, wy: number): boolean {
    const m = this.getWorldTransformMatrix();
    return wx >= m.tx && wx <= m.tx + this.areaW && wy >= m.ty && wy <= m.ty + this.areaH;
  }

  addBlockInstance(inst: BlockInstance, wx: number, wy: number): void {
    const m = this.getWorldTransformMatrix();
    const lx = Phaser.Math.Clamp(wx - m.tx, 0, this.areaW - inst.width);
    const ly = Phaser.Math.Clamp(wy - m.ty, WORKSPACE_DROP_MIN_Y, this.areaH - inst.height);

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

    const a = this.activeBlocks.indexOf(inst);
    if (a >= 0) this.activeBlocks.splice(a, 1);

    const r = this.roots.indexOf(inst);
    if (r >= 0) this.roots.splice(r, 1);
  }

  clearBlocks(): void {
    [...this.activeBlocks].forEach((inst) => inst.destroy());
    this.activeBlocks.length = 0;
    this.roots.length = 0;
    this.emit('blocks-cleared');
  }

  private buildTitle(): Phaser.GameObjects.Text {
    const title = this.scene.add
      .text(WORKSPACE_TITLE_X, WORKSPACE_TITLE_Y, 'Workspace', {
        fontFamily: WORKSPACE_TITLE_FONT,
        fontSize: WORKSPACE_TITLE_SIZE,
        color: WORKSPACE_TITLE_COLOR,
      })
      .setOrigin(0, 0.5);

    this.add(title);
    return title;
  }

  private buildRestartButton(title: Phaser.GameObjects.Text): void {
    const btn = this.scene.add
      .image(0, WORKSPACE_TITLE_Y, 'button_restart')
      .setOrigin(0.5);
    const baseScale = RESTART_H / btn.height;

    btn.setScale(baseScale);
    btn.setX(title.x + title.width + RESTART_GAP + btn.displayWidth / 2);
    btn.setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setScale(baseScale * HOVER_SCALE));
    btn.on('pointerout', () => btn.setScale(baseScale));
    btn.on('pointerdown', () => {
      this.clearBlocks();
      this.emit('restart');
    });

    this.add(btn);
  }
}