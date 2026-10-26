import { BlockGroup } from './BlockGroup';

/** Dono de todos os grupos. É o "banco de dados" da Palette. */
export class BlockCatalog {
  readonly groups: BlockGroup[] = [];

  registerGroup(group: BlockGroup): this {
    this.groups.push(group);
    return this;
  }

  getGroup(id: string): BlockGroup | undefined {
    return this.groups.find((g) => g.id === id);
  }
}
