import Phaser from 'phaser';
import {
  DEATH_BORDER_COLOR,
  DEATH_BORDER_W,
  DEATH_BUTTON_BG,
  DEATH_BUTTON_COLOR,
  DEATH_BUTTON_LABEL,
  DEATH_BUTTON_SIZE,
  DEATH_DEPTH,
  DEATH_FADE_MS,
  DEATH_FONT,
  DEATH_PANEL_COLOR,
  DEATH_PANEL_H,
  DEATH_PANEL_RADIUS,
  DEATH_PANEL_W,
  DEATH_SUBTITLE,
  DEATH_SUBTITLE_COLOR,
  DEATH_SUBTITLE_SIZE,
  DEATH_TITLE,
  DEATH_TITLE_COLOR,
  DEATH_TITLE_SIZE,
  DEATH_VEU_ALPHA,
  DEATH_VEU_COLOR,
  GAME_H,
  GAME_W,
  HOVER_SCALE,
} from '../config';
import { getVisibleArea } from '../utils/viewport';

/**
 * A tela de "voce morreu", com o botao de tentar de novo.
 *
 * E deliberadamente generica: retangulo, texto e botao, tudo desenhado com
 * primitivas do Phaser e com cada cor, medida e palavra vindo do `config.ts`.
 * A arte propria da equipe entra trocando aquelas constantes ou os objetos
 * criados aqui, sem mexer em quem chama -- a `BattleScene` so sabe `show` e
 * `hide`.
 *
 * Segue o mesmo desenho do `PlanTimer`: classe simples (nao e GameObject),
 * recebe a cena, tem `layout()` para o redimensionamento e solta o que
 * registrou no `SHUTDOWN`.
 */
export class DeathPopup {
  private readonly container: Phaser.GameObjects.Container;
  private readonly veu: Phaser.GameObjects.Rectangle;
  private readonly painel: Phaser.GameObjects.Graphics;
  private readonly titulo: Phaser.GameObjects.Text;
  private readonly subtitulo: Phaser.GameObjects.Text;
  private readonly botao: Phaser.GameObjects.Text;
  private aoReiniciar: (() => void) | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.veu = scene.add
      .rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, DEATH_VEU_COLOR, DEATH_VEU_ALPHA)
      // O veu tambem engole o clique: com o editor aberto atras, sem isto da
      // para arrastar bloco e apertar Play com a tela da morte na frente.
      .setInteractive();

    this.painel = scene.add.graphics();
    this.desenharPainel();

    this.titulo = scene.add
      .text(0, -DEATH_PANEL_H / 2 + 56, DEATH_TITLE, {
        fontFamily: DEATH_FONT,
        fontSize: DEATH_TITLE_SIZE,
        fontStyle: 'bold',
        color: DEATH_TITLE_COLOR,
      })
      .setOrigin(0.5)
      .setResolution(2);

    this.subtitulo = scene.add
      .text(0, -DEATH_PANEL_H / 2 + 110, DEATH_SUBTITLE, {
        fontFamily: DEATH_FONT,
        fontSize: DEATH_SUBTITLE_SIZE,
        color: DEATH_SUBTITLE_COLOR,
      })
      .setOrigin(0.5)
      .setResolution(2);

    this.botao = scene.add
      .text(0, DEATH_PANEL_H / 2 - 62, DEATH_BUTTON_LABEL, {
        fontFamily: DEATH_FONT,
        fontSize: DEATH_BUTTON_SIZE,
        color: DEATH_BUTTON_COLOR,
        backgroundColor: DEATH_BUTTON_BG,
        padding: { x: 34, y: 12 },
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setInteractive({ useHandCursor: true });

    this.botao.on('pointerover', () => this.botao.setScale(HOVER_SCALE));
    this.botao.on('pointerout', () => this.botao.setScale(1));
    this.botao.on('pointerdown', () => this.confirmar());

    this.container = scene.add
      .container(GAME_W / 2, GAME_H / 2, [this.painel, this.titulo, this.subtitulo, this.botao])
      .setDepth(DEATH_DEPTH);

    this.veu.setDepth(DEATH_DEPTH - 1);

    this.esconder();
    this.layout();

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.botao.removeAllListeners();
      this.veu.removeAllListeners();
    });
  }

  get visivel(): boolean {
    return this.container.visible;
  }

  /** Mostra a tela. `aoReiniciar` roda uma vez, quando o botao for apertado. */
  show(aoReiniciar: () => void): void {
    this.aoReiniciar = aoReiniciar;
    this.layout();

    this.veu.setAlpha(0).setVisible(true);
    this.container.setAlpha(0).setVisible(true);

    this.scene.tweens.add({
      targets: [this.veu, this.container],
      alpha: { from: 0, to: 1 },
      duration: DEATH_FADE_MS,
    });
    // O veu tem alpha proprio (DEATH_VEU_ALPHA) e o tween acima o levaria a 1,
    // deixando a cena atras invisivel. Por isso ele tem o seu.
    this.scene.tweens.add({
      targets: this.veu,
      alpha: { from: 0, to: DEATH_VEU_ALPHA },
      duration: DEATH_FADE_MS,
    });
  }

  hide(): void {
    this.aoReiniciar = null;
    this.esconder();
  }

  /** Reposiciona no redimensionamento, como o `PlanTimer.layout`. */
  layout(): void {
    const { width, height } = getVisibleArea(this.scene);
    this.veu.setPosition(GAME_W / 2, GAME_H / 2).setSize(width, height);
    this.container.setPosition(GAME_W / 2, GAME_H / 2);
  }

  private confirmar(): void {
    const callback = this.aoReiniciar;
    if (!callback) return;
    // Zera antes de chamar: dois cliques rapidos no botao reiniciariam a
    // rodada duas vezes, e a segunda chegaria com a fase ja remontada.
    this.aoReiniciar = null;
    this.esconder();
    callback();
  }

  private esconder(): void {
    this.container.setVisible(false);
    this.veu.setVisible(false);
  }

  private desenharPainel(): void {
    const x = -DEATH_PANEL_W / 2;
    const y = -DEATH_PANEL_H / 2;

    this.painel
      .fillStyle(DEATH_PANEL_COLOR, 1)
      .fillRoundedRect(x, y, DEATH_PANEL_W, DEATH_PANEL_H, DEATH_PANEL_RADIUS)
      .lineStyle(DEATH_BORDER_W, DEATH_BORDER_COLOR, 1)
      .strokeRoundedRect(x, y, DEATH_PANEL_W, DEATH_PANEL_H, DEATH_PANEL_RADIUS);
  }
}
