import Phaser from 'phaser';
import { ATTACK_DAMAGE } from '../config';
import { BlockInstance } from '../editor/BlockInstance';
import { GameArea } from '../game/GameArea';

export interface FimDeExecucao {
  interrompida: boolean;
  programaConcluido: boolean;
  blocoEmExecucao: BlockInstance | null;
}

class Abort {
  constructor(readonly interrompida: boolean) {}
}

const WAIT_STEP_MS = 50;

export class ProgramRunner extends Phaser.Events.EventEmitter {
  private isRunning = false;
  private stopRequested = false;
  private paused = false;
  private current: BlockInstance | null = null;

  constructor(private gameArea: GameArea) {
    super();
  }

  get running(): boolean {
    return this.isRunning;
  }

  canRun(roots: BlockInstance[]): boolean {
    return roots.some((b) => b.template.id === 'on-flag');
  }

  stop(): void {
    if (this.isRunning) this.stopRequested = true;
  }

  pause(): void {
    if (this.isRunning) this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  async run(roots: BlockInstance[]): Promise<void> {
    if (this.isRunning || !this.canRun(roots)) return;

    this.isRunning = true;
    this.stopRequested = false;
    this.paused = false;
    this.current = null;

    let interrompida = false;
    let concluido = true;

    try {
      for (const start of roots.filter((b) => b.template.id === 'on-flag')) {
        await this.executeChain(start.nextBlock);
      }
    } catch (e) {
      if (!(e instanceof Abort)) {
        this.isRunning = false;
        this.paused = false;
        throw e;
      }
      interrompida = e.interrompida;
      concluido = false;
    }

    this.isRunning = false;
    this.paused = false;
    const fim: FimDeExecucao = {
      interrompida,
      programaConcluido: concluido,
      blocoEmExecucao: concluido ? null : this.current,
    };
    this.emit('finished', fim);
  }

  private async executeChain(block: BlockInstance | null): Promise<void> {
    let current = block;

    while (current) {
      await this.waitIfPaused();
      this.checkAbort();
      this.current = current;
      await this.executeSingleBlock(current);
      current = current.nextBlock;
    }
  }

  private checkAbort(): void {
    if (this.stopRequested) throw new Abort(true);
    if (this.gameArea.enemyHp <= 0 || this.gameArea.heroHp <= 0) throw new Abort(false);
  }

  private async executeSingleBlock(block: BlockInstance): Promise<void> {
    switch (block.template.id) {
      case 'attack':
        this.gameArea.heroAttack();
        if (this.gameArea.isEnemyInRange()) {
          this.gameArea.damageEnemy(ATTACK_DAMAGE);
        }
        await this.wait(800);
        break;

      case 'defend':
        console.log('Executando: Defender');
        await this.wait(600);
        break;

      case 'advance':
        await this.gameArea.heroAdvance();
        break;

      case 'repeat':
        for (let i = 0; i < 3; i++) {
          for (const innerRoot of block.inner) {
            await this.executeChain(innerRoot);
          }
        }
        break;

      case 'if-else':
        break;
    }
  }

  private async waitIfPaused(): Promise<void> {
    while (this.paused && !this.stopRequested) {
      await new Promise<void>((resolve) => setTimeout(resolve, WAIT_STEP_MS));
    }
  }

  private async wait(ms: number): Promise<void> {
    let left = ms;
    while (left > 0) {
      const step = Math.min(WAIT_STEP_MS, left);
      await new Promise<void>((resolve) => setTimeout(resolve, step));
      if (!this.paused) left -= step;
    }
  }
}