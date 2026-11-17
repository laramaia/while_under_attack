import Phaser from 'phaser';
import { BlockCatalog } from '../model/BlockCatalog';
import { BlockGroup } from '../model/BlockGroup';
import { BlockTemplate } from '../model/BlockTemplate';
import { BlockView } from './BlockView';
import {
  BLOCK_GAP,
  BLOCK_LIST_Y,
  BLOCK_W,
  GAME_H,
  PALETTE_CONTENT_W,
  PALETTE_CONTENT_X,
  PLATE_H,
  PLATE_W,
  PLATE_X,
  PLATE_Y,
  TAB_GAP,
  TAB_ICON_SIZE,
  TAB_IDLE_ALPHA,
  TAB_ITEM_H,
  TAB_LABEL_COLOR,
  TAB_LABEL_FONT,
  TAB_LABEL_GAP,
  TAB_LABEL_IDLE_ALPHA,
  TAB_LABEL_SIZE,
  TAB_PAD_Y,
  TAB_SELECTED_SCALE,
  TAB_X_OFFSET,
  WORKSPACE_TITLE_COLOR,
  WORKSPACE_TITLE_FONT,
  WORKSPACE_TITLE_SIZE,
  WORKSPACE_TITLE_X,
  WORKSPACE_TITLE_Y,
} from '../config';

interface TabButton {
  icon: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  baseScale: number;
  group: BlockGroup;
}

export class Palette extends Phaser.GameObjects.Container {
  private currentGroup: BlockGroup;
  private contentContainer: Phaser.GameObjects.Container;
  public plate!: Phaser.GameObjects.Image;
  private tabButtons: TabButton[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, catalog: BlockCatalog) {
    super(scene, x, y);
    this.setSize(PALETTE_CONTENT_W, GAME_H);
    const groups = catalog.groups;
    this.currentGroup = groups[0] ?? new BlockGroup('default', 'Padrão', 0xffffff);
    this.buildTitle();
    this.buildPlate();
    this.contentContainer = scene.add.container(0, 0);
    this.add(this.contentContainer);
    this.buildTabs(groups);
    this.refreshContent();
  }

  private buildPlate(): void {
    this.plate = this.scene.add
      .image(PLATE_X, PLATE_Y, 'palette_tab_background')
      .setOrigin(0, 0)
      .setDisplaySize(PLATE_W, PLATE_H);
  }

  private buildTabs(groups: BlockGroup[]): void {
    const cx = this.plate.x + this.plate.displayWidth / 2 + TAB_X_OFFSET;
    const startY = this.plate.y + TAB_PAD_Y;

    groups.forEach((group, i) => {
      const top = startY + i * (TAB_ITEM_H + TAB_GAP);
      this.tabButtons.push(this.createTab(group, cx, top));
    });

    this.updateTabStyles();
  }

  private createTab(group: BlockGroup, cx: number, top: number): TabButton {
    const icon = this.scene.add
      .image(cx, top + TAB_ICON_SIZE / 2, `tab_${group.id}`)
      .setInteractive({ useHandCursor: true });
    const baseScale = TAB_ICON_SIZE / icon.height;
    icon.setScale(baseScale);

    const label = this.scene.add
      .text(cx, top + TAB_ICON_SIZE + TAB_LABEL_GAP, group.label, {
        fontFamily: TAB_LABEL_FONT,
        fontSize: TAB_LABEL_SIZE,
        color: TAB_LABEL_COLOR,
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0)
      .setResolution(2)
      .setInteractive({ useHandCursor: true });

    icon.on('pointerdown', () => this.selectGroup(group));
    label.on('pointerdown', () => this.selectGroup(group));

    this.add([icon, label]);
    return { icon, label, baseScale, group };
  }

  private selectGroup(group: BlockGroup): void {
    this.currentGroup = group;
    this.updateTabStyles();
    this.refreshContent();
  }

  private updateTabStyles(): void {
    this.tabButtons.forEach((tab) => {
      const selected = tab.group === this.currentGroup;
      tab.icon.setAlpha(selected ? 1 : TAB_IDLE_ALPHA);
      tab.icon.setScale(tab.baseScale * (selected ? TAB_SELECTED_SCALE : 1));
      tab.label.setAlpha(selected ? 1 : TAB_LABEL_IDLE_ALPHA);
    });
  }

  private refreshContent(): void {
    this.contentContainer.removeAll(true);

    const left = PALETTE_CONTENT_X + (PALETTE_CONTENT_W - BLOCK_W) / 2;
    let cursorY = BLOCK_LIST_Y;

    this.currentGroup.blocks.forEach((template: BlockTemplate) => {
      const view = new BlockView(this.scene, template, left, cursorY).enableHit();
      view.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPressed(view, template, pointer));
      this.contentContainer.add(view);
      cursorY += view.height + BLOCK_GAP;
    });
  }

  private onPressed(view: BlockView, template: BlockTemplate, pointer: Phaser.Input.Pointer): void {
    const m = view.getWorldTransformMatrix();
    this.emit('template-pressed', template, m.tx, m.ty, pointer);
  }

  private buildTitle(): Phaser.GameObjects.Text {
    const title = this.scene.add
      .text(PALETTE_CONTENT_X + PALETTE_CONTENT_W / 2, WORKSPACE_TITLE_Y, 'Blocos', {
        fontFamily: WORKSPACE_TITLE_FONT,
        fontSize: WORKSPACE_TITLE_SIZE,
        color: WORKSPACE_TITLE_COLOR,
      })
      .setOrigin(0.5, 0.5);

    this.add(title);
    return title;
  }
}