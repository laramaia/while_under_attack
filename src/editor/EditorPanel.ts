import Phaser from 'phaser';
import {
  ARROW_GAP,
  ARROW_SCALE,
  ARROW_X_OFFSET,
  ARROW_Y_OFFSET,
  ART_BLEED,
  GAME_H,
  PALETTE_ART_EXTRA_H,
  PANEL_EDGE_X,
  PANEL_SLIDE_EASE,
  PANEL_SLIDE_MS,
  PANEL_W,
  SEAM_X,
  VISIBLE_TAB_WIDTH,
  WORKSPACE_CONTENT_W,
  WORKSPACE_CONTENT_X,
} from '../config';
import { getVisibleArea } from '../utils/viewport';
import { BlockCatalog } from '../model/BlockCatalog';
import { Palette } from './Palette';
import { Workspace } from './Workspace';
import { PanelArrow } from './PanelArrow';

function panelX(scene: Phaser.Scene, open: boolean): number {
  const { right } = getVisibleArea(scene);
  return open ? right - PANEL_W : right - VISIBLE_TAB_WIDTH;
}

export class EditorPanel extends Phaser.GameObjects.Container {
  readonly palette: Palette;
  readonly workspace: Workspace;

  private paletteArt: Phaser.GameObjects.Image;
  private workspaceArt: Phaser.GameObjects.Image;

  isOpen = false;

  constructor(scene: Phaser.Scene, catalog: BlockCatalog) {
    super(scene, panelX(scene, false), 0);

    this.paletteArt = scene.add.image(0, 0, 'panel_palette').setOrigin(0, 0);
    this.workspaceArt = scene.add.image(SEAM_X, 0, 'panel_workspace').setOrigin(0, 0);
    this.add([this.paletteArt, this.workspaceArt]);
    this.layoutArt();
    this.palette = new Palette(scene, 0, 0, catalog);
    this.workspace = new Workspace(scene, WORKSPACE_CONTENT_X, 0, WORKSPACE_CONTENT_W);
    this.add([this.palette, this.workspace]);
    this.buildArrows();
    this.setSize(PANEL_W, GAME_H);

    scene.add.existing(this);
  }

  onResize(): void {
    this.layoutArt();
    this.x = panelX(this.scene, this.isOpen);
  }

  open(): void {
    this.slideTo(true);
  }

  close(): void {
    this.slideTo(false);
  }

  toggle(): void {
    this.slideTo(!this.isOpen);
  }

  private layoutArt(): void {
    const { top, height } = getVisibleArea(this.scene);
    const y = top - ART_BLEED;
    const h = height + ART_BLEED * 2;

    this.paletteArt
      .setPosition(0, y)
      .setScale((h + PALETTE_ART_EXTRA_H) / this.paletteArt.height);

    this.workspaceArt
      .setPosition(SEAM_X, y)
      .setScale(h / this.workspaceArt.height);
  }

  private buildArrows(): void {
    const x = PANEL_EDGE_X - ARROW_X_OFFSET;
    const y = GAME_H / 2 + ARROW_Y_OFFSET;
    const makeArrow = (dy: number, dir: 'right' | 'left', onClick: () => void) =>
      new PanelArrow(this.scene, x, y + dy, dir, onClick, ARROW_SCALE);

    this.add([
      makeArrow(-ARROW_GAP / 2, 'right', () => this.close()),
      makeArrow(ARROW_GAP / 2, 'left', () => this.open()),
    ]);
  }

  private slideTo(open: boolean): void {
    if (this.isOpen === open) return;
    this.isOpen = open;

    this.scene.tweens.add({
      targets: this,
      x: panelX(this.scene, open),
      duration: PANEL_SLIDE_MS,
      ease: PANEL_SLIDE_EASE,
    });
  }
}