import { BlockCatalog } from './BlockCatalog';
import { BlockGroup } from './BlockGroup';

const YELLOW = 0xf7d774;
const BLUE = 0x7fa8f5;
const ORANGE = 0xffb878;
const PURPLE = 0xbb86fc;

export function createDefaultCatalog(): BlockCatalog {
  const events = new BlockGroup('event', 'Eventos', YELLOW)
    .addBlock({ id: 'on-flag', label: 'Ao clicar em play', colorKey: 'yellow', shape: 'hat' })
    .addBlock({ id: 'on-start', label: 'Ao iniciar fase', colorKey: 'yellow', shape: 'hat' });

  const action = new BlockGroup('action', 'Ação', BLUE)
    .addBlock({ id: 'attack', label: 'Atacar', colorKey: 'blue', shape: 'stack' })
    .addBlock({ id: 'defend', label: 'Defender', colorKey: 'blue', shape: 'stack' })
    .addBlock({ id: 'advance', label: 'Avançar', colorKey: 'blue', shape: 'stack' });

  const repeat = new BlockGroup('repeat', 'Repetição', ORANGE)
    .addBlock({ id: 'repeat', label: 'Repetir 3x', colorKey: 'orange', shape: 'c-block' });

  const condition = new BlockGroup('condition', 'Condicional', PURPLE)
    .addBlock({ id: 'if-else', label: 'Se / Senão', colorKey: 'purple', shape: 'c-block' });

  return new BlockCatalog()
    .registerGroup(events)
    .registerGroup(action)
    .registerGroup(repeat)
    .registerGroup(condition);
}