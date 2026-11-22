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
  const topo = document.querySelector('header.faixa') || document.querySelector('header.topo');
  if (!topo || !atual) return;

  // O professor não joga (Glossário), então para ele a tela do jogador é uma
  // consulta a um jogador escolhido, não "o meu progresso".
  const abas = atual.perfil === 'professor'
    ? [['professor.html', 'Turma'], ['jogador.html', 'Por jogador']]
    : [['jogador.html', 'Meu progresso']];

  // O titulo fica no meio da faixa, como nas referencias de painel: quem
  // olha de longe le primeiro o nome do painel, nao o menu.
  const titulo = topo.dataset.titulo || 'while under_attack';

  topo.innerHTML = `
    <img src="assets/logo.png" alt="while under_attack" class="marca">
    <nav>${abas.map(([href, texto]) =>
      `<a href="${href}"${href === paginaAtual ? ' aria-current="page"' : ''}>${texto}</a>`
    ).join('')}</nav>
    <h1>${titulo}</h1>
    <span class="quem">${atual.nome_exibicao}</span>
    <button class="discreto" id="btn-tema">Tema</button>
    <button class="discreto" id="btn-sair">Sair</button>
    <img src="assets/${atual.perfil === 'professor' ? 'inimigo' : 'heroi'}.png"
         class="figura" alt="" aria-hidden="true">`;

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
  // O painel e escuro por padrao, e nao o que o sistema preferir: foi assim
  // que ele foi desenhado, e e nele que os numeros grandes e as cores de
  // bloco funcionam. O claro continua no botao Tema, para quem precisar
  // imprimir ou projetar numa sala clara demais.
  return true;
}

/** RS-02: o dashboard diz na cara quando está mostrando dado sintético. */
/* Os limiares do que e bom, do que pede atencao e do que e critico vem da
   API, e nao de constantes aqui: sao os mesmos que os destaques usam. Se a
   tela tivesse os seus, um KPI poderia pintar de verde uma fase que o alerta
   logo abaixo chama de problema. Os valores abaixo so valem ate a primeira
   resposta chegar. */
export const limiares = { eficiencia: 0.7, conceito: 0.7, funil: 0.3 };

export async function mostrarProcedencia() {
  const alvo = document.querySelector('#procedencia');
  if (!alvo) return;

  try {
    const p = await api('/procedencia');
    if (p.limiares) Object.assign(limiares, p.limiares);
    if (p.tem_sintetico) {
      const quanto = p.so_sintetico
        ? 'Todas as tentativas desta tela são sintéticas'
        : `${p.eventos_sinteticos} de ${p.eventos} tentativas são sintéticas`;
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

/**
 * Duracao em segundos, na unidade que couber: "26 s", "3 min", "1 h 20 min".
 *
 * Existe porque o card "Montando programas" mostrava "0 min" para quem tinha
 * acabado de jogar. O dado estava certo -- 26 segundos --, mas em minutos e
 * sem casa decimal isso vira zero. Com o tempo limite da fase em 15 s, a
 * maior parte dos jogadores nunca vai somar um minuto inteiro, entao minuto
 * era a unidade errada para este jogo.
 *
 * Devolve "—" para nulo, e nao "0 s": nao ter jogado e diferente de ter
 * jogado sem gastar tempo.
 */
export function duracao(segundos) {
  if (segundos === null || segundos === undefined) return '—';
  const s = Math.round(Number(segundos));
  if (!Number.isFinite(s)) return '—';
  if (s < 90) return `${s} s`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}

/* ---------------------------------------------------------------------------
   KPI: o disco com o icone, o numero grande e a linha de apoio.

   O formato veio das referencias de painel que a equipe escolheu. O que muda
   em relacao a elas: la a linha de apoio compara com o periodo anterior
   ("vs Prior Period $2.06M"), e aqui nao ha periodo anterior para comparar --
   o banco tem semanas de dado, nao anos. Entao a linha diz do que o numero e
   parte: "de 60 possiveis", "toda a turma". E contexto em vez de variacao, e
   e honesto: inventar uma variacao exigiria um recorte temporal que o dado
   ainda nao sustenta.
   --------------------------------------------------------------------------- */

const ICONES = {
  pessoas:  '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 6a3 3 0 0 1 0 6"/>',
  bandeira: '<path d="M5 21V4m0 0h12l-2.5 4 2.5 4H5"/>',
  espada:   '<path d="M14.5 3.5 20 3l-.5 5.5-9 9L7 20l-3-3 2.5-3.5z"/><path d="m6 18 1.5 1.5"/>',
  escudo:   '<path d="M12 3 5 6v5c0 4 3 7.5 7 9 4-1.5 7-5 7-9V6z"/>',
  raio:     '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  ampulheta:'<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9"/>',
  alvo:     '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',
};

const TONS = {
  acento:      'var(--acento)',
  evento:      'var(--bloco-evento)',
  acao:        'var(--bloco-acao)',
  repeticao:   'var(--bloco-repeticao)',
  condicional: 'var(--bloco-condicional)',
  bom:         'var(--bom)',
  atencao:     'var(--atencao)',
  critico:     'var(--critico)',
};

/**
 * @param {object} k
 * @param {string} k.rotulo   o nome, em caixa alta na tela
 * @param {string} k.valor    ja formatado
 * @param {string} [k.apoio]  a linha de baixo: de que o numero e parte
 * @param {string} [k.icone]  chave de ICONES
 * @param {string} [k.tom]    chave de TONS; pinta o numero e o disco
 */
export function kpi(k) {
  const tom = TONS[k.tom] || 'var(--acento)';
  const corpo = ICONES[k.icone] || ICONES.alvo;

  return `<div class="kpi" style="--tom:${tom}">
      <span class="disco">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${corpo}</svg>
      </span>
      <span class="corpo">
        <span class="rotulo">${k.rotulo}</span>
        <span class="valor">${k.valor}</span>
        ${k.apoio ? `<span class="apoio">${k.apoio}</span>` : ''}
      </span>
    </div>`;
}

/**
 * Liga as paginas do painel. Trocar de pagina nao redesenha nada, mas o
 * Chart.js mede o canvas na hora de desenhar e canvas dentro de `hidden` mede
 * zero -- sem o resize() ao mostrar, o grafico da pagina escondida nasce com
 * o tamanho errado e so se corrige quando alguem redimensiona a janela.
 */
export function ligarAbas() {
  const barra = document.querySelector('#abas');
  if (!barra) return;

  barra.addEventListener('click', (evento) => {
    const botao = evento.target.closest('.aba');
    if (!botao) return;

    const alvo = botao.dataset.painel;
    barra.querySelectorAll('.aba').forEach((b) =>
      b.setAttribute('aria-selected', String(b.dataset.painel === alvo)));
    document.querySelectorAll('.aba-painel').forEach((p) => {
      p.hidden = p.dataset.painel !== alvo;
    });
    graficos.forEach((g) => g.resize());
  });
}

/* Avisa que esta carregando.
 *
 * Nao e enfeite: a primeira pintura depende de seis a nove consultas ao
 * banco, e o banco e remoto. Sem aviso, esse tempo e indistinguivel de uma
 * tela quebrada -- foi exatamente assim que a equipe leu o atraso ("entro e
 * nao acontece nada"). Com a barra, lento continua lento, mas deixa de
 * parecer defeito. */
export function carregando(ligado) {
  document.body.classList.toggle('carregando', ligado);
}

export function formatarData(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/**
 * Rótulos dos blocos, vindos do catálogo (ADR-006).
 *
 * Aqui havia um mapa escrito à mão com `andar`, `atacar`, `repetir` e
 * `enquanto` — nomes que nunca existiram no jogo. Era uma segunda lista
 * correndo em paralelo ao catálogo, e das duas a errada era esta. Agora o
 * dashboard pergunta: um lugar só define como cada bloco se chama.
 */
const rotulosDeBloco = new Map();

export async function carregarRotulosDeBloco() {
  try {
    const cat = await api('/catalogo');
    for (const b of cat.blocos) rotulosDeBloco.set(b.tipo, b.rotulo);
  } catch {
    /* sem os rótulos a tela ainda serve: cai no identificador técnico */
  }
}

export function nomeDeBloco(tipo) {
  if (!tipo) return '—';
  return rotulosDeBloco.get(tipo) || tipo;
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
