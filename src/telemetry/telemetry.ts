import { API_URL, CATALOG_VERSION, GAME_VERSION, SCHEMA_VERSION } from '../config';

type EventType =
  | 'sessao_iniciada'
  | 'sessao_encerrada'
  | 'fase_iniciada'
  | 'tentativa_executada'
  | 'tentativa_finalizada';

interface Evento {
  event_id: string;
  event_type: EventType;
  schema_version: number;
  catalog_version: string;
  game_version: string;
  session_id: string;
  seq: number;
  occurred_at: string;
  payload: Record<string, unknown>;
}

const QUEUE_KEY = 'wua_fila_eventos';
const DONO_KEY = 'wua_fila_dono';
const FLUSH_MS = 10_000;
const BATCH_MAX = 50;
const INGEST_PATH = '/api/eventos';

class Telemetry {
  private token: string | null = null;
  private sessionId = '';
  private seq = 0;
  private fila: Evento[] = this.carregar();
  private enviando = false;

  constructor() {
    setInterval(() => void this.flush(), FLUSH_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.encerrarSessao('app_em_segundo_plano');
      } else if (this.token && !this.sessionId) {
        this.abrirSessao();
      }
    });
  }

  iniciarSessao(token: string, jogadorId: number): void {
    this.token = token;
    this.trocarDonoDaFila(jogadorId);
    this.abrirSessao();
  }

  encerrarSessao(motivo: 'logout' | 'app_em_segundo_plano'): void {
    if (!this.sessionId) return;
    this.registrar('sessao_encerrada', { motivo });
    void this.flush(true);
    this.sessionId = '';
  }

  get ativa(): boolean {
    return this.token !== null;
  }

  registrar(tipo: EventType, payload: Record<string, unknown>): void {
    if (!this.sessionId) return;
    this.seq += 1;
    this.fila.push({
      event_id: crypto.randomUUID(),
      event_type: tipo,
      schema_version: SCHEMA_VERSION,
      catalog_version: CATALOG_VERSION,
      game_version: GAME_VERSION,
      session_id: this.sessionId,
      seq: this.seq,
      occurred_at: new Date().toISOString(),
      payload,
    });
    this.salvar();
  }

  async flush(keepalive = false): Promise<void> {
    if (this.enviando || !this.token || this.fila.length === 0) return;
    this.enviando = true;

    const lote = this.fila.slice(0, BATCH_MAX);
    try {
      const res = await fetch(`${API_URL}${INGEST_PATH}`, {
        method: 'POST',
        keepalive,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ eventos: lote }),
      });

      if (res.status === 401) {
        this.token = null;
        this.mostrarAvisoTokenExpirado();
        return;
      }

      const confirmado = res.status === 207 || res.ok;
      const invalido =
        res.status >= 400 && res.status < 500 && ![401, 408, 429].includes(res.status);

      if (confirmado || invalido) {
        if (invalido) console.error('[telemetria] lote recusado', res.status);
        this.fila.splice(0, lote.length);
        this.salvar();
      }
    } catch {
      // sem rede: os eventos continuam na fila e vão no próximo ciclo
    } finally {
      this.enviando = false;
    }
  }

  private mostrarAvisoTokenExpirado(): void {
    if (document.getElementById('wua-token-expired-modal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'wua-token-expired-modal';
    overlay.style.cssText =
      'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(20,18,16,0.65);z-index:9999;font-family:Arial,sans-serif;';

    overlay.innerHTML = `
      <div style="background:#f3efe6;padding:32px;border-radius:12px;width:320px;
                  display:flex;flex-direction:column;gap:16px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.3);">
        <h2 style="margin:0;color:#2b2118;font-size:20px;">Sessão Expirada</h2>
        <p style="margin:0;color:#555;font-size:14px;line-height:1.4;">
          Sua sessão expirou. Seu progresso local está salvo, mas você precisa entrar novamente.
        </p>
        <button id="wua-btn-relogin" style="padding:10px;font-size:16px;background:#2b2118;color:#fff;border:none;border-radius:6px;cursor:pointer;">
          Fazer Login Novamente
        </button>
      </div>`;

    document.body.appendChild(overlay);

    const btn = overlay.querySelector('#wua-btn-relogin');
    btn?.addEventListener('click', () => {
      window.location.reload();
    });
  }

  private abrirSessao(): void {
    this.sessionId = crypto.randomUUID();
    this.seq = 0;
    this.registrar('sessao_iniciada', {});
  }

  private trocarDonoDaFila(jogadorId: number): void {
    try {
      if (localStorage.getItem(DONO_KEY) !== String(jogadorId)) {
        this.fila = [];
        localStorage.setItem(DONO_KEY, String(jogadorId));
        this.salvar();
      }
    } catch {
      this.fila = [];
    }
  }

  private carregar(): Evento[] {
    try {
      return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
    } catch {
      return [];
    }
  }

  private salvar(): void {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(this.fila));
    } catch {
    }
  }
}

export const telemetry = new Telemetry();