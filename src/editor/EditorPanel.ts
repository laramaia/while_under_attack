import Phaser from 'phaser';
import {
  ARROW_GAP,
  ARROW_SCALE,
  GAME_H,
  PANEL_SCALE,
  PANEL_EDGE_X,
  PANEL_W,
  SEAM_X,
  WORKSPACE_CONTENT_W,
  WORKSPACE_CONTENT_X,
  EDITOR_BASE_WIDTH,
  EDITOR_BASE_HEIGHT,
  VISIBLE_TAB_WIDTH,
} from '../config';

import { BlockCatalog } from '../model/BlockCatalog';
import { Palette } from './Palette';
import { Workspace } from './Workspace';
import { PanelArrow } from './PanelArrow';

export class EditorPanel extends Phaser.GameObjects.Container {
  readonly palette: Palette;
  readonly workspace: Workspace;

  isOpen = false;

  constructor(scene: Phaser.Scene, catalog: BlockCatalog) {
    const zoom = Math.min(
      scene.scale.width / EDITOR_BASE_WIDTH,
      scene.scale.height / EDITOR_BASE_HEIGHT
    );
    const effectiveWidth = scene.scale.width / zoom;
    const visibleRight =
      EDITOR_BASE_WIDTH / 2 + effectiveWidth / 2;
    const closedX =
      visibleRight - VISIBLE_TAB_WIDTH;

    super(scene, closedX, 0);

    const paletteArt = scene.add
      .image(0, 0, 'panel_palette')
      .setOrigin(0, 0)
      .setScale(PANEL_SCALE);
    const workspaceArt = scene.add
      .image(SEAM_X, 0, 'panel_workspace')
      .setOrigin(0, 0)
      .setScale(PANEL_SCALE);

    this.add([paletteArt, workspaceArt]);
    this.palette = new Palette(scene, 0, 0, catalog);
    this.workspace = new Workspace(
      scene,
      WORKSPACE_CONTENT_X,
      0,
      WORKSPACE_CONTENT_W
    );
    this.add([this.palette, this.workspace]);
    this.buildArrows();
    this.setSize(PANEL_W, GAME_H);

    scene.add.existing(this);
  }

  private buildArrows(): void {
    const x = PANEL_EDGE_X - 40;
    const y = GAME_H / 2 + 270;

    this.add([
      new PanelArrow(
        this.scene,
        x,
        y - ARROW_GAP / 2,
        'right',
        () => this.close(),
        ARROW_SCALE
      ),
      new PanelArrow(
        this.scene,
        x,
        y + ARROW_GAP / 2,
        'left',
        () => this.open(),
        ARROW_SCALE
      ),
    ]);
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

  private slideTo(open: boolean): void {
    if (this.isOpen === open) return;

    this.isOpen = open;

    const screenWidth = this.scene.scale.width;
    const screenHeight = this.scene.scale.height;
    const zoom = Math.min(
      screenWidth / EDITOR_BASE_WIDTH,
      screenHeight / EDITOR_BASE_HEIGHT
    );
    const effectiveWidth = screenWidth / zoom;
    const visibleRight =
      EDITOR_BASE_WIDTH / 2 + effectiveWidth / 2;
    const openX = visibleRight - PANEL_W;
    const closedX =
      visibleRight - VISIBLE_TAB_WIDTH;

    this.scene.tweens.add({
      targets: this,
      x: open ? openX : closedX,
      duration: 350,
      ease: 'Cubic.easeInOut',
    });
  }
}