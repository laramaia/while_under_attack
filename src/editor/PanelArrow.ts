import Phaser from 'phaser';

export type ArrowDirection = 'left' | 'right';

export class PanelArrow extends Phaser.GameObjects.Image {
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    direction: ArrowDirection,
    onPress: () => void,
    scale = 1,
  ) {
    super(scene, x, y, 'panel_arrow');
    this.setScale(scale).setFlipX(direction === 'right');

    // área de toque maior que o desenho
    const pad = 24;
    this.setInteractive(
      new Phaser.Geom.Rectangle(-pad, -pad, this.width + pad * 2, this.height + pad * 2),
      Phaser.Geom.Rectangle.Contains,
    );
    this.on('pointerdown', onPress);
  }
}