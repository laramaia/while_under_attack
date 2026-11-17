"""Aviso de falha do ETL.

Arquitetura de referencia, faixa "Observabilidade: metricas · logs · alertas".

Era o ponto mais fragil do plano de orquestracao e estava admitido como tal:
ate aqui, uma execucao que falhasse so era descoberta por alguem olhando. Com
o ETL agendado (ADR-009) isso piora, porque nao ha mais ninguem olhando a
saida do comando.

O aviso tem tres destinos, do mais barato para o mais caro:

1. stderr - sempre. E o log do processo.
2. bronze.etl_execucao.erro - sempre. Fica no banco, entao o dashboard e a
   API conseguem mostrar "a ultima execucao falhou" sem ler arquivo nenhum.
3. um POST para WUA_ALERTA_WEBHOOK - so se a variavel estiver configurada.

O terceiro e opcional de proposito: a equipe nao precisa contratar nada para
o aviso funcionar, e quem quiser ligar no Discord ou no Slack da turma cola a
URL no .env e pronto. Nenhuma dependencia nova: urllib e da biblioteca padrao.
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

from . import config

TIMEOUT_S = 5


def _texto(titulo: str, detalhe: str) -> str:
    quando = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")
    return f"[while under_attack · BI] {titulo}\n{quando}\n{detalhe}"


def avisar(titulo: str, detalhe: str) -> None:
    """Manda o aviso para todos os destinos configurados.

    Nunca levanta: um alerta que quebra o processo que ele deveria estar
    vigiando seria pior que nao ter alerta.
    """
    mensagem = _texto(titulo, detalhe)
    print(mensagem, file=sys.stderr, flush=True)

    if not config.ALERTA_WEBHOOK:
        return

    # "content" e o campo do Discord; "text" e o do Slack e do Teams. Mandar
    # os dois deixa a mesma URL funcionar nos tres sem configuracao extra.
    corpo = json.dumps({"content": mensagem, "text": mensagem}).encode("utf-8")
    pedido = urllib.request.Request(
        config.ALERTA_WEBHOOK,
        data=corpo,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(pedido, timeout=TIMEOUT_S):
            pass
    except (urllib.error.URLError, OSError) as erro:
        print(f"  (o webhook de alerta nao respondeu: {erro})",
              file=sys.stderr, flush=True)
