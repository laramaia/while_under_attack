import { ATTACK_DAMAGE, PLAN_TIME_MS } from '../config';

export interface Level {
  faseId: string;
  enemy: string;
  enemyHits: number;
  planTimeMs: number;
  blocks: string[];
}

const BASE = ['on-flag', 'on-start', 'advance', 'attack', 'defend'];
const WITH_REPEAT = [...BASE, 'repeat'];
const WITH_IF = [...WITH_REPEAT, 'if-else'];

export const LEVELS: Level[] = [
  { faseId: 'F01', enemy: 'cursed_knight', enemyHits: 1, planTimeMs: PLAN_TIME_MS, blocks: BASE },
  { faseId: 'F02', enemy: 'cursed_knight', enemyHits: 3, planTimeMs: PLAN_TIME_MS, blocks: WITH_REPEAT },
  { faseId: 'F03', enemy: 'cursed_knight', enemyHits: 3, planTimeMs: PLAN_TIME_MS, blocks: WITH_REPEAT },
  { faseId: 'F04', enemy: 'cursed_knight', enemyHits: 1, planTimeMs: PLAN_TIME_MS, blocks: WITH_IF },
  { faseId: 'F05', enemy: 'cursed_knight', enemyHits: 3, planTimeMs: PLAN_TIME_MS, blocks: WITH_IF },
];

export function getLevel(index: number): Level | undefined {
  return LEVELS[index];
}

export function enemyHpOf(level: Level): number {
  return level.enemyHits * ATTACK_DAMAGE;
}