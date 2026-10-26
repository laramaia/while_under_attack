import Phaser from 'phaser';
import { EditorPanel } from '../editor/EditorPanel';
import { BlockInstance } from '../editor/BlockInstance';
import { GameArea } from '../game/GameArea';
import { createDefaultCatalog } from '../model/defaultCatalog';
import { BlockTemplate } from '../model/BlockTemplate';
import { AddBackground } from '../game/AddBackground';

interface DragState { inst: BlockInstance; ox: number; oy: number }

export class BattleScene extends Phaser.Scene {
  private editor!: EditorPanel;
  private background!: Phaser.GameObjects.Image;
  private drag: DragState | null = null;

  constructor() {
    super('BattleScene');
  }

  create(): void {
    this.background = AddBackground(this);

    const gameArea = new GameArea(this);
    gameArea.on('play', () => {
      gameArea.heroAttack();
      console.log('[play] programa:', this.editor.workspace.roots);
    });

    const catalog = createDefaultCatalog();
    this.editor = new EditorPanel(this, catalog);
    this.editor.setDepth(500);
    this.add.existing(this.editor);

    this.scale.on('resize', () => {
      this.adjustCameraToScreen();
    });

    this.adjustCameraToScreen();

    this.editor.palette.on('template-pressed',
      (template: BlockTemplate, wx: number, wy: number, p: Phaser.Input.Pointer) => {
        this.startDrag(new BlockInstance(this, template, wx, wy), p.x - wx, p.y - wy);
      });

    this.editor.workspace.on('block-pressed', (inst: BlockInstance, p: Phaser.Input.Pointer) => {
      const m = inst.getWorldTransformMatrix();
      const wx = m.tx, wy = m.ty;
      this.editor.workspace.removeBlockInstance(inst);
      this.startDrag(inst, p.x - wx, p.y - wy, wx, wy);
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.drag) this.drag.inst.setPosition(p.x - this.drag.ox, p.y - this.drag.oy);
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.endDrag(p));
  }

  private adjustCameraToScreen(): void {
    const screenWidth = this.scale.width;
    const screenHeight = this.scale.height;
    const baseWidth = 1280;
    const baseHeight = 720;
    const scaleX = screenWidth / baseWidth;
    const scaleY = screenHeight / baseHeight;
    const zoom = Math.min(scaleX, scaleY);

    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(baseWidth / 2, baseHeight / 2);

    if (this.background) {
      this.background.setPosition(baseWidth / 2, baseHeight / 2);
      
      const effectiveWidth = screenWidth / zoom;
      const effectiveHeight = screenHeight / zoom;
      const bgScaleX = effectiveWidth / this.background.width;
      const bgScaleY = effectiveHeight / this.background.height;
      
      this.background.setScale(Math.max(bgScaleX, bgScaleY));
    }
  }

  private startDrag(inst: BlockInstance, ox: number, oy: number, wx?: number, wy?: number): void {
    this.add.existing(inst);
    inst.setDepth(1000).setAlpha(0.9);
    if (wx !== undefined && wy !== undefined) inst.setPosition(wx, wy);
    this.drag = { inst, ox, oy };
  }

  private endDrag(p: Phaser.Input.Pointer): void {
    if (!this.drag) return;
    const { inst, ox, oy } = this.drag;
    this.drag = null;

    if (this.editor.workspace.containsWorldPoint(p.x, p.y)) {
      this.editor.workspace.addBlockInstance(inst, p.x - ox, p.y - oy);
    } else {
      inst.destroy();
    }
  }
}