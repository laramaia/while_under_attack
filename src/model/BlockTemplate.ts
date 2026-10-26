export type BlockShape = 'hat' | 'stack' | 'c-block';

/** Molde de um bloco (dado puro). A Palette clona isso em BlockInstance. */
export interface BlockTemplate {
  id: string;
  label: string;
  color: number;
  shape: BlockShape;
}
