// Visão do professor (objetivo O4 do Documento de Visão).
// Só o perfil professor chega aqui: a API recusa qualquer outro (RN-005).

import {
  api, exigirSessao, montarTopo, mostrarProcedencia, mostrarErro,
  aplicarTemaSalvo, prepararGraficos, aoTrocarTema, desenhar, semDados,
  eixos, BARRA, EMPILHADA, cor, num, vazio, formatarData, nomeDeBloco,
  temaEscuro, comTabela, tabela, lerFiltros, query,
} from './app.js';

aplicarTemaSalvo();
exigirSessao('professor');
montarTopo('professor.html');

// O que não depende de filtro é buscado uma vez.
let base = null;
// O que depende de filtro é rebuscado a cada mudança.
let recorte = null;

async function carregarBase() {
  const [resumo, funil, jogadores, heatmap, blocos, destaques, conceitos] =
    await Promise.all([
      api('/professor/resumo'),
      api('/professor/funil'),
      api('/professor/jogadores'),
      api('/professor/heatmap'),
      api('/professor/blocos-problematicos'),
      api('/professor/destaques'),
      api('/conceitos'),
    ]);
  base = { resumo, funil, jogadores, heatmap, blocos, destaques, conceitos };
}

async function carregarRecorte() {
  const filtros = lerFiltros();
  const [atividade, aprendizado] = await Promise.all([
    api(`/professor/atividade${query(filtros)}`),
    api(`/professor/vitoria-por-tentativa${query({ conceito: filtros.conceito })}`),
  ]);
  recorte = { atividade, aprendizado };
}

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

function montarFiltros() {
  const sel = document.querySelector('#f-conceito');
  sel.innerHTML = '<option value="">Todos</option>' + base.conceitos
    .map((c) => `<option value="${c.conceito_id}">${c.nome}</option>`).join('');

  for (const id of ['#f-periodo', '#f-conceito']) {
    document.querySelector(id).addEventListener('change', async () => {
      await carregarRecorte();
      graficoAtividade();
      graficoAprendizado();
    });
  }
}

// ---------------------------------------------------------------------------
// Números e destaques
// ---------------------------------------------------------------------------

function numeros() {
  const r = base.resumo;
  const travados = base.funil.reduce((s, f) => s + (f.travados || 0), 0);
  const itens = [
    [num(r.jogadores), 'Jogadores'],
    [num(r.tentativas), 'Tentativas registradas'],
    [num(r.sessoes), 'Sessões'],
    [num(r.fases_concluidas), 'Fases concluídas'],
    [num(travados), 'Jogadores travados numa fase'],
    [num(r.eficiencia_media, 2), 'Eficiência média do código'],
  ];
  document.querySelector('#numeros').innerHTML = itens.map(([valor, rotulo]) =>
    `<div class="numero"><span class="valor">${valor}</span>
     <span class="rotulo">${rotulo}</span></div>`).join('');
}

const ICONE = { critico: '▲', atencao: '●', info: 'i' };
const NOME_NIVEL = { critico: 'Crítico', atencao: 'Atenção', info: 'Nota' };

function destaques() {
  const alvo = document.querySelector('#destaques');

  if (!base.destaques.length) {
    alvo.innerHTML = '<p class="vazio">Nenhum ponto de atenção nos dados atuais.</p>';
    return;
  }

  // o nível vem com ícone e rótulo: a cor nunca carrega o sentido sozinha
  alvo.innerHTML = base.destaques.map((d) => `
    <div class="destaque ${d.nivel}">
      <span class="icone" aria-hidden="true">${ICONE[d.nivel]}</span>
      <span class="corpo"><strong>${d.titulo}</strong><span>${d.texto}</span></span>
      <span class="nivel">${NOME_NIVEL[d.nivel]}</span>
    </div>`).join('');
}

// ---------------------------------------------------------------------------
// Gráficos
// ---------------------------------------------------------------------------

function graficoFunil() {
  const f = base.funil;

  desenhar('g-funil', {
    type: 'bar',
    data: {
      labels: f.map((x) => `${x.fase_id} · ${x.titulo}`),
      datasets: [
        {
          label: 'Concluíram',
          data: f.map((x) => x.jogadores_que_concluiram),
          backgroundColor: cor('--serie-1'),
          ...EMPILHADA,
        },
        {
          label: 'Chegaram e travaram',
          data: f.map((x) => x.travados || null),
          backgroundColor: cor('--serie-2'),
          ...EMPILHADA,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: true, position: 'bottom' },
        tooltip: {
          callbacks: {
            afterBody: (ctx) => {
              const x = f[ctx[0].dataIndex];
              return [`${x.jogadores_que_chegaram} chegaram à fase`,
                      `Conceito: ${x.conceito_nome}`];
            },
          },
        },
      },
      scales: {
        ...eixos({ tituloValor: 'jogadores' }),
        x: { ...eixos().x, stacked: true },
        y: { ...eixos({ tituloValor: 'jogadores' }).y, stacked: true },
      },
    },
  });
}

function graficoAtividade() {
  const a = recorte.atividade;

  if (semDados('g-atividade', a.length ? null
      : 'Nenhuma tentativa no período escolhido.')) {
    comTabela('c-atividade', (alvo) => tabela(alvo, ['Dia'], []));
    return;
  }

  const rotulos = a.map((d) => formatarData(d.data));
  const series = [
    ['Vitórias', 'vitorias', '--serie-1'],
    ['Derrotas', 'derrotas', '--serie-2'],
    ['Interrompidas', 'interrompidas', '--serie-3'],
  ];

  desenhar('g-atividade', {
    type: 'bar',
    data: {
      labels: rotulos,
      datasets: series.map(([rotulo, chave, token]) => ({
        label: rotulo,
        // zero vira null: a barra empilhada tem borda de 2px e um valor zero
        // desenharia só a borda, uma listra fina que parece dado
        data: a.map((d) => d[chave] || null),
        backgroundColor: cor(token),
        ...EMPILHADA,
      })),
    },
    options: {
      plugins: {
        legend: { display: true, position: 'bottom' },
        tooltip: {
          callbacks: {
            afterBody: (ctx) => [`${a[ctx[0].dataIndex].jogadores_ativos} jogadores ativos`],
          },
        },
      },
      scales: {
        ...eixos({ tituloValor: 'tentativas' }),
        x: { ...eixos().x, stacked: true },
        y: { ...eixos({ tituloValor: 'tentativas' }).y, stacked: true },
      },
    },
  });

  comTabela('c-atividade', (alvo) => tabela(
    alvo,
    ['Dia', 'Vitórias', 'Derrotas', 'Interrompidas', 'Jogadores ativos'],
    a.map((d) => [formatarData(d.data), d.vitorias, d.derrotas,
                  d.interrompidas, d.jogadores_ativos]),
  ));
}

function graficoDificuldade() {
  const f = base.funil.filter((x) => x.mediana_tentativas_ate_vencer !== null);
  if (semDados('g-dificuldade', f.length ? null : 'Nenhuma fase concluída ainda.')) return;

  desenhar('g-dificuldade', {
    type: 'bar',
    data: {
      labels: f.map((x) => x.fase_id),
      datasets: [{
        label: 'Mediana de tentativas',
        data: f.map((x) => Number(x.mediana_tentativas_ate_vencer)),
        backgroundColor: cor('--serie-1'),
        ...BARRA,
      }],
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            afterBody: (ctx) => {
              const x = f[ctx[0].dataIndex];
              return [
                x.titulo,
                `Eficiência média ${vazio(x.eficiencia_media)}`,
                `${x.derrotas_programa_curto} derrotas por programa curto`,
                `${x.derrotas_parou_em_bloco} derrotas paradas num bloco`,
              ];
            },
          },
        },
      },
      scales: eixos({ tituloValor: 'tentativas (mediana)', inteiro: false }),
    },
  });
}

function graficoAprendizado() {
  const a = recorte.aprendizado;
  if (semDados('g-aprendizado', a.length ? null : 'Sem tentativas no recorte.')) return;

  desenhar('g-aprendizado', {
    type: 'line',
    data: {
      labels: a.map((d) => `${d.numero_tentativa}ª`),
      datasets: [{
        label: 'Taxa de vitória',
        data: a.map((d) => Number(d.taxa_vitoria)),
        borderColor: cor('--serie-1'),
        backgroundColor: cor('--serie-1'),
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.25,
      }],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${num(ctx.raw, 1)}% venceram`,
            afterBody: (ctx) => {
              const d = a[ctx[0].dataIndex];
              return [`${d.vitorias} de ${d.tentativas} tentativas`];
            },
          },
        },
      },
      scales: {
        ...eixos({ tituloValor: '% de vitórias', inteiro: false }),
        y: { ...eixos({ tituloValor: '% de vitórias', inteiro: false }).y, max: 100 },
      },
    },
  });
}

function graficoConceito() {
  // só as fases cujo conceito tem um bloco e que já têm vitórias para avaliar
  const f = base.funil.filter((x) => x.bloco_conceito && x.com_conceito_avaliavel > 0);
  if (semDados('g-conceito', f.length ? null
      : 'Ainda não há vitórias em fases cujo conceito tenha um bloco.')) return;

  desenhar('g-conceito', {
    type: 'bar',
    data: {
      // a fase de reforço fica marcada: o leitor precisa saber que ela não
      // ensina o bloco, cobra de novo
      labels: f.map((x) => `${x.fase_id}${x.papel === 'reforco' ? ' (reforço)' : ''}`
                           + ` · ${nomeDeBloco(x.bloco_conceito)}`),
      datasets: [
        {
          label: 'Usaram o bloco',
          data: f.map((x) => x.aplicaram_conceito),
          backgroundColor: cor('--serie-1'),
          ...EMPILHADA,
        },
        {
          label: 'Contornaram',
          data: f.map((x) => (x.com_conceito_avaliavel - x.aplicaram_conceito) || null),
          backgroundColor: cor('--serie-2'),
          ...EMPILHADA,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: true, position: 'bottom' },
        tooltip: {
          callbacks: {
            afterBody: (ctx) => {
              const x = f[ctx[0].dataIndex];
              const pct = Math.round(100 * x.aplicaram_conceito / x.com_conceito_avaliavel);
              return [`${pct}% aplicaram ${x.conceito_nome.toLowerCase()}`];
            },
          },
        },
      },
      scales: {
        ...eixos({ tituloValor: 'jogadores que venceram' }),
        x: { ...eixos().x, stacked: true },
        y: { ...eixos({ tituloValor: 'jogadores que venceram' }).y, stacked: true },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Heatmap
// ---------------------------------------------------------------------------

const RAMPA = ['--rampa-1', '--rampa-2', '--rampa-3', '--rampa-4', '--rampa-5'];
const FAIXAS = [1, 2, 3, 5]; // limites superiores das 4 primeiras faixas

function passoDaRampa(tentativas) {
  const indice = FAIXAS.findIndex((limite) => tentativas <= limite);
  return indice === -1 ? RAMPA.length - 1 : indice;
}

/* No tema claro a rampa escurece com o valor; no escuro ela clareia. A tinta
   da celula segue o passo em cada tema, senao os extremos ficam ilegiveis. */
function tintaDoPasso(passo) {
  return (temaEscuro() ? passo <= 1 : passo >= 2) ? 'tinta-clara' : 'tinta-escura';
}

function heatmap() {
  const fases = [...new Map(base.heatmap.map((c) => [c.fase_id, c.ordem]))]
    .sort((a, b) => a[1] - b[1]).map(([id]) => id);
  const nomes = [...new Set(base.heatmap.map((c) => c.nome_exibicao))];

  const corpo = nomes.map((nome) => {
    const celulas = fases.map((fase) => {
      const c = base.heatmap.find((x) => x.nome_exibicao === nome && x.fase_id === fase);

      if (!c || c.tentativas_ate_vencer === null) {
        const chegou = c && c.total_tentativas;
        // célula sem conclusão: tom neutro, nunca um passo da rampa
        return `<td class="celula"><span style="background:var(--rampa-0)"
                 title="${nome} · ${fase}: ${chegou ? `${c.total_tentativas} tentativas, sem vencer` : 'não chegou'}"
                 >${chegou ? '·' : ''}</span></td>`;
      }

      const passo = passoDaRampa(c.tentativas_ate_vencer);
      return `<td class="celula"><span class="${tintaDoPasso(passo)}"
               style="background:var(${RAMPA[passo]})"
               title="${nome} · ${fase}: ${c.tentativas_ate_vencer} tentativas até vencer, eficiência ${vazio(c.eficiencia_codigo)}"
               >${c.tentativas_ate_vencer}</span></td>`;
    }).join('');

    return `<tr><th class="nome">${nome}</th>${celulas}</tr>`;
  }).join('');

  document.querySelector('#heatmap').innerHTML = `<table>
    <thead><tr><th></th>${fases.map((f) => `<th class="num">${f}</th>`).join('')}</tr></thead>
    <tbody>${corpo}</tbody></table>`;

  // a rampa é ordenada, então a legenda também diz o que cada passo significa
  const rotulos = ['1', '2', '3', '4–5', '6+'];
  document.querySelector('#legenda-rampa').innerHTML =
    '<span>Tentativas até vencer:</span>' +
    RAMPA.map((v, i) => `<i style="background:var(${v})"></i><span>${rotulos[i]}</span>`).join('') +
    '<i style="background:var(--rampa-0)"></i><span>não concluída</span>';
}

// ---------------------------------------------------------------------------
// Tabelas
// ---------------------------------------------------------------------------

function tabelaJogadores() {
  const linhas = base.jogadores.map((j) => `<tr>
      <td>${j.nome_exibicao}</td>
      <td class="num">${j.fases_concluidas}</td>
      <td class="num">${vazio(j.fase_mais_longe)}</td>
      <td class="num">${j.tentativas}</td>
      <td class="num">${vazio(j.media_tentativas_ate_vencer)}</td>
      <td class="num">${j.eficiencia_media === null ? '—' : num(j.eficiencia_media, 2)}</td>
      <td class="num">${formatarData(j.ultima_atividade)}</td>
    </tr>`).join('');

  document.querySelector('#t-jogadores').innerHTML = `
    <thead><tr>
      <th>Jogador</th><th class="num">Fases concluídas</th><th class="num">Chegou até</th>
      <th class="num">Tentativas</th><th class="num">Média até vencer</th>
      <th class="num">Eficiência</th><th class="num">Última atividade</th>
    </tr></thead><tbody>${linhas}</tbody>`;
}

function tabelaBlocos() {
  const linhas = base.blocos.map((b) => `<tr>
      <td>${b.fase_id}</td>
      <td>${b.bloco.startsWith('(') ? b.bloco : nomeDeBloco(b.bloco)}</td>
      <td class="num">${b.derrotas}</td>
    </tr>`).join('');

  document.querySelector('#t-blocos').innerHTML = `
    <thead><tr><th>Fase</th><th>Bloco</th><th class="num">Derrotas</th></tr></thead>
    <tbody>${linhas}</tbody>`;
}

function desenharTudo() {
  graficoFunil();
  graficoAtividade();
  graficoDificuldade();
  graficoAprendizado();
  graficoConceito();
  heatmap();
}

try {
  await carregarBase();
  await carregarRecorte();
  prepararGraficos();
  montarFiltros();
  numeros();
  destaques();
  desenharTudo();
  tabelaJogadores();
  tabelaBlocos();
  aoTrocarTema(desenharTudo);
  mostrarProcedencia();
} catch (erro) {
  mostrarErro(`Não foi possível carregar os dados: ${erro.message}`);
}
