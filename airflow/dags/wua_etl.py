"""DAG do ETL do while under_attack (ADR-009).

Faz uma coisa so: chamar `pipeline.executar`, a mesma funcao que a linha de
comando e o agendador proprio chamam. Isso nao e preguica de DAG -- e a
consequencia registrada na ADR-003 e repetida na ADR-009: **trocar o gatilho
nao mexe no ETL**. O DAG e um gatilho a mais.

Por que UMA tarefa, e nao uma por camada
----------------------------------------

A tentacao obvia e quebrar em `silver -> qualidade -> gold -> publicar`, que
e como um DAG de livro-texto se parece. **Isso quebraria a ADR-010.**

O gate de qualidade so significa alguma coisa porque as duas portas rodam
DENTRO da mesma transacao do ETL: se uma regra reprova, a transacao inteira
volta atras e a gold continua sendo a ultima versao aprovada. Uma transacao
de banco nao atravessa tarefas do Airflow -- cada tarefa e um processo
diferente, com a sua propria conexao. Quebrar em quatro tarefas daria um
desenho mais bonito no grafo e uma gold que pode ficar pela metade, que e
exatamente o que o gate existe para impedir.

Entao: um DAG, uma tarefa, e o motivo escrito aqui para ninguem "melhorar"
isso depois sem saber o que esta trocando.

Por que a tarefa levanta excecao na mao
---------------------------------------

`pipeline.executar` **nunca levanta**: ela devolve um `Resumo` com `ok=False`
e o erro dentro. Isso e proposital -- o agendador proprio precisa seguir
rodando depois de uma falha. Mas para o Airflow significa que uma tarefa que
so chamasse a funcao ficaria **verde mesmo com o gate reprovando**. Por isso
o `raise` explicito abaixo: sem ele, o DAG mentiria.
"""

from __future__ import annotations

import pendulum
from airflow.decorators import dag, task

from wua_bi import config
from wua_bi.etl import pipeline


@dag(
    dag_id="wua_etl",
    description="bronze -> silver -> gate -> gold -> gate -> commit",
    # ADR-009: 15 minutos, decidido na apresentacao de 26/10/2026. O valor vem
    # do mesmo lugar que o agendador proprio le, para os dois nunca divergirem.
    schedule=f"*/{config.INTERVALO_ETL_MIN} * * * *",
    start_date=pendulum.datetime(2026, 11, 1, tz="UTC"),
    catchup=False,
    # O ETL reconstroi a gold inteira a partir da bronze a cada execucao. Duas
    # execucoes ao mesmo tempo disputariam o mesmo `truncate`, entao nunca.
    max_active_runs=1,
    tags=["wua", "bi", "medallion"],
)
def wua_etl():
    @task(task_id="etl_completo", retries=2,
          retry_delay=pendulum.duration(minutes=1))
    def etl_completo() -> dict:
        """bronze -> silver -> porta -> gold -> porta -> commit, numa transacao."""
        resumo = pipeline.executar(disparo="airflow")

        if not resumo.ok:
            motivo = resumo.erro or (
                "gate reprovou: " + ", ".join(resumo.regras_reprovadas)
            )
            # Sem este raise a tarefa ficaria verde com a gold nao publicada.
            raise RuntimeError(f"ETL nao publicou a gold -- {motivo}")

        return {
            "disparo": resumo.disparo,
            "silver": resumo.silver,
            "gold": resumo.gold,
            "regras_aprovadas": resumo.regras_aprovadas,
            "duracao_s": round(resumo.duracao_s, 3),
        }

    etl_completo()


wua_etl()
