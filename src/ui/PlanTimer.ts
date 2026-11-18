import Phaser from 'phaser';
import {
  GAME_W,
  TIMER_COLOR,
  TIMER_DEPTH,
  TIMER_FONT,
  TIMER_MARGIN_TOP,
  TIMER_SIZE,
  TIMER_STROKE,
  TIMER_WARN_AT_S,
  TIMER_WARN_COLOR,
} from '../config';
import { getVisibleArea } from '../utils/viewport';

export class PlanTimer {
  private readonly text: Phaser.GameObjects.Text;
  private event: Phaser.Time.TimerEvent | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.text = scene.add
      .text(GAME_W / 2, 0, '', {
        fontFamily: TIMER_FONT,
        fontSize: TIMER_SIZE,
        fontStyle: 'bold',
        color: TIMER_COLOR,
        stroke: TIMER_STROKE,
        strokeThickness: 6,
      })
      .setOrigin(0.5, 0)
      .setDepth(TIMER_DEPTH)
      .setResolution(2)
      .setVisible(false);

    this.layout();

    scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
    });
  }

  get running(): boolean {
    return this.event !== null;
  }

  start(durationMs: number, onExpire: () => void): void {
    this.cancel();
    this.show(Math.ceil(durationMs / 1000));

    this.event = this.scene.time.delayedCall(durationMs, () => {
      this.event = null;
      this.show(0);
      onExpire();
    });
  }

  stop(): void {
    this.cancel();
    this.text.setVisible(false);
  }

  layout(): void {
    const { top } = getVisibleArea(this.scene);
    this.text.setPosition(GAME_W / 2, top + TIMER_MARGIN_TOP);
  }

  private cancel(): void {
    this.event?.remove();
    this.event = null;
  }

  private show(seconds: number): void {
    this.text
      .setText(String(seconds))
      .setColor(seconds <= TIMER_WARN_AT_S ? TIMER_WARN_COLOR : TIMER_COLOR)
      .setVisible(true);
  }

  private update(): void {
    if (!this.event) return;

    const seconds = Math.max(0, Math.ceil(this.event.getRemainingSeconds()));
    if (this.text.text !== String(seconds)) this.show(seconds);
  }
}