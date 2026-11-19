import { ATTACK_DAMAGE, PLAN_TIME_MS, ENEMY_STOP_X } from '../config';

export interface Level {
  faseId: string;
  enemy: string;
  enemyHits: number;
  planTimeMs: number;
  blocks: string[];
  enemyStopX?: number;
}

export const LEVELS: Level[] = [
  { 
    faseId: 'F01', 
    enemy: 'cursed_knight', 
    enemyHits: 1, 
    planTimeMs: PLAN_TIME_MS, 
    blocks: ['on-flag', 'attack'],
    enemyStopX: ENEMY_STOP_X 
  },
  { 
    faseId: 'F02', 
    enemy: 'cursed_knight', 
    enemyHits: 1, 
    planTimeMs: PLAN_TIME_MS, 
    blocks: ['on-flag', 'advance', 'attack'],
    enemyStopX: 700 
  },
  { 
    faseId: 'F03', 
    enemy: 'cursed_knight', 
    enemyHits: 3, 
    planTimeMs: PLAN_TIME_MS, 
    blocks: ['on-flag', 'advance', 'attack', 'defend', 'repeat'],
    enemyStopX: 520
  },
  { 
    faseId: 'F04', 
    enemy: 'cursed_knight', 
    enemyHits: 3, 
    planTimeMs: PLAN_TIME_MS, 
    blocks: ['on-flag', 'advance', 'attack', 'defend', 'repeat'],
    enemyStopX: 520
  },
  { 
    faseId: 'F05', 
    enemy: 'cursed_knight', 
    enemyHits: 1, 
    planTimeMs: PLAN_TIME_MS, 
    blocks: ['on-flag', 'advance', 'attack', 'defend', 'repeat', 'if-else'],
    enemyStopX: 520
  },
  { 
    faseId: 'F06', 
    enemy: 'cursed_knight', 
    enemyHits: 3, 
    planTimeMs: PLAN_TIME_MS, 
    blocks: ['on-flag', 'advance', 'attack', 'defend', 'repeat', 'if-else'],
    enemyStopX: 520
  },
];

export function getLevel(faseId: string): Level | undefined {
  return LEVELS.find(l => l.faseId === faseId);
}

export function getNextLevel(faseId: string): Level | undefined {
  const index = LEVELS.findIndex(l => l.faseId === faseId);
  if (index >= 0 && index < LEVELS.length - 1) {
    return LEVELS[index + 1];
  }
  return undefined;
}

export function enemyHpOf(level: Level): number {
  return level.enemyHits * ATTACK_DAMAGE;
}