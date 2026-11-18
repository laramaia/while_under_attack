import Phaser from 'phaser';
import { BlockTemplate } from '../model/BlockTemplate';
import { BlockInstance } from './BlockInstance';
import { EditorPanel } from './EditorPanel';

interface DragState {
  inst: BlockInstance;
  ox: number;
  oy: number;
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
    const m = inst.getWorldTransformMatrix();
    const wx = m.tx;
    const wy = m.ty;

    this.editor.workspace.removeBlockInstance(inst);
    this.start(inst, p.worldX - wx, p.worldY - wy, wx, wy);
  }

  private start(inst: BlockInstance, ox: number, oy: number, wx?: number, wy?: number): void {
    this.scene.add.existing(inst);
    inst.setDepth(1000).setAlpha(0.9);
    if (wx !== undefined && wy !== undefined) inst.setPosition(wx, wy);
    this.drag = { inst, ox, oy };
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!this.drag) return;
    this.drag.inst.setPosition(p.worldX - this.drag.ox, p.worldY - this.drag.oy);
  }

  private onRelease(p: Phaser.Input.Pointer): void {
    if (!this.drag) return;
    const { inst, ox, oy } = this.drag;
    this.drag = null;

    if (this.editor.workspace.containsWorldPoint(p.worldX, p.worldY)) {
      this.editor.workspace.addBlockInstance(inst, p.worldX - ox, p.worldY - oy);
    } else {
      inst.destroy();
    }
  }
}