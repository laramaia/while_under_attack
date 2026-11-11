// Visão do jogador (objetivo O3 do Documento de Visão).
// Nenhum indicador é calculado aqui: tudo vem pronto da camada gold.

import {
  api, exigirSessao, montarTopo, mostrarProcedencia, mostrarErro,
  aplicarTemaSalvo, prepararGraficos, aoTrocarTema, desenhar,
  eixos, BARRA, BARRA_H, EMPILHADA, cor, num, vazio, formatarData,
  nomeDeBloco, CAUSAS, semDados, comTabela, tabela,
} from './app.js';

aplicarTemaSalvo();
const atual = exigirSessao();
montarTopo('jogador.html');

let dados = null;
// De quem é a tela. Para o jogador é sempre ele mesmo (RN-004); o professor
// escolhe, e é a API que autoriza (RN-005).
let alvoId = atual.jogador_id;

// Linha tracejada na referência da eficiência (1,0). Direta no Chart.js para
// não depender do plugin de anotações.
const linhaReferencia = {
  id: 'linhaReferencia',
  afterDatasetsDraw(gr, _args, opcoes) {
    if (!opcoes?.valor) return;
    const { ctx, chartArea, scales } = gr;
    const y = scales.y.getPixelForValue(opcoes.valor);
    if (y < chartArea.top || y > chartArea.bottom) return;

    ctx.save();
    ctx.strokeStyle = cor('--eixo');
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(chartArea.left, y);
    ctx.lineTo(chartArea.right, y);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.fillStyle = cor('--tinta-fraca');
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(opcoes.rotulo || '', chartArea.right, y - 5);
    ctx.restore();
  },
};
Chart.register(linhaReferencia);

/** Seletor de jogador, só para o perfil professor. */
async function montarEscolha() {
  if (atual.perfil !== 'professor') return;

  const jogadores = await api('/professor/jogadores');
  if (!jogadores.length) return;

  alvoId = jogadores[0].jogador_id;

  const campo = document.querySelector('#escolha-jogador');
  campo.hidden = false;
  campo.innerHTML =
    '<label for="sel-jogador" style="font-size:13px;color:var(--tinta-fraca)">Jogador: </label>' +
    `<select class="discreto" id="sel-jogador">${jogadores.map((j) =>
      `<option value="${j.jogador_id}">${j.nome_exibicao}</option>`).join('')}</select>`;

  campo.querySelector('#sel-jogador').addEventListener('change', async (evento) => {
    alvoId = Number(evento.target.value);
    await carregar();
    numeros();
    desenharTudo();
    tabelaFases();
    tabelaConceitos();
  });
}

async function carregar() {
  const id = alvoId;
  const [resumo, progresso, travou, conceitos] = await Promise.all([
    api(`/jogador/${id}/resumo`),
    api(`/jogador/${id}/progresso`),
    api(`/jogador/${id}/onde-travou`),
    api(`/jogador/${id}/conceitos`),
  ]);
  dados = { resumo, progresso, travou, conceitos };
}

function numeros() {
  const r = dados.resumo;
  const itens = [
    [`${num(r.fases_concluidas)} de ${num(r.fases_no_catalogo)}`, 'Fases concluídas'],
    [num(r.media_tentativas_ate_vencer, 1), 'Tentativas até vencer, em média'],
    [num(r.eficiencia_media, 2), 'Eficiência do código'],
    [num(r.total_tentativas), 'Tentativas no total'],
    [num(r.minutos_montando, 0) + ' min', 'Montando programas'],
  ];
  document.querySelector('#numeros').innerHTML = itens.map(([valor, rotulo]) =>
    `<div class="numero"><span class="valor">${valor}</span>
     <span class="rotulo">${rotulo}</span></div>`).join('');
}

function graficoTentativas() {
  const fases = dados.progresso.filter((f) => f.concluida);

  if (semDados('g-tentativas', fases.length ? null
      : 'Nenhuma fase concluída ainda. Vença uma fase para ver este gráfico.')) return;

  desenhar('g-tentativas', {
    type: 'bar',
    data: {
      labels: fases.map((f) => `${f.fase_id} · ${f.titulo}`),
      datasets: [
        {
          label: 'Você',
          data: fases.map((f) => f.tentativas_ate_vencer),
          backgroundColor: cor('--serie-1'),
          ...BARRA,
        },
        {
          // agregado da turma, não o dado de ninguém em particular
          label: 'Mediana da turma',
          data: fases.map((f) => (f.mediana_turma === null ? null : Number(f.mediana_turma))),
          backgroundColor: cor('--rampa-1'),
          ...BARRA,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: true, position: 'bottom' },
        tooltip: {
          callbacks: {
            afterBody: (ctx) => {
              const f = fases[ctx[0].dataIndex];
              const partes = [`Conceito: ${f.conceito}`];
              if (f.interrompidas_ate_vencer)
                partes.push(`${f.interrompidas_ate_vencer} interrompidas (não contam)`);
              partes.push(`${f.total_tentativas} tentativas no total`);
              return partes;
            },
          },
        },
      },
      interaction: { mode: 'index', intersect: false },
      scales: eixos({ tituloValor: 'tentativas' }),
    },
  });

  comTabela('c-tentativas', (alvo) => tabela(
    alvo,
    ['Fase', 'Você', 'Mediana da turma', 'Interrompidas', 'Eficiência'],
    fases.map((f) => [
      `${f.fase_id} · ${f.titulo}`,
      f.tentativas_ate_vencer,
      vazio(f.mediana_turma),
      f.interrompidas_ate_vencer ?? 0,
      f.eficiencia_codigo === null ? '—' : num(f.eficiencia_codigo, 2),
    ]),
  ));
}

/** Conceito por conceito: o programa vencedor usou o bloco que a fase ensina? */
function conceitosAplicados() {
  const fases = dados.progresso.filter((f) => f.bloco_conceito && f.concluida);
  const alvo = document.querySelector('#conceitos-aplicados');

  if (!fases.length) {
    alvo.innerHTML = '<p class="vazio">Aparece depois que você vencer uma fase '
                   + 'cujo conceito tenha um bloco.</p>';
    return;
  }

  // a cor nunca decide sozinha: vem com ícone e com a frase ao lado
  alvo.innerHTML = '<div class="destaques">' + fases.map((f) => {
    const usou = f.aplicou_conceito;
    return `<div class="destaque ${usou ? 'info' : 'atencao'}">
      <span class="icone" aria-hidden="true">${usou ? '✓' : '●'}</span>
      <span class="corpo">
        <strong>${f.fase_id}${f.papel === 'reforco' ? ' · reforço' : ''} · ${nomeDeBloco(f.bloco_conceito)}</strong>
        <span>${usou
          ? `Você venceu “${f.titulo}” usando o bloco. ${f.conceito} aplicado.`
          : `Você venceu “${f.titulo}” sem usar o bloco. Vale voltar e tentar `
            + `resolver com ${nomeDeBloco(f.bloco_conceito).toLowerCase()}.`}</span>
      </span>
      <span class="nivel">${usou ? 'Aplicado' : 'Contornado'}</span>
    </div>`;
  }).join('') + '</div>';
}

function graficoEficiencia() {
  const fases = dados.progresso.filter((f) => f.eficiencia_codigo !== null);

  if (semDados('g-eficiencia', fases.length ? null
      : 'A eficiência aparece depois da primeira vitória numa fase.')) return;

  const maior = Math.max(1, ...fases.map((f) => Number(f.eficiencia_codigo)));

  desenhar('g-eficiencia', {
    type: 'bar',
    data: {
      labels: fases.map((f) => f.fase_id),
      datasets: [{
        label: 'Eficiência',
        data: fases.map((f) => Number(f.eficiencia_codigo)),
        backgroundColor: cor('--serie-1'),
        ...BARRA,
      }],
    },
    options: {
      plugins: {
        legend: { display: false },
        linhaReferencia: { valor: 1, rotulo: 'referência' },
        tooltip: {
          callbacks: {
            label: (ctx) => `Eficiência ${num(ctx.raw, 2)}`,
            afterBody: (ctx) => {
              const f = fases[ctx[0].dataIndex];
              return [`${f.qtd_blocos_primeira_vitoria} blocos no seu programa`,
                      `${f.tamanho_referencia} blocos na referência`];
            },
          },
        },
      },
      scales: {
        ...eixos({ inteiro: false }),
        y: { ...eixos({ inteiro: false }).y, max: Math.ceil(maior * 10) / 10 },
      },
    },
  });
}

function graficoTravou() {
  if (semDados('g-travou', dados.travou.length ? null
      : 'Nenhuma derrota registrada.')) return;

  // uma linha por bloco, duas séries pela causa da derrota (RN-008)
  const blocos = [...new Set(dados.travou.map((d) => d.bloco))];
  const porCausa = (causa) => blocos.map((bloco) =>
    dados.travou.find((d) => d.bloco === bloco && d.causa_derrota === causa)?.derrotas || 0);

  desenhar('g-travou', {
    type: 'bar',
    data: {
      labels: blocos.map((b) => (b.startsWith('(') ? b : nomeDeBloco(b))),
      datasets: [
        {
          label: CAUSAS.parou_em_bloco,
          data: porCausa('parou_em_bloco'),
          backgroundColor: cor('--serie-1'),
          ...EMPILHADA, ...BARRA_H,
        },
        {
          label: CAUSAS.programa_curto,
          data: porCausa('programa_curto'),
          backgroundColor: cor('--serie-2'),
          ...EMPILHADA, ...BARRA_H,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: true, position: 'bottom' } },
      scales: {
        x: { ...eixos({ valorEm: 'x' }).x, stacked: true, title:
             { display: true, text: 'derrotas', color: cor('--tinta-fraca') } },
        y: { ...eixos({ valorEm: 'x' }).y, stacked: true },
      },
    },
  });
}

function tabelaFases() {
  const linhas = dados.progresso.map((f) => {
    const marca = f.concluida
      ? '<span class="marca ok">concluída</span>'
      : f.total_tentativas
        ? '<span class="marca pendente">em andamento</span>'
        : '<span class="marca fora">não jogada</span>';

    return `<tr>
      <td>${f.fase_id}</td>
      <td>${f.titulo}</td>
      <td>${f.conceito}</td>
      <td>${marca}</td>
      <td class="num">${vazio(f.tentativas_ate_vencer)}</td>
      <td class="num">${vazio(f.interrompidas_ate_vencer)}</td>
      <td class="num">${f.eficiencia_codigo === null ? '—' : num(f.eficiencia_codigo, 2)}</td>
      <td class="num">${f.aplicou_conceito === null ? '—'
        : f.aplicou_conceito ? 'sim' : 'não'}</td>
      <td class="num">${vazio(f.total_tentativas)}</td>
      <td class="num">${formatarData(f.ultima_tentativa_em)}</td>
    </tr>`;
  }).join('');

  document.querySelector('#t-fases').innerHTML = `
    <thead><tr>
      <th>Fase</th><th>Título</th><th>Conceito</th><th>Situação</th>
      <th class="num">Até vencer</th><th class="num">Interrompidas</th>
      <th class="num">Eficiência</th><th class="num">Usou o bloco</th>
      <th class="num">Tentativas</th><th class="num">Última</th>
    </tr></thead><tbody>${linhas}</tbody>`;
}

function tabelaConceitos() {
  const linhas = dados.conceitos.map((c) => `<tr>
      <td class="num">${c.ordem}</td>
      <td>${c.nome}</td>
      <td class="num">${c.fases_concluidas} de ${c.fases}</td>
      <td class="num">${vazio(c.media_tentativas)}</td>
      <td class="num">${c.eficiencia_media === null ? '—' : num(c.eficiencia_media, 2)}</td>
    </tr>`).join('');

  document.querySelector('#t-conceitos').innerHTML = `
    <thead><tr>
      <th class="num">#</th><th>Conceito</th><th class="num">Fases concluídas</th>
      <th class="num">Tentativas, em média</th><th class="num">Eficiência</th>
    </tr></thead><tbody>${linhas}</tbody>`;
}

function desenharTudo() {
  graficoTentativas();
  conceitosAplicados();
  graficoEficiencia();
  graficoTravou();
}

try {
  await montarEscolha();
  await carregar();
  prepararGraficos();
  numeros();
  desenharTudo();
  tabelaFases();
  tabelaConceitos();
  aoTrocarTema(desenharTudo);
  mostrarProcedencia();
} catch (erro) {
  mostrarErro(`Não foi possível carregar os dados: ${erro.message}`);
}
