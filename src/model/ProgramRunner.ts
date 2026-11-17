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

export class ProgramRunner extends Phaser.Events.EventEmitter {
  private isRunning = false;
  private stopRequested = false;
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

  async run(roots: BlockInstance[]): Promise<void> {
    if (this.isRunning || !this.canRun(roots)) return;

    this.isRunning = true;
    this.stopRequested = false;
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
        throw e;
      }
      interrompida = e.interrompida;
      concluido = false;
    }

    this.isRunning = false;
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
        this.gameArea.damageEnemy(ATTACK_DAMAGE);
        await this.wait(800);
        break;

      case 'defend':
        console.log('Executando: Defender');
        await this.wait(600);
        break;

      case 'advance':
        console.log('Executando: Avançar');
        await this.wait(600);
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

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}