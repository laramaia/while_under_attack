// Jogo 
export const GAME_W = 1280;
export const GAME_H = 720;

// Geral 
export const HOVER_SCALE = 1.08;

// Telemetria
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8001';
export const GAME_VERSION = '0.3.0';
export const CATALOG_VERSION = '2026.11.2-rascunho';
export const SCHEMA_VERSION = 1;
export const CURRENT_PHASE_ID = 'F01';

// Escala da arte dos painéis
export const PANEL_SCALE = GAME_H / 768;
const s = (px: number) => px * PANEL_SCALE;

// Painel do editor
export const PALETTE_IMG_W = s(544);
export const WORKSPACE_IMG_W = s(598);
export const SEAM_X = s(446);
export const PANEL_W = SEAM_X + WORKSPACE_IMG_W;
export const PANEL_EDGE_X = s(98);
export const PANEL_PEEK_W = 60;
export const VISIBLE_TAB_WIDTH = 158;
export const PANEL_SLIDE_MS = 350;
export const PANEL_SLIDE_EASE = 'Cubic.easeInOut';

export const PALETTE_ART_EXTRA_H = 37;
export const ART_BLEED = 1;

// Setas de abrir/fechar o painel
export const ARROW_SCALE = 0.08;
export const ARROW_GAP = 70;
export const ARROW_X_OFFSET = 40;
export const ARROW_Y_OFFSET = 270;

// PaletteTab
export const PLATE_X = 1;
export const PLATE_Y = -10;
export const PLATE_W = 130;
export const PLATE_H = 500;

export const TAB_ICON_SIZE = 40;
export const TAB_X_OFFSET = -14;
export const TAB_GAP = 28;
export const TAB_PAD_Y = 70;
export const TAB_LABEL_GAP = 4;
export const TAB_LABEL_H = 14;
export const TAB_ITEM_H = TAB_ICON_SIZE + TAB_LABEL_GAP + TAB_LABEL_H;
export const TAB_LABEL_FONT = 'Arial, sans-serif';
export const TAB_LABEL_SIZE = '12px';
export const TAB_LABEL_COLOR = '#2b2118';
export const TAB_SELECTED_SCALE = 1.12;
export const TAB_IDLE_ALPHA = 0.6;
export const TAB_LABEL_IDLE_ALPHA = 0.7;

// Palette lista de blocos 
export const PALETTE_CONTENT_X = s(140);
export const PALETTE_CONTENT_W = s(320);
export const BLOCK_W = 250;
export const BLOCK_LIST_Y = 114;
export const BLOCK_GAP = 10;

// Workspace 
export const WORKSPACE_CONTENT_X = SEAM_X + s(105);
export const WORKSPACE_CONTENT_W = PANEL_W - WORKSPACE_CONTENT_X - s(20);
export const WORKSPACE_DROP_MIN_Y = 70;
export const WORKSPACE_TITLE_X = 40;
export const WORKSPACE_TITLE_Y = 36;
export const WORKSPACE_TITLE_SIZE = '34px';
export const WORKSPACE_TITLE_COLOR = '#4a4242';
export const WORKSPACE_TITLE_FONT = 'Georgia, serif';
export const RESTART_H = 64;
export const RESTART_GAP = 26;

export const HERO_MAX_HP = 100;
export const ENEMY_MAX_HP = 100;
export const ATTACK_DAMAGE = 100;
export const ENEMY_DAMAGE = 50;
export const PLAN_TIME_MS = 15000;
export const ENEMY_WALK_MS = 4000;
export const ENEMY_START_X = GAME_W + 150;
export const ENEMY_STOP_X = 520;
export const ENEMY_STOP_X_F02 = 680;

export const TIMER_FONT = 'Georgia, serif';
export const TIMER_SIZE = '64px';
export const TIMER_COLOR = '#2b2118';
export const TIMER_WARN_COLOR = '#b3261e';
export const TIMER_STROKE = '#f3efe6';
export const TIMER_WARN_AT_S = 5;
export const TIMER_MARGIN_TOP = 12;
export const TIMER_DEPTH = 600;
export const ENEMY_DEATH_DELAY_MS = 500;
export const ENEMY_FADE_MS = 600;

// Morte do guerreiro. Os mesmos tempos do inimigo, de proposito: as duas
// mortes sao a mesma cena vista dos dois lados, e tempos diferentes fariam
// uma parecer mais importante que a outra.
export const HERO_DEATH_DELAY_MS = ENEMY_DEATH_DELAY_MS;
export const HERO_FADE_MS = ENEMY_FADE_MS;

// Tela de "voce morreu"
//
// Generica de proposito: e um retangulo com texto e um botao, para o fluxo
// existir e poder ser testado. A arte propria entra depois, trocando o que
// esta aqui sem mexer em DeathPopup.ts.
export const DEATH_DEPTH = 900;          // acima do editor (500) e do timer (600)
export const DEATH_VEU_COLOR = 0x1a1410; // escurece a cena atras
export const DEATH_VEU_ALPHA = 0.72;
export const DEATH_PANEL_W = 520;
export const DEATH_PANEL_H = 260;
export const DEATH_PANEL_COLOR = 0xf3efe6;
export const DEATH_PANEL_RADIUS = 18;
export const DEATH_BORDER_COLOR = 0x8c3b3b;
export const DEATH_BORDER_W = 4;
export const DEATH_TITLE = 'Você morreu';
export const DEATH_TITLE_SIZE = '46px';
export const DEATH_TITLE_COLOR = '#8c3b3b';
export const DEATH_SUBTITLE = 'O inimigo derrubou o guerreiro.';
export const DEATH_SUBTITLE_SIZE = '20px';
export const DEATH_SUBTITLE_COLOR = '#4a4242';
export const DEATH_FONT = 'Georgia, serif';
export const DEATH_BUTTON_LABEL = 'Tentar de novo';
export const DEATH_BUTTON_SIZE = '24px';
export const DEATH_BUTTON_COLOR = '#ffffff';
export const DEATH_BUTTON_BG = '#8c3b3b';
export const DEATH_FADE_MS = 220;