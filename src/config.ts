export const GAME_W = 1280; 
export const GAME_H = 720;
export const PANEL_SCALE = GAME_H / 768; 

const s = (px: number) => px * PANEL_SCALE;

export const PALETTE_IMG_W = s(544);
export const WORKSPACE_IMG_W = s(598);
export const SEAM_X = s(446);           
export const PANEL_W = SEAM_X + WORKSPACE_IMG_W;
export const PANEL_EDGE_X = s(98);
export const PANEL_PEEK_W = 60; 

export const ARROW_SCALE = 0.08; 
export const ARROW_GAP = 90;     
export const PALETTE_CONTENT_X = s(110);
export const PALETTE_CONTENT_W = s(320);
export const WORKSPACE_CONTENT_X = SEAM_X + s(105);
export const WORKSPACE_CONTENT_W = PANEL_W - WORKSPACE_CONTENT_X - s(20);
export const BLOCK_W = 250;

export const EDITOR_BASE_WIDTH = 1280;
export const EDITOR_BASE_HEIGHT = 720;
export const VISIBLE_TAB_WIDTH = 158;