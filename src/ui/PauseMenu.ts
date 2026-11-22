import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config';

const DEPTH = 2000;
const DIM_ALPHA = 0.55;
const PANEL_W = 440;
const PANEL_H = 300;

interface PauseActions {
  onContinue: () => void;
  onExit: () => void;
}

export class PauseMenu {
  private readonly parts: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene, actions: PauseActions) {
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;

    const backdrop = scene.add
      .rectangle(cx, cy, GAME_W * 3, GAME_H * 3, 0x000000, DIM_ALPHA)
      .setInteractive();

    const panel = scene.add
      .rectangle(cx, cy, PANEL_W, PANEL_H, 0xf3efe6)
      .setStrokeStyle(6, 0x4a4242);

    const title = scene.add
      .text(cx, cy - 85, 'Pausado', {
        fontFamily: 'Georgia, serif',
        fontSize: '44px',
        color: '#2b2118',
      })
      .setOrigin(0.5)
      .setResolution(2);

    const resume = this.button(scene, cx, cy + 10, 'Continuar', actions.onContinue);
    const exit = this.button(scene, cx, cy + 85, 'Sair', actions.onExit);

    this.parts.push(backdrop, panel, title, resume, exit);
    this.parts.forEach((p) => (p as Phaser.GameObjects.Components.Depth & Phaser.GameObjects.GameObject)
      .setActive(true));
    this.parts.forEach((p) => (p as unknown as Phaser.GameObjects.Components.Depth).setDepth(DEPTH));

    this.hide();
  }

  show(): void {
    this.parts.forEach((p) => (p as unknown as Phaser.GameObjects.Components.Visible).setVisible(true));
  }

  hide(): void {
    this.parts.forEach((p) => (p as unknown as Phaser.GameObjects.Components.Visible).setVisible(false));
  }

  private button(
    scene: Phaser.Scene,
    x: number,
    y: number,
    label: string,
    onClick: () => void,
  ): Phaser.GameObjects.Text {
    return scene.add
      .text(x, y, label, {
        fontFamily: 'Georgia, serif',
        fontSize: '28px',
        color: '#ffffff',
        backgroundColor: '#8c3b3b',
        padding: { x: 40, y: 10 },
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onClick);
  }
}