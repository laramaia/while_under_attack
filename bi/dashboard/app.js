// Peças compartilhadas pelas duas telas do dashboard.
// Sem etapa de build (ADR-002): este arquivo é carregado direto pelo navegador.

const CHAVE_SESSAO = 'wua.sessao';

// ---------------------------------------------------------------------------
// Sessão e chamadas à API
// ---------------------------------------------------------------------------

export function sessao() {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE_SESSAO) || 'null');
  } catch {
    return null;
  }
}

export function guardarSessao(dados) {
  sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(dados));
}

export function sair() {
  sessionStorage.removeItem(CHAVE_SESSAO);
  location.href = 'index.html';
}

export function exigirSessao(perfilNecessario) {
  const atual = sessao();
  if (!atual) {
    location.href = 'index.html';
    throw new Error('sem sessão');
  }
  // RN-005: a visão consolidada é só do professor. A API também recusa;
  // isto aqui só evita a tela quebrada.
  if (perfilNecessario === 'professor' && atual.perfil !== 'professor') {
    location.href = 'jogador.html';
    throw new Error('perfil sem acesso');
  }
  return atual;
}

export async function api(caminho) {
  const atual = sessao();
  const resposta = await fetch(`/api${caminho}`, {
    headers: atual ? { Authorization: `Bearer ${atual.token}` } : {},
  });

  if (resposta.status === 401) {
    sair();
    throw new Error('sessão expirada');
  }
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => ({}));
    throw new Error(corpo.detail || `erro ${resposta.status}`);
  }
  return resposta.json();
}

// ---------------------------------------------------------------------------
// Cabeçalho, tema e procedência dos dados
// ---------------------------------------------------------------------------

export function montarTopo(paginaAtual) {
  const atual = sessao();
  const topo = document.querySelector('header.topo');
  if (!topo || !atual) return;

  // O professor não joga (Glossário), então para ele a tela do jogador é uma
  // consulta a um jogador escolhido, não "o meu progresso".
  const abas = atual.perfil === 'professor'
    ? [['professor.html', 'Turma'], ['jogador.html', 'Por jogador']]
    : [['jogador.html', 'Meu progresso']];

  topo.innerHTML = `
    <h1>while under_attack</h1>
    <nav>${abas.map(([href, texto]) =>
      `<a href="${href}"${href === paginaAtual ? ' aria-current="page"' : ''}>${texto}</a>`
    ).join('')}</nav>
    <span class="espaco"></span>
    <span style="font-size:13px;color:var(--tinta-fraca)">${atual.nome_exibicao}</span>
    <button class="discreto" id="btn-tema">Tema</button>
    <button class="discreto" id="btn-sair">Sair</button>`;

  topo.querySelector('#btn-sair').onclick = sair;
  topo.querySelector('#btn-tema').onclick = alternarTema;
}

function alternarTema() {
  const escuroAgora = temaEscuro();
  document.documentElement.dataset.tema = escuroAgora ? 'claro' : 'escuro';
  try { localStorage.setItem('wua.tema', document.documentElement.dataset.tema); } catch {}
  window.dispatchEvent(new Event('tema-mudou'));
}

export function aplicarTemaSalvo() {
  try {
    const salvo = localStorage.getItem('wua.tema');
    if (salvo) document.documentElement.dataset.tema = salvo;
  } catch {}
}

export function temaEscuro() {
  const marcado = document.documentElement.dataset.tema;
  if (marcado) return marcado === 'escuro';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** RS-02: o dashboard diz na cara quando está mostrando dado sintético. */
export async function mostrarProcedencia() {
  const alvo = document.querySelector('#procedencia');
  if (!alvo) return;

  try {
    const p = await api('/procedencia');
    if (p.tem_sintetico) {
      const quanto = p.so_sintetico
        ? 'Todos os dados desta tela são sintéticos'
        : `${p.eventos_sinteticos} de ${p.eventos} eventos são sintéticos`;
      alvo.className = 'aviso sintetico';
      alvo.innerHTML =
        `<strong>Dados de desenvolvimento.</strong> ${quanto}, gerados para testar o ` +
        `ETL e o dashboard. Catálogo ${p.catalog_version}.`;
    } else {
      alvo.className = 'aviso';
      alvo.innerHTML =
        `<span style="color:var(--tinta-fraca)">${p.eventos} eventos · catálogo ` +
        `${p.catalog_version} · último ETL ${formatarData(p.ultimo_etl)}</span>`;
    }
  } catch {
    /* a procedência é informativa: se falhar, a tela continua útil */
  }
}

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

export const vazio = (v) => (v === null || v === undefined || v === '' ? '—' : v);

export function num(v, casas = 0) {
  if (v === null || v === undefined) return '—';
  return Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

export function formatarData(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/** Nomes técnicos do catálogo viram texto legível (PD-013 ainda vai mexer nesses ids). */
export function nomeDeBloco(tipo) {
  const nomes = {
    ao_clicar_em_play: 'Ao clicar em Play',
    andar: 'Andar',
    atacar: 'Atacar',
    se: 'Se',
    repetir: 'Repetir N vezes',
    enquanto: 'Enquanto',
  };
  return nomes[tipo] || tipo;
}

export const CAUSAS = {
  programa_curto: 'Programa curto demais',
  parou_em_bloco: 'Parou num bloco',
};

// ---------------------------------------------------------------------------
// Chart.js: padrões e tokens
// ---------------------------------------------------------------------------

export function cor(nome) {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}

/** Aplica os tokens de tinta/grade aos padrões do Chart.js. */
export function prepararGraficos() {
  Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  Chart.defaults.font.size = 12;
  Chart.defaults.color = cor('--tinta-fraca');
  Chart.defaults.borderColor = cor('--grade');
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.animation.duration = 300;

  // o texto nunca veste a cor da série
  Chart.defaults.plugins.legend.labels.color = cor('--tinta-2');
  Chart.defaults.plugins.legend.labels.boxWidth = 10;
  Chart.defaults.plugins.legend.labels.boxHeight = 10;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.padding = 14;

  Chart.defaults.plugins.tooltip.backgroundColor = cor('--superficie');
  Chart.defaults.plugins.tooltip.titleColor = cor('--tinta');
  Chart.defaults.plugins.tooltip.bodyColor = cor('--tinta-2');
  Chart.defaults.plugins.tooltip.borderColor = cor('--grade');
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.displayColors = true;
  Chart.defaults.plugins.tooltip.boxPadding = 4;
}

/** Eixos discretos: grade só no eixo do valor, sem moldura. */
export function eixos({ valorEm = 'y', tituloValor = '', inteiro = true } = {}) {
  const dosValores = {
    beginAtZero: true,
    grid: { color: cor('--grade'), drawTicks: false },
    border: { display: false },
    ticks: { precision: inteiro ? 0 : undefined, padding: 6 },
    title: tituloValor
      ? { display: true, text: tituloValor, color: cor('--tinta-fraca') }
      : undefined,
  };
  const dosRotulos = {
    grid: { display: false },
    border: { color: cor('--eixo') },
    ticks: { padding: 4 },
  };
  return valorEm === 'y'
    ? { y: dosValores, x: dosRotulos }
    : { x: dosValores, y: dosRotulos };
}

/** Barras finas, com a ponta arredondada presa à linha de base. */
export const BARRA = {
  borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
  borderSkipped: 'start',
  maxBarThickness: 40,
};

/** Barras horizontais: o arredondamento vai para a ponta direita. */
export const BARRA_H = {
  borderRadius: { topRight: 4, bottomRight: 4, topLeft: 0, bottomLeft: 0 },
  borderSkipped: 'start',
  maxBarThickness: 26,
};

/** Separador de 2px entre segmentos empilhados. */
export const EMPILHADA = {
  borderWidth: 2,
  borderColor: 'transparent',
  borderRadius: 4,
  borderSkipped: false,
  maxBarThickness: 44,
};

const graficos = new Map();

/** Cria (ou recria) um gráfico. Guardar a referência permite redesenhar no troca-tema. */
export function desenhar(idCanvas, config) {
  graficos.get(idCanvas)?.destroy();
  const tela = document.getElementById(idCanvas);
  if (!tela) return null;
  const grafico = new Chart(tela, config);
  graficos.set(idCanvas, grafico);
  return grafico;
}

/**
 * Mostra (ou tira) um aviso de "sem dados" sobre a área de um gráfico.
 * Não troca o canvas por texto: a tela do professor muda de jogador, e o
 * gráfico precisa poder voltar.
 */
export function semDados(idCanvas, mensagem) {
  const tela = document.getElementById(idCanvas);
  if (!tela) return false;

  const area = tela.parentElement;
  let aviso = area.querySelector('p.vazio');

  if (!mensagem) {
    aviso?.remove();
    tela.hidden = false;
    return false;
  }

  graficos.get(idCanvas)?.destroy();
  graficos.delete(idCanvas);
  tela.hidden = true;

  if (!aviso) {
    aviso = document.createElement('p');
    aviso.className = 'vazio';
    area.appendChild(aviso);
  }
  aviso.textContent = mensagem;
  return true;
}

/** O tema escuro tem passos próprios; não dá para inverter o claro. Redesenha tudo. */
export function aoTrocarTema(redesenhar) {
  window.addEventListener('tema-mudou', () => {
    prepararGraficos();
    redesenhar();
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!document.documentElement.dataset.tema) {
      prepararGraficos();
      redesenhar();
    }
  });
}

/**
 * Põe um botão "ver tabela" no cartão e devolve o elemento onde a tabela vai.
 * Todo gráfico deve poder ser lido como números — e para a série de cor mais
 * clara essa tabela é o que garante a leitura de quem não distingue o tom.
 */
export function comTabela(idCartao, montarTabela) {
  const cartao = document.getElementById(idCartao);
  if (!cartao) return;

  const botao = cartao.querySelector('button.ver-tabela');
  const alvo = cartao.querySelector('.tabela-apoio');
  if (!botao || !alvo) return;

  botao.onclick = () => {
    const mostrando = !alvo.hidden;
    alvo.hidden = mostrando;
    botao.textContent = mostrando ? 'Ver tabela' : 'Ocultar tabela';
    if (!mostrando) montarTabela(alvo);
  };

  // se já estava aberta, redesenha com os dados novos
  if (!alvo.hidden) montarTabela(alvo);
}

/** Monta uma tabela simples a partir de cabeçalhos e linhas. */
export function tabela(alvo, cabecalhos, linhas) {
  alvo.innerHTML = `<table><thead><tr>${cabecalhos
    .map((c, i) => `<th${i ? ' class="num"' : ''}>${c}</th>`)
    .join('')}</tr></thead><tbody>${linhas
    .map((l) => `<tr>${l
      .map((v, i) => `<td${i ? ' class="num"' : ''}>${v}</td>`)
      .join('')}</tr>`)
    .join('')}</tbody></table>`;
}

/** Lê os filtros da barra. `desde` vira uma data ISO; vazio = tudo. */
export function lerFiltros() {
  const periodo = document.querySelector('#f-periodo')?.value || 'tudo';
  const conceito = document.querySelector('#f-conceito')?.value || '';

  let desde = null;
  if (periodo !== 'tudo') {
    const d = new Date();
    d.setDate(d.getDate() - Number(periodo));
    desde = d.toISOString().slice(0, 10);
  }
  return { desde, conceito: conceito || null };
}

/** Monta a query string só com os filtros preenchidos. */
export function query(filtros) {
  const p = new URLSearchParams();
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor) p.set(chave, valor);
  }
  const texto = p.toString();
  return texto ? `?${texto}` : '';
}

export function mostrarErro(mensagem) {
  const alvo = document.querySelector('#procedencia');
  if (!alvo) return;
  alvo.className = 'aviso erro';
  alvo.textContent = mensagem;
}
