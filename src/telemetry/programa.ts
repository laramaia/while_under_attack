import { BlockInstance } from '../editor/BlockInstance';

interface BlocoJson {
  id: string;
  tipo: string;
  corpo?: BlocoJson[];
}

export interface ProgramaSerializado {
  programa: { pilhas: BlocoJson[][] };
  ids: Map<BlockInstance, string>;
}

export function serializarPrograma(roots: BlockInstance[]): ProgramaSerializado {
  const ids = new Map<BlockInstance, string>();
  let n = 0;

  const cadeia = (b: BlockInstance | null): BlocoJson[] => {
    const out: BlocoJson[] = [];
    for (let atual = b; atual; atual = atual.nextBlock) {
      const id = `b${++n}`;
      ids.set(atual, id);
      const bloco: BlocoJson = { id, tipo: atual.template.id };
      if (atual.inner.length > 0) bloco.corpo = atual.inner.flatMap((i) => cadeia(i));
      out.push(bloco);
    }
    return out;
  };

  return { programa: { pilhas: roots.map((r) => cadeia(r)) }, ids };
}