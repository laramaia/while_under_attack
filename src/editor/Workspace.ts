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
  BLOCK_SNAP_DISTANCE,
  BLOCK_VERTICAL_GAP,
  CBLOCK_INNER_OFFSET_X,
  CBLOCK_INNER_OFFSET_Y,
  CBLOCK_INNER_BASE_HEIGHT,
  CBLOCK_HEIGHT_ADJUSTMENT,
  CBLOCK_INNER_BOTTOM_MARGIN,
  CBLOCK_HEADER_HEIGHT
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

  resolvePressedBlock(inst: BlockInstance, wx: number, wy: number): BlockInstance {
    const parentCBlock = this.findParentCBlock(inst);
    if (!parentCBlock) return inst;

    const m = parentCBlock.getWorldTransformMatrix();
    const localX = wx - m.tx;
    const localY = wy - m.ty;

    const inHeader = localX >= 0 && localX <= parentCBlock.width && localY >= 0 && localY <= CBLOCK_HEADER_HEIGHT;
    const inLeftSpine = localX >= 0 && localX <= CBLOCK_INNER_OFFSET_X && localY >= 0 && localY <= parentCBlock.height;

    if (inHeader || inLeftSpine) {
      return parentCBlock;
    }

    return inst;
  }

  detachInnerBlocksForDrag(cBlock: BlockInstance): { block: BlockInstance; dx: number; dy: number }[] {
    const followers: { block: BlockInstance; dx: number; dy: number }[] = [];
    const innerRoots = [...cBlock.inner];
    cBlock.inner.length = 0;

    for (const root of innerRoots) {
      let current: BlockInstance | null = root;

      while (current) {
        const next: BlockInstance | null = current.nextBlock;

        const activeIndex = this.activeBlocks.indexOf(current);
        if (activeIndex >= 0) this.activeBlocks.splice(activeIndex, 1);
        const rootIndex = this.roots.indexOf(current);
        if (rootIndex >= 0) this.roots.splice(rootIndex, 1);

        this.remove(current, false);
        followers.push({
          block: current,
          dx: current.x - cBlock.x,
          dy: current.y - cBlock.y,
        });

        current = next;
      }
    }

    return followers;
  }

  reattachInnerBlocksAfterDrag(
    cBlock: BlockInstance,
    followers: { block: BlockInstance; dx: number; dy: number }[],
  ): void {
    if (followers.length === 0) return;

    const blocks = followers.map((f) => f.block);
    cBlock.inner.push(blocks[0]);

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      b.prevBlock = i > 0 ? blocks[i - 1] : null;
      b.nextBlock = i < blocks.length - 1 ? blocks[i + 1] : null;
      this.add(b);
      b.setDepth(0).setAlpha(1);
      if (!b.input) b.enableHit();
      b.removeAllListeners('pointerdown');
      b.on('pointerdown', (p: Phaser.Input.Pointer) => this.emit('block-pressed', b, p));
      this.activeBlocks.push(b);
    }

    this.updateBlockPositions(cBlock);
  }

  private findParentCBlock(target: BlockInstance): BlockInstance | null {
    for (const block of this.activeBlocks) {
      if (block.template.shape !== 'c-block') continue;

      for (const innerRoot of block.inner) {
        let curr: BlockInstance | null = innerRoot;
        while (curr) {
          if (curr === target) return block;
          curr = curr.nextBlock;
        }
      }
    }
    return null;
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

    if (inst.template.shape === 'c-block') {
      this.destroyInnerBlocks(inst);
    }

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

  private destroyInnerBlocks(cBlock: BlockInstance): void {
    const innerRoots = [...cBlock.inner];
    cBlock.inner.length = 0;

    for (const root of innerRoots) {
      let current: BlockInstance | null = root;

      while (current) {
        const next: BlockInstance | null = current.nextBlock;

        if (current.template.shape === 'c-block') {
          this.destroyInnerBlocks(current);
        }

        const activeIndex = this.activeBlocks.indexOf(current);
        if (activeIndex >= 0) this.activeBlocks.splice(activeIndex, 1);
        const rootIndex = this.roots.indexOf(current);
        if (rootIndex >= 0) this.roots.splice(rootIndex, 1);

        this.remove(current, false);

        current.destroy();
        current.nextBlock = null;
        current.prevBlock = null;
        current = next;
      }
    }
  }

  clearBlocks(): void {
    [...this.activeBlocks].forEach((inst) => inst.destroy());
    this.activeBlocks.length = 0;
    this.roots.length = 0;
    this.emit('blocks-cleared');
  }

  private findSnapTarget(inst: BlockInstance, lx: number, ly: number): { block: BlockInstance; type: 'next' | 'inner' } | null {
    const thisWorldPos = this.getWorldTransformMatrix();

    for (const other of this.activeBlocks) {
      if (other === inst) continue;

      const otherWorldPos = other.getWorldTransformMatrix();
      const localOtherX = otherWorldPos.tx - thisWorldPos.tx;
      const localOtherY = otherWorldPos.ty - thisWorldPos.ty;

      if (other.template.shape === 'c-block') {
        const innerTopY = localOtherY + 25;
        const innerBottomY = localOtherY + other.height - CBLOCK_INNER_BOTTOM_MARGIN;
        const dentroX = lx >= localOtherX + 10 && lx <= localOtherX + other.width;
        const dentroY = ly >= innerTopY && ly <= innerBottomY;

        if (dentroX && dentroY) {
          return { block: other, type: 'inner' };
        }
      }

      const expectedX = localOtherX;
      const expectedY = localOtherY + other.height + BLOCK_VERTICAL_GAP;

      if (Math.abs(lx - expectedX) < BLOCK_SNAP_DISTANCE && Math.abs(ly - expectedY) < BLOCK_SNAP_DISTANCE) {
        return { block: other, type: 'next' };
      }
    }

    return null;
  }

  private updateBlockPositions(rootOrParent: BlockInstance): void {
    let curr: BlockInstance | null = rootOrParent;
    while (curr.prevBlock) {
      curr = curr.prevBlock;
    }

    const cBlockTarget = rootOrParent.template.shape === 'c-block' ? rootOrParent : curr;

    if (cBlockTarget.inner.length > 0) {
      this.layoutCBlockInner(cBlockTarget, BLOCK_VERTICAL_GAP, CBLOCK_INNER_BASE_HEIGHT);
    }

    const parentCBlock = this.activeBlocks.find(
      (b) => b.inner.includes(curr!) || b.inner.includes(rootOrParent),
    );

    if (parentCBlock) {
      this.layoutCBlockInner(parentCBlock, BLOCK_VERTICAL_GAP, CBLOCK_INNER_BASE_HEIGHT);
      this.updateBlockPositions(parentCBlock);
      return;
    }

    this.positionNextBlocks(curr);
  }

  private layoutCBlockInner(cBlock: BlockInstance, gap: number, baseInnerH: number): void {
    let innerCount = 0;
    const innerStartY = cBlock.y + CBLOCK_INNER_OFFSET_Y;
    let accumulatedInnerY = innerStartY;

    for (const innerBlock of cBlock.inner) {
      innerBlock.setPosition(cBlock.x + CBLOCK_INNER_OFFSET_X, accumulatedInnerY);
      innerCount += 1;

      let lastBottomY = accumulatedInnerY + innerBlock.height;
      let innerNext: BlockInstance | null = innerBlock.nextBlock;
      let innerNextY = accumulatedInnerY + innerBlock.height + gap;

      while (innerNext) {
        innerNext.setPosition(cBlock.x + CBLOCK_INNER_OFFSET_X, innerNextY);
        lastBottomY = innerNextY + innerNext.height;
        innerCount += 1;
        innerNextY += innerNext.height + gap;
        innerNext = innerNext.nextBlock;
      }

      accumulatedInnerY = lastBottomY + gap;
    }

    const occupiedH = accumulatedInnerY - innerStartY;
    const targetInnerH = innerCount > 1 ? Math.max(baseInnerH, occupiedH - CBLOCK_HEIGHT_ADJUSTMENT) : baseInnerH;
    cBlock.updateCBlockLayout(targetInnerH);
  }

  private positionNextBlocks(block: BlockInstance): void {
    let next: BlockInstance | null = block.nextBlock;
    let accumulatedY = block.y + block.height + BLOCK_VERTICAL_GAP;

    while (next) {
      next.setPosition(block.x, accumulatedY);
      accumulatedY += next.height + BLOCK_VERTICAL_GAP;
      next = next.nextBlock;
    }
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