import Phaser from 'phaser';
import { EditorPanel } from '../editor/EditorPanel';
import { BlockInstance } from '../editor/BlockInstance';
import { GameArea } from '../game/GameArea';
import { createDefaultCatalog } from '../model/defaultCatalog';
import { BlockTemplate } from '../model/BlockTemplate';
import { AddBackground } from '../game/AddBackground';
import { ProgramRunner } from '../model/ProgramRunner';
import { getVisibleArea } from '../utils/viewport';
import { GAME_H, GAME_W } from '../config';

interface DragState { inst: BlockInstance; ox: number; oy: number }

export class BattleScene extends Phaser.Scene {
  private editor!: EditorPanel;
  private background!: Phaser.GameObjects.Image;
  private drag: DragState | null = null;

  constructor() {
    super('BattleScene');
  }

  preload(): void {
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.error(
        `Falha ao carregar o recurso: ${file.key}`,
        file.src,
      );
    });
    this.load.image('button_play', 'assets/ui/button_play.png');
    this.load.image('button_pause', 'assets/ui/button_pause.png');
    this.load.image('button_restart', 'assets/ui/button_restart.png');
    this.load.image('palette_tab_background', 'assets/ui/panel/palette_tab_background.png');
    this.load.image('tab_event', 'assets/ui/panel/tab_event.png');
    this.load.image('tab_action', 'assets/ui/panel/tab_action.png');
    this.load.image('tab_repeat', 'assets/ui/panel/tab_repeat.png');
    this.load.image('tab_condition', 'assets/ui/panel/tab_condition.png');
    this.load.image('yellow_block_hat', 'assets/ui/panel/blocks/yellow_block_hat.png');
    this.load.image('blue_block_stack', 'assets/ui/panel/blocks/blue_block_stack.png');

    const blockColors = ['orange', 'purple'];
    const cParts = ['top', 'middle', 'bottom'];

    blockColors.forEach((color) => {
      cParts.forEach((part) => {
        const key = `${color}_block_${part}`;
        this.load.image(key, `assets/ui/panel/blocks/${key}.png`);
      });
    });
  }

  create(): void {
    this.background = AddBackground(this);

    const gameArea = new GameArea(this);
    const runner = new ProgramRunner(gameArea);

    gameArea.on('play', () => {
      console.log('[play] executando programa:', this.editor.workspace.roots);
      runner.run(this.editor.workspace.roots);
    });

    const catalog = createDefaultCatalog();
    this.editor = new EditorPanel(this, catalog);
    this.editor.setDepth(500);
    this.add.existing(this.editor);

    this.scale.on('resize', () => {
      this.adjustCameraToScreen();
      this.editor.onResize();
    });

    this.adjustCameraToScreen();

    this.editor.palette.on('template-pressed',
      (template: BlockTemplate, wx: number, wy: number, p: Phaser.Input.Pointer) => {
        console.log('[2] template-pressed:', template.id, { wx, wy });
        this.startDrag(new BlockInstance(this, template, wx, wy), p.worldX - wx, p.worldY - wy);
      });

    this.editor.workspace.on('block-pressed', (inst: BlockInstance, p: Phaser.Input.Pointer) => {
      const m = inst.getWorldTransformMatrix();
      const wx = m.tx, wy = m.ty;
      this.editor.workspace.removeBlockInstance(inst);
      this.startDrag(inst, p.worldX - wx, p.worldY - wy, wx, wy);
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.drag) this.drag.inst.setPosition(p.worldX - this.drag.ox, p.worldY - this.drag.oy);
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.endDrag(p));
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.endDrag(p));
  }

  private adjustCameraToScreen(): void {
    const { zoom, width, height } = getVisibleArea(this);

    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(GAME_W / 2, GAME_H / 2);

    if (this.background) {
      this.background.setPosition(GAME_W / 2, GAME_H / 2);
      this.background.setScale(
        Math.max(width / this.background.width, height / this.background.height),
      );
    }
  }

  private startDrag(inst: BlockInstance, ox: number, oy: number, wx?: number, wy?: number): void {
    this.add.existing(inst);
    inst.setDepth(1000).setAlpha(0.9);
    if (wx !== undefined && wy !== undefined) inst.setPosition(wx, wy);
    this.drag = { inst, ox, oy };
    console.log('[3] startDrag:', { x: inst.x, y: inst.y, visible: inst.visible, w: inst.width, h: inst.height });
  }

  private endDrag(p: Phaser.Input.Pointer): void {
    if (!this.drag) return;
    const { inst, ox, oy } = this.drag;
    this.drag = null;

    const inside = this.editor.workspace.containsWorldPoint(p.worldX, p.worldY);
    console.log('[drop]', {
      mouse: { x: p.worldX, y: p.worldY },
      area: this.editor.workspace,
      inside,
      blockSize: { w: inst.width, h: inst.height },
    });

    if (inside) {
      this.editor.workspace.addBlockInstance(inst, p.worldX - ox, p.worldY - oy);
    } else {
      inst.destroy();
    }
  }
}