import { BlockCatalog } from './BlockCatalog';
import { BlockGroup } from './BlockGroup';

const YELLOW = 0xf7d774;
const BLUE = 0x7fa8f5;
const ORANGE = 0xffb878;
const PURPLE = 0xbb86fc;

// Ordem igual à do design: eventos, ação, controle
export function createDefaultCatalog(): BlockCatalog {
  const events = new BlockGroup('event', 'Eventos', YELLOW)
    .addBlock({ id: 'on-flag', label: 'Ao clicar na bandeira', color: YELLOW, shape: 'hat' })
    .addBlock({ id: 'on-start', label: 'Ao iniciar fase', color: YELLOW, shape: 'hat' });

  const action = new BlockGroup('action', 'Ação', BLUE)
    .addBlock({ id: 'attack', label: 'Atacar', color: BLUE, shape: 'stack' })
    .addBlock({ id: 'defend', label: 'Defender', color: BLUE, shape: 'stack' })
    .addBlock({ id: 'advance', label: 'Avançar', color: BLUE, shape: 'stack' });

  const control = new BlockGroup('control', 'Controle', ORANGE)
    .addBlock({ id: 'repeat', label: 'Repetir 3x', color: ORANGE, shape: 'c-block' })
    .addBlock({ id: 'if-else', label: 'Se / Senão', color: PURPLE, shape: 'c-block' });

  return new BlockCatalog().registerGroup(events).registerGroup(action).registerGroup(control);
}
