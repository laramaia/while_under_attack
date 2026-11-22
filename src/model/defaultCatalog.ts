import { BlockCatalog } from './BlockCatalog';
import { BlockGroup } from './BlockGroup';

const YELLOW = 0xf7d774;
const BLUE = 0x7fa8f5;
const ORANGE = 0xffb878;
const PURPLE = 0xbb86fc;

export function createDefaultCatalog(allowedBlocks?: string[]): BlockCatalog {
  const isAllowed = (id: string) => !allowedBlocks || allowedBlocks.includes(id);

  const catalog = new BlockCatalog();

  const events = new BlockGroup('event', 'Eventos', YELLOW);
  if (isAllowed('on-flag')) {
    events.addBlock({ id: 'on-flag', label: 'Ao clicar em play', colorKey: 'yellow', shape: 'hat' });
  }
  if (isAllowed('on-start')) {
    events.addBlock({ id: 'on-start', label: 'Ao iniciar fase', colorKey: 'yellow', shape: 'hat' });
  }
  if (events.blocks.length > 0) catalog.registerGroup(events);

  const action = new BlockGroup('action', 'Ação', BLUE);
  if (isAllowed('attack')) {
    action.addBlock({ id: 'attack', label: 'Atacar', colorKey: 'blue', shape: 'stack' });
  }
  if (isAllowed('defend')) {
    action.addBlock({ id: 'defend', label: 'Defender', colorKey: 'blue', shape: 'stack' });
  }
  if (isAllowed('advance')) {
    action.addBlock({ id: 'advance', label: 'Avançar', colorKey: 'blue', shape: 'stack' });
  }
  if (action.blocks.length > 0) catalog.registerGroup(action);

  const repeat = new BlockGroup('repeat', 'Repetição', ORANGE);
  if (isAllowed('repeat')) {
    repeat.addBlock({ id: 'repeat', label: 'Repetir 3x', colorKey: 'orange', shape: 'c-block' });
  }
  if (repeat.blocks.length > 0) catalog.registerGroup(repeat);

  const condition = new BlockGroup('condition', 'Condicional', PURPLE);
  if (isAllowed('if-else')) {
    condition.addBlock({ id: 'if-else', label: 'Se / Senão', colorKey: 'purple', shape: 'c-block' });
  }
  if (condition.blocks.length > 0) catalog.registerGroup(condition);

  return catalog;
}