"""API do dashboard.

Serve os dados da camada gold e os arquivos estaticos do dashboard em
/dashboard, como decidido na ADR-002. Um servico so, um login so, uma regra
de permissao so.

    uvicorn wua_bi.api.main:app --reload

A ingestao de eventos (POST do jogo) NAO esta aqui: ela e do back-end, junto
com a autenticacao de verdade.
"""

from __future__ import annotations

from typing import Any

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .. import config, db
from ..catalogo import catalogo_padrao
from . import auth_provisoria as auth
from . import consultas

app = FastAPI(
    title="while under_attack - API analitica",
    version="0.2.0",
    description=(
        "API de LEITURA da camada gold (ADR-001). Os indicadores sao calculados "
        "no ETL e apenas lidos aqui.\n\n"
        "Na arquitetura de referencia corporativa esta e a caixa "
        "'API analitica (somente leitura)' da camada de consumo, e o controle "
        "de acesso por perfil que o diagrama chama de RLS/OLS e implementado "
        "aqui, uma vez so, pela RN-004 e pela RN-005.\n\n"
        "A ingestao de eventos (POST do jogo) NAO esta nesta API: ela e do "
        "back-end."
    ),
    openapi_tags=[
        {"name": "acesso", "description": "Login e identidade (ADR-004)."},
        {"name": "jogador", "description": "Diagnostico do proprio jogador (O3). RN-004."},
        {"name": "professor", "description": "Visao consolidada da turma (O4). RN-005."},
        {"name": "operacao",
         "description": "Procedencia, qualidade e execucoes do ETL. "
                        "Observabilidade da arquitetura de referencia."},
    ],
)


class PedidoLogin(BaseModel):
    usuario: str
    senha: str


@app.post("/api/login", tags=["acesso"])
def login(pedido: PedidoLogin) -> dict[str, Any]:
    usuario = auth.autenticar(pedido.usuario, pedido.senha)
    if usuario is None:
        # Mensagem unica de proposito: nao revela se o usuario existe.
        raise HTTPException(401, "usuario ou senha invalidos")

    return {
        "token": auth.emitir_token(usuario),
        "jogador_id": usuario.jogador_id,
        "nome_exibicao": usuario.nome_exibicao,
        "perfil": usuario.perfil,
    }


@app.get("/api/eu", tags=["acesso"])
def eu(usuario: auth.Usuario = Depends(auth.usuario_atual)) -> dict[str, Any]:
    return {
        "jogador_id": usuario.jogador_id,
        "nome_exibicao": usuario.nome_exibicao,
        "perfil": usuario.perfil,
    }


@app.get("/api/procedencia", tags=["operacao"])
def procedencia(usuario: auth.Usuario = Depends(auth.usuario_atual)) -> dict[str, Any]:
    """De onde vem o que o dashboard esta mostrando (RS-02).

    Alem da origem do dado, responde se a gold atual passou pelo gate de
    qualidade (`gold_certificada`) e se existe uma falha de ETL ainda nao
    superada (`falha_pendente`).
    """
    dados = consultas.procedencia()
    dados["catalogo_carregado"] = catalogo_padrao().catalog_version
    return dados


# ---------------------------------------------------------------------------
# Operacao: observabilidade e qualidade
#
# Arquitetura de referencia, faixa "Observabilidade" e losango do gate. Sao
# dados sobre o pipeline, nao sobre jogadores - por isso nao caem na RN-004.
# ---------------------------------------------------------------------------

@app.get("/api/saude", tags=["operacao"])
def saude() -> dict[str, Any]:
    """Liveness. Nao exige token e NAO devolve dado de ninguem, so se o
    servico esta de pe e se o banco responde.

    Existe por dois motivos praticos: o plano gratuito do Render hiberna e
    precisa de um caminho barato para ser acordado antes da apresentacao, e
    um alerta externo precisa de algo para consultar sem credencial.
    """
    try:
        db.consultar("select 1 as ok")
        return {"status": "ok", "banco": "ok"}
    except Exception:  # noqa: BLE001
        # Sem detalhe do erro: endpoint sem autenticacao nao conta como o
        # banco quebrou.
        raise HTTPException(503, "banco indisponivel")


@app.get("/api/qualidade", tags=["operacao"])
def qualidade(usuario: auth.Usuario = Depends(auth.usuario_atual)) -> dict[str, Any]:
    """Boletim do ultimo gate de qualidade (ADR-010).

    Uma linha por regra, com a porta em que ela roda e quantas divergencias
    encontrou. E este resultado que autorizou (ou barrou) a publicacao da
    gold que esta no ar.
    """
    auth.exigir_professor(usuario)
    return consultas.qualidade()


@app.get("/api/execucoes", tags=["operacao"])
def execucoes(limite: int = 20,
              usuario: auth.Usuario = Depends(auth.usuario_atual)) -> list[dict]:
    """Ultimas execucoes do ETL, com etapa, gatilho, duracao e erro (ADR-009)."""
    auth.exigir_professor(usuario)
    return consultas.execucoes(min(max(limite, 1), 200))


@app.get("/api/ingestao", tags=["operacao"])
def ingestao(usuario: auth.Usuario = Depends(auth.usuario_atual)) -> dict[str, Any]:
    """Contagens dos lotes de ingestao (ADR-007).

    Enquanto o endpoint de ingestao do back-end nao existe, quem escreve
    estes lotes e o gerador sintetico.
    """
    auth.exigir_professor(usuario)
    return consultas.ingestao()


# ---------------------------------------------------------------------------
# Jogador (O3). RN-004 vale em todos: o proprio jogador ou o professor.
# ---------------------------------------------------------------------------

def _sk(jogador_id: int, usuario: auth.Usuario) -> int:
    auth.exigir_acesso_a(jogador_id, usuario)
    jogador_sk = consultas.jogador_sk_de(jogador_id)
    if jogador_sk is None:
        raise HTTPException(404, "jogador sem dados na camada gold")
    return jogador_sk


@app.get("/api/jogador/{jogador_id}/resumo", tags=["jogador"])
def resumo_jogador(jogador_id: int,
                   usuario: auth.Usuario = Depends(auth.usuario_atual)) -> dict[str, Any]:
    return consultas.resumo_jogador(_sk(jogador_id, usuario))


@app.get("/api/jogador/{jogador_id}/progresso", tags=["jogador"])
def progresso_jogador(jogador_id: int,
                      usuario: auth.Usuario = Depends(auth.usuario_atual)) -> list[dict]:
    return db.consultar(consultas.PROGRESSO_JOGADOR, {"jogador_sk": _sk(jogador_id, usuario)})


@app.get("/api/jogador/{jogador_id}/linha-do-tempo", tags=["jogador"])
def linha_do_tempo(jogador_id: int,
                   usuario: auth.Usuario = Depends(auth.usuario_atual)) -> list[dict]:
    return db.consultar(consultas.LINHA_DO_TEMPO_JOGADOR,
                        {"jogador_sk": _sk(jogador_id, usuario)})


@app.get("/api/jogador/{jogador_id}/onde-travou", tags=["jogador"])
def onde_travou(jogador_id: int,
                usuario: auth.Usuario = Depends(auth.usuario_atual)) -> list[dict]:
    return db.consultar(consultas.ONDE_TRAVOU, {"jogador_sk": _sk(jogador_id, usuario)})


@app.get("/api/jogador/{jogador_id}/conceitos", tags=["jogador"])
def conceitos(jogador_id: int,
              usuario: auth.Usuario = Depends(auth.usuario_atual)) -> list[dict]:
    return db.consultar(consultas.CONCEITOS_JOGADOR, {"jogador_sk": _sk(jogador_id, usuario)})


# ---------------------------------------------------------------------------
# Professor (O4). RN-005 em todos.
# ---------------------------------------------------------------------------

@app.get("/api/professor/resumo", tags=["professor"])
def resumo_professor(usuario: auth.Usuario = Depends(auth.usuario_atual)) -> dict[str, Any]:
    auth.exigir_professor(usuario)
    return consultas._um(consultas.RESUMO_PROFESSOR)


@app.get("/api/professor/funil", tags=["professor"])
def funil(usuario: auth.Usuario = Depends(auth.usuario_atual)) -> list[dict]:
    auth.exigir_professor(usuario)
    return db.consultar(consultas.FUNIL_FASES)


@app.get("/api/professor/jogadores", tags=["professor"])
def jogadores(usuario: auth.Usuario = Depends(auth.usuario_atual)) -> list[dict]:
    auth.exigir_professor(usuario)
    return db.consultar(consultas.JOGADORES_PROFESSOR)


@app.get("/api/professor/heatmap", tags=["professor"])
def heatmap(usuario: auth.Usuario = Depends(auth.usuario_atual)) -> list[dict]:
    auth.exigir_professor(usuario)
    return db.consultar(consultas.HEATMAP_PROFESSOR)


@app.get("/api/professor/blocos-problematicos", tags=["professor"])
def blocos_problematicos(usuario: auth.Usuario = Depends(auth.usuario_atual)) -> list[dict]:
    auth.exigir_professor(usuario)
    return db.consultar(consultas.BLOCOS_PROBLEMATICOS)


@app.get("/api/professor/destaques", tags=["professor"])
def destaques(usuario: auth.Usuario = Depends(auth.usuario_atual)) -> list[dict]:
    """Os achados que valem uma olhada, lidos dos indicadores da gold."""
    auth.exigir_professor(usuario)
    return consultas.destaques()


# Os filtros valem para as consultas por tentativa. Os indicadores de
# aprendizagem (tentativas ate vencer, eficiencia) sao por definicao "ate a
# primeira vitoria" e nao se recortam por periodo, entao o funil, o heatmap e
# a tabela de jogadores ignoram os filtros de proposito.
@app.get("/api/professor/atividade", tags=["professor"])
def atividade(
    desde: str | None = None,
    conceito: str | None = None,
    usuario: auth.Usuario = Depends(auth.usuario_atual),
) -> list[dict]:
    auth.exigir_professor(usuario)
    return db.consultar(consultas.ATIVIDADE, {"desde": desde, "conceito": conceito})


@app.get("/api/professor/vitoria-por-tentativa", tags=["professor"])
def vitoria_por_tentativa(
    conceito: str | None = None,
    usuario: auth.Usuario = Depends(auth.usuario_atual),
) -> list[dict]:
    auth.exigir_professor(usuario)
    return db.consultar(consultas.VITORIA_POR_TENTATIVA, {"conceito": conceito})


@app.get("/api/conceitos", tags=["acesso"])
def conceitos_filtro(usuario: auth.Usuario = Depends(auth.usuario_atual)) -> list[dict]:
    return db.consultar(consultas.CONCEITOS_FILTRO)


# ---------------------------------------------------------------------------
# Dashboard servido pela propria API (ADR-002)
# ---------------------------------------------------------------------------

class _SemCache(StaticFiles):
    """Serve o dashboard sem cache.

    Sem isto o navegador segura os modulos JavaScript entre recarregamentos e
    quem esta mexendo no dashboard ve a versao antiga sem entender por que.
    Em producao o certo e versionar os arquivos e deixar o cache ligado.
    """

    def file_response(self, *args, **kwargs):
        resposta = super().file_response(*args, **kwargs)
        resposta.headers["Cache-Control"] = "no-store, must-revalidate"
        return resposta


app.mount("/dashboard", _SemCache(directory=config.DIR_DASHBOARD, html=True),
          name="dashboard")


@app.get("/")
def raiz() -> FileResponse:
    return FileResponse(config.DIR_DASHBOARD / "index.html")
