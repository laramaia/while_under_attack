import { BlockInstance } from '../editor/BlockInstance';
import { GameArea } from '../game/GameArea';

export class ProgramRunner {
  private isRunning = false;

  constructor(private gameArea: GameArea) {}

  async run(roots: BlockInstance[]): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const startBlocks = roots.filter((block) => block.template.id === 'on-flag');

      if (startBlocks.length === 0) {
        console.log('Nenhum bloco "Ao clicar em play" encontrado no Workspace!');
        return;
      }

      for (const startBlock of startBlocks) {
        await this.executeChain(startBlock.nextBlock);
      }
    } finally {
      this.isRunning = false;
    }
  }

  private async executeChain(block: BlockInstance | null): Promise<void> {
    let current = block;

    while (current) {
      await this.executeSingleBlock(current);
      current = current.nextBlock;
    }
  }

  private async executeSingleBlock(block: BlockInstance): Promise<void> {
    switch (block.template.id) {
      case 'attack':
        this.gameArea.heroAttack();
        await this.wait(800);
        break;

      case 'defend':
        // this.gameArea.heroDefend(); 
        console.log('Executando: Defender');
        await this.wait(600);
        break;

      case 'advance':
        // this.gameArea.heroAdvance(); 
        console.log('Executando: Avançar');
        await this.wait(600);
        break;

      case 'repeat':
        // Executa os blocos que estão dentro do C-block 3 vezes!
        for (let i = 0; i < 3; i++) {
          for (const innerRoot of block.inner) {
            await this.executeChain(innerRoot);
          }
        }
        break;

      case 'if-else':
        // Lógica futura da condicional
        break;
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}