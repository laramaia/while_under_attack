import Phaser from 'phaser';
import { BlockTemplate } from '../model/BlockTemplate';
import { BlockInstance } from './BlockInstance';
import { EditorPanel } from './EditorPanel';

interface DragState {
  inst: BlockInstance;
  ox: number;
  oy: number;
  followers: { block: BlockInstance; dx: number; dy: number }[];
}

export class BlockDragger {
  private drag: DragState | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly editor: EditorPanel,
  ) {
    editor.palette.on('template-pressed', this.onTemplatePressed, this);
    editor.workspace.on('block-pressed', this.onBlockPressed, this);

    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onRelease, this);
    scene.input.on('pointerupoutside', this.onRelease, this);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  destroy(): void {
    this.editor.palette.off('template-pressed', this.onTemplatePressed, this);
    this.editor.workspace.off('block-pressed', this.onBlockPressed, this);

    this.scene.input.off('pointermove', this.onMove, this);
    this.scene.input.off('pointerup', this.onRelease, this);
    this.scene.input.off('pointerupoutside', this.onRelease, this);

    this.drag = null;
  }

  private onTemplatePressed(
    template: BlockTemplate,
    wx: number,
    wy: number,
    p: Phaser.Input.Pointer,
  ): void {
    const inst = new BlockInstance(this.scene, template, wx, wy);
    this.start(inst, p.worldX - wx, p.worldY - wy);
  }

  private onBlockPressed(inst: BlockInstance, p: Phaser.Input.Pointer): void {
    const target = this.editor.workspace.resolvePressedBlock(inst, p.worldX, p.worldY);
    const followers = target.template.shape === 'c-block'
      ? this.editor.workspace.detachInnerBlocksForDrag(target)
      : [];

    const m = target.getWorldTransformMatrix();
    const wx = m.tx;
    const wy = m.ty;

    this.editor.workspace.removeBlockInstance(target);
    this.start(target, p.worldX - wx, p.worldY - wy, followers, wx, wy);
  }

  private start(
    inst: BlockInstance,
    ox: number,
    oy: number,
    followers: { block: BlockInstance; dx: number; dy: number }[] = [],
    wx?: number,
    wy?: number,
  ): void {
    this.scene.add.existing(inst);
    inst.setDepth(1000).setAlpha(0.9);
    if (wx !== undefined && wy !== undefined) inst.setPosition(wx, wy);

    for (const f of followers) {
      this.scene.add.existing(f.block);
      f.block.setDepth(1001).setAlpha(0.9);
      f.block.setPosition(inst.x + f.dx, inst.y + f.dy);
    }

    this.drag = { inst, ox, oy, followers };
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!this.drag) return;
    const nx = p.worldX - this.drag.ox;
    const ny = p.worldY - this.drag.oy;
    this.drag.inst.setPosition(nx, ny);

    for (const f of this.drag.followers) {
      f.block.setPosition(nx + f.dx, ny + f.dy);
    }
  }

  private onRelease(p: Phaser.Input.Pointer): void {
    if (!this.drag) return;
    const { inst, ox, oy, followers } = this.drag;
    this.drag = null;

    if (this.editor.workspace.containsWorldPoint(p.worldX, p.worldY)) {
      const dropX = p.worldX - ox;
      const dropY = p.worldY - oy;
      this.editor.workspace.addBlockInstance(inst, dropX, dropY);
      this.editor.workspace.reattachInnerBlocksAfterDrag(inst, followers);
    } else {
      for (const f of followers) {
        f.block.destroy();
      }
      inst.destroy();
    }
  }
}