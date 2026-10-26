import Phaser from 'phaser';
import { BlockCatalog } from '../model/BlockCatalog';
import { BlockGroup } from '../model/BlockGroup';
import { BlockTemplate } from '../model/BlockTemplate';
import { BlockView } from './BlockView';
import { BLOCK_W, GAME_H, PALETTE_CONTENT_W, PALETTE_CONTENT_X } from '../config';

export class Palette extends Phaser.GameObjects.Container {
  private readonly catalog: BlockCatalog;
  private currentGroup: BlockGroup;
  private contentContainer: Phaser.GameObjects.Container;
  private tabButtons: { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text; group: BlockGroup }[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, catalog: BlockCatalog) {
    super(scene, x, y);
    this.catalog = catalog;
    this.setSize(PALETTE_CONTENT_W, GAME_H);

    const groups = this.catalog.groups;
    this.currentGroup = groups.length > 0 ? groups[0] : new BlockGroup('default', 'Padrão', 0xffffff);

    this.contentContainer = scene.add.container(0, 0);
    this.add(this.contentContainer);

    this.buildTabs(groups);
    this.refreshContent();
  }

  private buildTabs(groups: BlockGroup[]): void {
    const totalWidth = PALETTE_CONTENT_W - 16;
    const tabWidth = totalWidth / groups.length;
    let cursorX = PALETTE_CONTENT_X + 8;

    groups.forEach((group) => {
      const tabBg = this.scene.add.rectangle(cursorX, 60, tabWidth - 4, 32, group.color)
        .setOrigin(0, 0)
        .setInteractive()
        .setAlpha(group === this.currentGroup ? 1 : 0.6);

      const tabText = this.scene.add.text(cursorX + (tabWidth - 4) / 2, 76, group.label, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        color: '#2b2118',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      tabBg.on('pointerdown', () => {
        this.currentGroup = group;
        this.updateTabStyles();
        this.refreshContent();
      });

      this.add([tabBg, tabText]);
      this.tabButtons.push({ bg: tabBg, text: tabText, group });

      cursorX += tabWidth;
    });
  }

  private updateTabStyles(): void {
    this.tabButtons.forEach((tab) => {
      tab.bg.setAlpha(tab.group === this.currentGroup ? 1 : 0.6);
    });
  }

  private refreshContent(): void {
    this.contentContainer.removeAll(true);

    const left = PALETTE_CONTENT_X + (PALETTE_CONTENT_W - BLOCK_W) / 2;
    let cursorY = 114;

    const blocks = this.currentGroup.blocks;

    blocks.forEach((template: BlockTemplate) => {
      const view = new BlockView(this.scene, template, left, cursorY).enableHit();
      view.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPressed(view, template, pointer));
      this.contentContainer.add(view);
      cursorY += view.height + 10;
    });
  }

  private onPressed(view: BlockView, template: BlockTemplate, pointer: Phaser.Input.Pointer): void {
    const m = view.getWorldTransformMatrix();
    this.emit('template-pressed', template, m.tx, m.ty, pointer);
  }
}