import Phaser from 'phaser';
import {
  GAME_H,
  HOVER_SCALE,
  RESTART_GAP,
  RESTART_H,
  WORKSPACE_DROP_MIN_Y,
  WORKSPACE_TITLE_COLOR,
  WORKSPACE_TITLE_FONT,
  WORKSPACE_TITLE_SIZE,
  WORKSPACE_TITLE_X,
  WORKSPACE_TITLE_Y,
} from '../config';
import { BlockInstance } from './BlockInstance';

export class Workspace extends Phaser.GameObjects.Container {
  readonly activeBlocks: BlockInstance[] = [];
  readonly roots: BlockInstance[] = [];
  private readonly areaW: number;
  private readonly areaH = GAME_H;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number) {
    super(scene, x, y);
    this.areaW = width;
    this.setSize(width, this.areaH);

    const title = this.buildTitle();
    this.buildRestartButton(title);
  }

  containsWorldPoint(wx: number, wy: number): boolean {
    const m = this.getWorldTransformMatrix();
    return wx >= m.tx && wx <= m.tx + this.areaW && wy >= m.ty && wy <= m.ty + this.areaH;
  }

  addBlockInstance(inst: BlockInstance, wx: number, wy: number): void {
    const m = this.getWorldTransformMatrix();
    const lx = Phaser.Math.Clamp(wx - m.tx, 0, this.areaW - inst.width);
    const ly = Phaser.Math.Clamp(wy - m.ty, WORKSPACE_DROP_MIN_Y, this.areaH - inst.height);

    this.add(inst);
    inst.setDepth(0).setAlpha(1);

    if (!inst.input) inst.enableHit();
    inst.removeAllListeners('pointerdown');
    inst.on('pointerdown', (p: Phaser.Input.Pointer) => this.emit('block-pressed', inst, p));

    this.activeBlocks.push(inst);

    const target = this.findSnapTarget(inst, lx, ly);

    if (target) {
      if (target.type === 'next') {
        const parent = target.block;
        inst.prevBlock = parent;
        inst.nextBlock = parent.nextBlock;
        if (inst.nextBlock) inst.nextBlock.prevBlock = inst;
        parent.nextBlock = inst;

        this.updateBlockPositions(parent);
      } else if (target.type === 'inner') {
        const cBlock = target.block;
        inst.prevBlock = null;
        cBlock.inner.push(inst);

        this.updateBlockPositions(cBlock);
      }
    } else {
      inst.setPosition(lx, ly);
      this.roots.push(inst);
    }

    this.emit('block-dropped', inst);
  }

  removeBlockInstance(inst: BlockInstance): void {
    const prev = inst.prevBlock;
    const next = inst.nextBlock;
    const parent = this.activeBlocks.find((b) => b.inner.includes(inst));

    if (prev) {
      prev.nextBlock = next;
      if (next) next.prevBlock = prev;
      this.updateBlockPositions(prev);
    } else if (next) {
      next.prevBlock = null;
      const r = this.roots.indexOf(inst);
      if (r >= 0) {
        next.setPosition(inst.x, inst.y);
        this.roots[r] = next;
        this.updateBlockPositions(next);
      } else if (parent) {
        parent.inner[parent.inner.indexOf(inst)] = next;
        this.updateBlockPositions(parent);
      }
    } else if (parent) {
      parent.inner.splice(parent.inner.indexOf(inst), 1);
      this.updateBlockPositions(parent);
    }

    this.remove(inst, false);

    const a = this.activeBlocks.indexOf(inst);
    if (a >= 0) this.activeBlocks.splice(a, 1);

    const r = this.roots.indexOf(inst);
    if (r >= 0) this.roots.splice(r, 1);

    inst.nextBlock = null;
    inst.prevBlock = null;
  }

  clearBlocks(): void {
    [...this.activeBlocks].forEach((inst) => inst.destroy());
    this.activeBlocks.length = 0;
    this.roots.length = 0;
    this.emit('blocks-cleared');
  }

  private findSnapTarget(inst: BlockInstance, lx: number, ly: number): { block: BlockInstance; type: 'next' | 'inner' } | null {
    const SNAP_DIST_Y = 50;
    const SNAP_DIST_X = 50;

    for (const other of this.activeBlocks) {
      if (other === inst) continue;

      const otherWorldPos = other.getWorldTransformMatrix();
      const thisWorldPos = this.getWorldTransformMatrix();
      const localOtherX = otherWorldPos.tx - thisWorldPos.tx;
      const localOtherY = otherWorldPos.ty - thisWorldPos.ty;
      const expectedX = localOtherX;
      const GAP = -22;
      const expectedY = localOtherY + other.height + GAP;

      if (Math.abs(lx - expectedX) < SNAP_DIST_X && Math.abs(ly - expectedY) < SNAP_DIST_Y) {
        return { block: other, type: 'next' };
      }

      if (other.template.shape === 'c-block') {
        const innerTargetX = localOtherX + 24;
        const innerTargetY = localOtherY + 45;

        if (Math.abs(lx - innerTargetX) < SNAP_DIST_X && Math.abs(ly - innerTargetY) < SNAP_DIST_Y) {
          return { block: other, type: 'inner' };
        }
      }
    }

    return null;
  }

  private updateBlockPositions(rootOrParent: BlockInstance): void {
    let curr: BlockInstance | null = rootOrParent;
    while (curr.prevBlock) {
      curr = curr.prevBlock;
    }

    for (const b of this.activeBlocks) {
      if (b.inner.includes(curr) || b.inner.includes(rootOrParent)) {
        let totalInnerH = 10;
        for (const innerBlock of b.inner) {
          totalInnerH += this.getTotalChainHeight(innerBlock);
        }
        b.updateCBlockLayout(totalInnerH);
        this.updateBlockPositions(b);
        return;
      }
    }

    let next = curr.nextBlock;
    const GAP = -22;
    let accumulatedY = curr.y + curr.height + GAP;

    while (next) {
      next.setPosition(curr.x, accumulatedY);
      accumulatedY += next.height + GAP;
      next = next.nextBlock;
    }
  }

  private getTotalChainHeight(block: BlockInstance): number {
    let h = 0;
    let curr: BlockInstance | null = block;
    while (curr) {
      h += curr.height;
      curr = curr.nextBlock;
    }
    return h;
  }

  private buildTitle(): Phaser.GameObjects.Text {
    const title = this.scene.add
      .text(WORKSPACE_TITLE_X, WORKSPACE_TITLE_Y, 'Workspace', {
        fontFamily: WORKSPACE_TITLE_FONT,
        fontSize: WORKSPACE_TITLE_SIZE,
        color: WORKSPACE_TITLE_COLOR,
      })
      .setOrigin(0, 0.5);

    this.add(title);
    return title;
  }

  private buildRestartButton(title: Phaser.GameObjects.Text): void {
    const btn = this.scene.add
      .image(0, WORKSPACE_TITLE_Y, 'button_restart')
      .setOrigin(0.5);
    const baseScale = RESTART_H / btn.height;

    btn.setScale(baseScale);
    btn.setX(title.x + title.width + RESTART_GAP + btn.displayWidth / 2);
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setScale(baseScale * HOVER_SCALE));
    btn.on('pointerout', () => btn.setScale(baseScale));
    btn.on('pointerdown', () => {
      this.clearBlocks();
      this.emit('restart');
    });

    this.add(btn);
  }
}