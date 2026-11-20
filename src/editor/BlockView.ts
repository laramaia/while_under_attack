import Phaser from 'phaser';
import { BLOCK_W } from '../config';
import { BlockTemplate } from '../model/BlockTemplate';

export class BlockView extends Phaser.GameObjects.Container {
  readonly template: BlockTemplate;

  private topSprite?: Phaser.GameObjects.Image;
  private middleSprite?: Phaser.GameObjects.Image;
  private bottomSprite?: Phaser.GameObjects.Image;
  private labelText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, template: BlockTemplate, x = 0, y = 0) {
    super(scene, x, y);
    this.template = template;
    this.draw();
  }

  private draw(): void {
    const { colorKey, shape, label } = this.template;

    if (shape === 'c-block') {
      this.topSprite = this.scene.add.image(0, 0, `${colorKey}_block_top`).setOrigin(0, 0);
      this.middleSprite = this.scene.add.image(0, 0, `${colorKey}_block_middle`).setOrigin(0, 0);
      this.bottomSprite = this.scene.add.image(0, 0, `${colorKey}_block_bottom`).setOrigin(0, 0);

      const scale = BLOCK_W / this.topSprite.width;

      this.topSprite.setScale(scale);
      this.middleSprite.setScale(scale * 0.14, scale);
      this.bottomSprite.setScale(scale);
      this.add([this.topSprite, this.middleSprite, this.bottomSprite]);

      this.updateCBlockLayout(10);
    } else {
      const sprite = this.scene.add.image(0, 0, `${colorKey}_block_${shape}`).setOrigin(0, 0);
      const scale = BLOCK_W / sprite.width;
      sprite.setScale(scale);

      this.add(sprite);
      this.setSize(BLOCK_W, sprite.displayHeight);
    }

    this.labelText = this.scene.add.text(24, shape === 'c-block' ? 16 : this.height / 2, label, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#2b2118',
    });

    if (shape !== 'c-block') {
      this.labelText.setOrigin(0, 0.5);
    }

    this.add(this.labelText);
  }

  public updateCBlockLayout(innerHeight: number): void {
    if (!this.topSprite || !this.middleSprite || !this.bottomSprite) return;

    const finalInnerH = Math.max(0, innerHeight);
    const topH = this.topSprite.displayHeight;

    this.middleSprite.setPosition(0, topH);
    this.middleSprite.displayHeight = finalInnerH;
    this.bottomSprite.setPosition(0, topH + finalInnerH);

    const totalHeight = topH + finalInnerH + this.bottomSprite.displayHeight;
    this.setSize(BLOCK_W, totalHeight);

    if (this.input) {
      this.input.hitArea.setSize(BLOCK_W, totalHeight);
    }
  }

  enableHit(): this {
    this.setInteractive(new Phaser.Geom.Rectangle(0, 0, this.width, this.height), Phaser.Geom.Rectangle.Contains);
    return this;
  }
}