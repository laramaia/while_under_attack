import Phaser from 'phaser';
import { BLOCK_W } from '../config';
import { BlockTemplate } from '../model/BlockTemplate';

const HEIGHTS = { hat: 50, stack: 46, 'c-block': 110 } as const;

export class BlockView extends Phaser.GameObjects.Container {
  readonly template: BlockTemplate;

  constructor(scene: Phaser.Scene, template: BlockTemplate, x = 0, y = 0) {
    super(scene, x, y);
    this.template = template;
    this.setSize(BLOCK_W, HEIGHTS[template.shape]);
    this.draw();
  }

  private draw(): void {
    const { color, shape, label } = this.template;
    const w = BLOCK_W;
    const h = HEIGHTS[shape];
    const border = Phaser.Display.Color.IntegerToColor(color).darken(35).color;
    const g = this.scene.add.graphics();

    g.fillStyle(color, 1).lineStyle(4, border, 1);

    if (shape === 'c-block') {
      const bar = 40;
      g.fillRoundedRect(0, 0, w, bar, 8).strokeRoundedRect(0, 0, w, bar, 8);
      g.fillRoundedRect(0, 0, 28, h, 8).strokeRoundedRect(0, 0, 28, h, 8);
      g.fillRoundedRect(0, h - 30, w, 30, 8).strokeRoundedRect(0, h - 30, w, 30, 8);
    } else {
      g.fillRoundedRect(0, 0, w, h, 10).strokeRoundedRect(0, 0, w, h, 10);
    }

    const text = this.scene.add.text(16, shape === 'c-block' ? 8 : h / 2, label, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '22px',
      color: '#2b2118',
    });
    
    if (shape !== 'c-block') text.setOrigin(0, 0.5);

    this.add([g, text]);
  }
    
  enableHit(): this {
    this.setInteractive(new Phaser.Geom.Rectangle(0, 0, this.width, this.height), Phaser.Geom.Rectangle.Contains);
    return this;
  }
}