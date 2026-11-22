import { ATTACK_DAMAGE, ENEMY_STOP_X } from '../config';

const DEFAULT_PLAN_TIME_MS = 15000;

export interface EnemyEncounter {
  enemy: string;
  hits: number;
  startX?: number;
  stopX?: number;
  advanceOnSpawn?: boolean;
}

export interface Level {
  faseId: string;
  enemy: string;
  enemyHits: number;
  planTimeMs: number;
  blocks: string[];
  enemyStopX?: number;
  advanceDistance?: number;
  instruction?: string;
  enemies?: EnemyEncounter[];
}

export const LEVELS: Level[] = [
  {
    faseId: 'F01',
    enemy: 'cursed_knight',
    enemyHits: 1,
    planTimeMs: DEFAULT_PLAN_TIME_MS,
    blocks: ['on-flag', 'attack'],
    enemyStopX: ENEMY_STOP_X,
    instruction: 'Um inimigo apareceu! Crie um programa para fazer o guerreiro atacá-lo.',
  },
  {
    faseId: 'F02',
    enemy: 'cursed_knight',
    enemyHits: 1,
    planTimeMs: DEFAULT_PLAN_TIME_MS,
    blocks: ['on-flag', 'advance', 'attack'],
    enemyStopX: 700,
    instruction: 'O inimigo está longe demais! Como você pode fazer o guerreiro chegar até ele antes de atacar?',
  },
  {
    faseId: 'F03',
    enemy: 'cursed_knight',
    enemyHits: 3,
    planTimeMs: DEFAULT_PLAN_TIME_MS,
    blocks: ['on-flag', 'advance', 'attack', 'repeat'],
    enemyStopX: 520,
    instruction: 'O inimigo aguenta vários golpes! Que tal encontrar uma maneira de repetir seus ataques?',
  },
  {
    faseId: 'F04',
    enemy: 'cursed_knight',
    enemyHits: 1,
    planTimeMs: DEFAULT_PLAN_TIME_MS,
    blocks: ['on-flag', 'advance', 'attack', 'defend', 'repeat'],
    enemyStopX: 650,
    advanceDistance: 150,
    instruction: 'Três inimigos surgiram no caminho! Como você pode repetir a sequência para enfrentar todos eles?',
    enemies: [
      { enemy: 'cursed_knight', hits: 1, startX: 900, stopX: 600, advanceOnSpawn: true },
      { enemy: 'cursed_knight', hits: 1, startX: 950, stopX: 750, advanceOnSpawn: true },
      { enemy: 'cursed_knight', hits: 1, startX: 1010, stopX: 860, advanceOnSpawn: true },
    ],
  },
  {
    faseId: 'F05',
    enemy: 'cursed_knight',
    enemyHits: 1,
    planTimeMs: DEFAULT_PLAN_TIME_MS,
    blocks: ['on-flag', 'advance', 'attack', 'defend', 'repeat', 'if-else'],
    enemyStopX: 520,
  },
  {
    faseId: 'F06',
    enemy: 'cursed_knight',
    enemyHits: 3,
    planTimeMs: DEFAULT_PLAN_TIME_MS,
    blocks: ['on-flag', 'advance', 'attack', 'defend', 'repeat', 'if-else'],
    enemyStopX: 520,
  },
];

export function getLevel(faseId: string): Level | undefined {
  return LEVELS.find((l) => l.faseId === faseId);
}

export function getNextLevel(faseId: string): Level | undefined {
  const index = LEVELS.findIndex((l) => l.faseId === faseId);
  if (index >= 0 && index < LEVELS.length - 1) {
    return LEVELS[index + 1];
  }
  return undefined;
}

export function enemyHpOf(level: Level): number {
  if (level.enemies && level.enemies.length > 0) {
    return level.enemies[0].hits * ATTACK_DAMAGE;
  }
  return level.enemyHits * ATTACK_DAMAGE;
}