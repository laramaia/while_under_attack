import { BlockTemplate } from './BlockTemplate';

/** Categoria (Eventos / Ação / Controle) + a lista dos seus blocos. */
export class BlockGroup {
  readonly blocks: BlockTemplate[] = [];

  constructor(
    readonly id: string,
    readonly label: string,
    readonly color: number,
  ) {}

  addBlock(template: BlockTemplate): this {
    this.blocks.push(template);
    return this;
  }
}
