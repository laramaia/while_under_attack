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
    title="while under_attack - API do dashboard",
    version="0.1.0",
    description="Leitura da camada gold. Os indicadores sao calculados no ETL (ADR-001).",
)


class PedidoLogin(BaseModel):
    usuario: str
    senha: str


@app.post("/api/login")
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


@app.get("/api/eu")
def eu(usuario: auth.Usuario = Depends(auth.usuario_atual)) -> dict[str, Any]:
    return {
        "jogador_id": usuario.jogador_id,
        "nome_exibicao": usuario.nome_exibicao,
        "perfil": usuario.perfil,
    }


@app.get("/api/procedencia")
def procedencia(usuario: auth.Usuario = Depends(auth.usuario_atual)) -> dict[str, Any]:
    """De onde vem o que o dashboard esta mostrando (RS-02)."""
    dados = consultas.procedencia()
    dados["catalogo_carregado"] = catalogo_padrao().catalog_version
    return dados


# ---------------------------------------------------------------------------
# Jogador (O3). RN-004 vale em todos: o proprio jogador ou o professor.
# ---------------------------------------------------------------------------

def _sk(jogador_id: int, usuario: auth.Usuario) -> int:
    auth.exigir_acesso_a(jogador_id, usuario)
    jogador_sk = consultas.jogador_sk_de(jogador_id)
    if jogador_sk is None:
        raise HTTPException(404, "jogador sem dados na camada gold")
    return jogador_sk


@app.get("/api/jogador/{jogador_id}/resumo")
def resumo_jogador(jogador_id: int,
                   usuario: auth.Usuario = Depends(auth.usuario_atual)) -> dict[str, Any]:
    return consultas.resumo_jogador(_sk(jogador_id, usuario))


@app.get("/api/jogador/{jogador_id}/progresso")
def progresso_jogador(jogador_id: int,
                      usuario: auth.Usuario = Depends(auth.usuario_atual)) -> list[dict]:
    return db.consultar(consultas.PROGRESSO_JOGADOR, {"jogador_sk": _sk(jogador_id, usuario)})


@app.get("/api/jogador/{jogador_id}/linha-do-tempo")
def linha_do_tempo(jogador_id: int,
                   usuario: auth.Usuario = Depends(auth.usuario_atual)) -> list[dict]:
    return db.consultar(consultas.LINHA_DO_TEMPO_JOGADOR,
                        {"jogador_sk": _sk(jogador_id, usuario)})


@app.get("/api/jogador/{jogador_id}/onde-travou")
def onde_travou(jogador_id: int,
                usuario: auth.Usuario = Depends(auth.usuario_atual)) -> list[dict]:
    return db.consultar(consultas.ONDE_TRAVOU, {"jogador_sk": _sk(jogador_id, usuario)})


@app.get("/api/jogador/{jogador_id}/conceitos")
def conceitos(jogador_id: int,
              usuario: auth.Usuario = Depends(auth.usuario_atual)) -> list[dict]:
    return db.consultar(consultas.CONCEITOS_JOGADOR, {"jogador_sk": _sk(jogador_id, usuario)})


# ---------------------------------------------------------------------------
# Professor (O4). RN-005 em todos.
# ---------------------------------------------------------------------------

@app.get("/api/professor/resumo")
def resumo_professor(usuario: auth.Usuario = Depends(auth.usuario_atual)) -> dict[str, Any]:
    auth.exigir_professor(usuario)
    return consultas._um(consultas.RESUMO_PROFESSOR)


@app.get("/api/professor/funil")
def funil(usuario: auth.Usuario = Depends(auth.usuario_atual)) -> list[dict]:
    auth.exigir_professor(usuario)
    return db.consultar(consultas.FUNIL_FASES)


@app.get("/api/professor/jogadores")
def jogadores(usuario: auth.Usuario = Depends(auth.usuario_atual)) -> list[dict]:
    auth.exigir_professor(usuario)
    return db.consultar(consultas.JOGADORES_PROFESSOR)


@app.get("/api/professor/heatmap")
def heatmap(usuario: auth.Usuario = Depends(auth.usuario_atual)) -> list[dict]:
    auth.exigir_professor(usuario)
    return db.consultar(consultas.HEATMAP_PROFESSOR)


@app.get("/api/professor/blocos-problematicos")
def blocos_problematicos(usuario: auth.Usuario = Depends(auth.usuario_atual)) -> list[dict]:
    auth.exigir_professor(usuario)
    return db.consultar(consultas.BLOCOS_PROBLEMATICOS)


@app.get("/api/professor/destaques")
def destaques(usuario: auth.Usuario = Depends(auth.usuario_atual)) -> list[dict]:
    """Os achados que valem uma olhada, lidos dos indicadores da gold."""
    auth.exigir_professor(usuario)
    return consultas.destaques()


# Os filtros valem para as consultas por tentativa. Os indicadores de
# aprendizagem (tentativas ate vencer, eficiencia) sao por definicao "ate a
# primeira vitoria" e nao se recortam por periodo, entao o funil, o heatmap e
# a tabela de jogadores ignoram os filtros de proposito.
@app.get("/api/professor/atividade")
def atividade(
    desde: str | None = None,
    conceito: str | None = None,
    usuario: auth.Usuario = Depends(auth.usuario_atual),
) -> list[dict]:
    auth.exigir_professor(usuario)
    return db.consultar(consultas.ATIVIDADE, {"desde": desde, "conceito": conceito})


@app.get("/api/professor/vitoria-por-tentativa")
def vitoria_por_tentativa(
    conceito: str | None = None,
    usuario: auth.Usuario = Depends(auth.usuario_atual),
) -> list[dict]:
    auth.exigir_professor(usuario)
    return db.consultar(consultas.VITORIA_POR_TENTATIVA, {"conceito": conceito})


@app.get("/api/conceitos")
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
