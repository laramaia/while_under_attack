// Jogo 
export const GAME_W = 1280;
export const GAME_H = 720;

// Geral 
export const HOVER_SCALE = 1.08;

// Telemetria
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8001';
export const GAME_VERSION = '0.3.0';
export const CATALOG_VERSION = '2026.11.1-rascunho';
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
export const PLATE_X = 10;
export const PLATE_Y = -35;
export const PLATE_W = 130;
export const PLATE_H = 380;

export const TAB_ICON_SIZE = 40;
export const TAB_GAP = 12;
export const TAB_PAD_Y = 40;
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