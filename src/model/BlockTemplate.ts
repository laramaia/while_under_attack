export type BlockShape = 'hat' | 'stack' | 'c-block';
export type BlockColorKey = 'yellow' | 'blue' | 'orange' | 'purple';

/** Molde de um bloco (dado puro). A Palette clona isso em BlockInstance. */
export interface BlockTemplate {
  id: string;
  label: string;
  colorKey: BlockColorKey;
  shape: BlockShape;
}