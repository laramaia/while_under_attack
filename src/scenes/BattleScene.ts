import Phaser from 'phaser';
import { EditorPanel } from '../editor/EditorPanel';
import { BlockDragger } from '../editor/BlockDragger';
import { BlockInstance } from '../editor/BlockInstance';
import { GameArea } from '../game/GameArea';
import { createDefaultCatalog } from '../model/defaultCatalog';
import { AddBackground } from '../game/AddBackground';
import { FimDeExecucao, ProgramRunner } from '../model/ProgramRunner';
import { PlanTimer } from '../ui/PlanTimer';
import { getVisibleArea } from '../utils/viewport';
import { GAME_H, GAME_W, CURRENT_PHASE_ID, PLAN_TIME_MS } from '../config';
import { telemetry } from '../telemetry/telemetry';
import { serializarPrograma } from '../telemetry/programa';
import { getLevel, enemyHpOf, getNextLevel } from '../model/level';

export class BattleScene extends Phaser.Scene {
  private editor!: EditorPanel;
  private background!: Phaser.GameObjects.Image;
  private timer!: PlanTimer;

  private tentativaId: string | null = null;
  private ids = new Map<BlockInstance, string>();
  private editStart = 0;
  private execStart = 0;
  private currentFaseId: string = CURRENT_PHASE_ID;

  constructor() {
    super('BattleScene');
  }

  preload(): void {
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.error(
        `Falha ao carregar o recurso: ${file.key}`,
        file.src,
      );
    });
    this.load.image('button_play', 'assets/ui/button_play.png');
    this.load.image('button_pause', 'assets/ui/button_pause.png');
    this.load.image('button_restart', 'assets/ui/button_restart.png');
    this.load.image('palette_tab_background', 'assets/ui/panel/palette_tab_background.png');
    this.load.image('tab_event', 'assets/ui/panel/tab_event.png');
    this.load.image('tab_action', 'assets/ui/panel/tab_action.png');
    this.load.image('tab_repeat', 'assets/ui/panel/tab_repeat.png');
    this.load.image('tab_condition', 'assets/ui/panel/tab_condition.png');
    this.load.image('yellow_block_hat', 'assets/ui/panel/blocks/yellow_block_hat.png');
    this.load.image('blue_block_stack', 'assets/ui/panel/blocks/blue_block_stack.png');

    const blockColors = ['orange', 'purple'];
    const cParts = ['top', 'middle', 'bottom'];

    blockColors.forEach((color) => {
      cParts.forEach((part) => {
        const key = `${color}_block_${part}`;
        this.load.image(key, `assets/ui/panel/blocks/${key}.png`);
      });
    });
  }

  create(): void {
    this.background = AddBackground(this);

    const gameArea = new GameArea(this);
    const runner = new ProgramRunner(gameArea);

    this.editor = new EditorPanel(this, createDefaultCatalog());
    this.editor.setDepth(500);
    this.add.existing(this.editor);

    this.timer = new PlanTimer(this);
    new BlockDragger(this, this.editor);

    const onResize = () => {
      this.adjustCameraToScreen();
      this.editor.onResize();
      this.timer.layout();
    };
    this.scale.on('resize', onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', onResize);
    });

    this.adjustCameraToScreen();

    gameArea.on('play', () => this.onPlay(gameArea, runner, 'jogador'));
    runner.on('finished', (fim: FimDeExecucao) => void this.onFinished(gameArea, runner, fim));
    this.editor.workspace.on('restart', () => runner.stop());

    telemetry.registrar('fase_iniciada', { fase_id: this.currentFaseId });
    this.startRound(gameArea, runner).catch((e) => console.error('[startRound]', e));
  }

  private async startRound(gameArea: GameArea, runner: ProgramRunner): Promise<void> {
    this.timer.stop();

    const level = getLevel(this.currentFaseId);
    gameArea.resetHp(level ? enemyHpOf(level) : undefined);
    gameArea.resetPositions();
    this.editor.close();
    await gameArea.enemyApproach(level?.enemyStopX);

    this.editor.open();
    this.editStart = performance.now();
    this.timer.start(level?.planTimeMs ?? PLAN_TIME_MS, () => this.onPlay(gameArea, runner, 'tempo_esgotado'));
  }

  private onPlay(
    gameArea: GameArea,
    runner: ProgramRunner,
    disparo: 'jogador' | 'tempo_esgotado',
  ): void {
    if (runner.running || this.tentativaId) return;

    const roots = this.editor.workspace.roots;
    const executavel = runner.canRun(roots);
    if (!executavel && disparo === 'jogador') return;

    if (disparo === 'jogador') this.timer.stop();
    this.editor.close();

    const { programa, ids } = serializarPrograma(roots);
    this.tentativaId = crypto.randomUUID();
    this.ids = ids;
    this.execStart = performance.now();

    telemetry.registrar('tentativa_executada', {
      tentativa_id: this.tentativaId,
      fase_id: this.currentFaseId,
      programa,
      disparo,
      tempo_edicao_ms: Math.round(this.execStart - this.editStart),
    });

    if (executavel) {
      runner.run(roots);
    } else {
      void this.onFinished(gameArea, runner, {
        interrompida: false,
        programaConcluido: true,
        blocoEmExecucao: null,
      });
    }
  }

  private async onFinished(
    gameArea: GameArea,
    runner: ProgramRunner,
    fim: FimDeExecucao,
  ): Promise<void> {
    const tentativaId = this.tentativaId;
    if (!tentativaId) return;

    if (!fim.interrompida && gameArea.enemyHp > 0 && gameArea.heroHp > 0) {
      await gameArea.enemyAttacksUntilHeroDies();
    }

    const resultado = fim.interrompida
      ? 'interrompida'
      : gameArea.enemyHp <= 0
        ? 'vitoria'
        : 'derrota';

    telemetry.registrar('tentativa_finalizada', {
      tentativa_id: tentativaId,
      fase_id: this.currentFaseId,
      resultado,
      duracao_execucao_ms: Math.max(0, Math.round(performance.now() - this.execStart)),
      vida_guerreiro_final: Math.max(0, Math.round(gameArea.heroHp)),
      vida_inimigo_final: Math.max(0, Math.round(gameArea.enemyHp)),
      programa_concluido: fim.programaConcluido,
      bloco_em_execucao_id: fim.programaConcluido
        ? null
        : (fim.blocoEmExecucao ? this.ids.get(fim.blocoEmExecucao) ?? null : null),
    });

    this.tentativaId = null;
    this.timer.stop();

    if (resultado === 'vitoria') {
      const next = getNextLevel(this.currentFaseId);
      if (next) {
        this.currentFaseId = next.faseId;
        this.editor.workspace.clearBlocks();
        telemetry.registrar('fase_iniciada', { fase_id: this.currentFaseId });
        await this.startRound(gameArea, runner);
      } else {
        console.log('Fim de jogo!');
      }
    } else {
      await this.startRound(gameArea, runner);
    }
  }

  private adjustCameraToScreen(): void {
    const { zoom, width, height } = getVisibleArea(this);

    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(GAME_W / 2, GAME_H / 2);

    if (this.background) {
      this.background.setPosition(GAME_W / 2, GAME_H / 2);
      this.background.setScale(
        Math.max(width / this.background.width, height / this.background.height),
      );
    }
  }
}