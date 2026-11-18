import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config';
import { AddBackground } from '../game/AddBackground';
import { login } from '../telemetry/auth';
import { telemetry } from '../telemetry/telemetry';
import { getVisibleArea } from '../utils/viewport';

export class LoginScene extends Phaser.Scene {
  private overlay?: HTMLDivElement;
  private background!: Phaser.GameObjects.Image;

  constructor() {
    super('LoginScene');
  }

  create(): void {
    this.background = AddBackground(this);
    this.fitCamera();

    const onResize = () => this.fitCamera();
    this.scale.on('resize', onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', onResize);
      this.overlay?.remove();
    });

    this.overlay = this.montarFormulario();
  }

  private fitCamera(): void {
    const { zoom, width, height } = getVisibleArea(this);

    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(GAME_W / 2, GAME_H / 2);

    this.background.setPosition(GAME_W / 2, GAME_H / 2);
    this.background.setScale(
      Math.max(width / this.background.width, height / this.background.height),
    );
  }

  private montarFormulario(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(20,18,16,0.55);z-index:10;font-family:Arial,sans-serif;';

    overlay.innerHTML = `
      <form style="background:#f3efe6;padding:32px;border-radius:12px;width:300px;
                   display:flex;flex-direction:column;gap:12px;">
        <h2 style="margin:0;color:#2b2118;">Entrar</h2>
        <input name="usuario" placeholder="Usuário" autocomplete="username" required
               style="padding:10px;font-size:16px;" />
        <input name="senha" type="password" placeholder="Senha"
               autocomplete="current-password" required style="padding:10px;font-size:16px;" />
        <button type="submit" style="padding:10px;font-size:16px;cursor:pointer;">Entrar</button>
        <p data-erro style="margin:0;color:#a33;min-height:20px;font-size:14px;"></p>
      </form>`;

    const form = overlay.querySelector('form') as HTMLFormElement;
    const erro = overlay.querySelector('[data-erro]') as HTMLParagraphElement;
    const botao = overlay.querySelector('button') as HTMLButtonElement;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const dados = new FormData(form);
      botao.disabled = true;
      botao.textContent = 'Entrando...';
      erro.textContent = '';

      try {
        const sessao = await login(String(dados.get('usuario')), String(dados.get('senha')));
        if (sessao.perfil === 'jogador') {
          telemetry.iniciarSessao(sessao.token, sessao.jogador_id);
        }
        this.scene.start('BattleScene');
      } catch (err) {
        erro.textContent =
          err instanceof Error && err.message === 'credenciais'
            ? 'Usuário ou senha incorretos.'
            : 'Não foi possível conectar ao servidor.';
        botao.disabled = false;
        botao.textContent = 'Entrar';
      }
    });

    document.body.appendChild(overlay);
    return overlay;
  }
}