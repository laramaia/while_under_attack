"""Leitura do programa que o jogo manda dentro do evento EV-04.

O formato esta no Contrato de Eventos, secao 4. Este modulo faz uma coisa so:
transformar aquele JSON aninhado numa lista plana de blocos, com pai,
profundidade e posicao.

E a peca mais reaproveitada do BI: a contagem de blocos da RN-014, a tabela
silver.programa_bloco e o tamanho de referencia do catalogo saem todos daqui,
o que garante que os tres contem da mesma forma.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

# Contrato de Eventos, secao 4: os blocos em C guardam os filhos em "corpo".
# "senao" esta reservado e ainda nao e usado (PD-013), mas ja e lido aqui para
# que um programa com senao nao perca blocos na contagem.
CAMPOS_DE_CORPO = ("corpo", "senao")


@dataclass(frozen=True)
class Bloco:
    """Uma instancia de bloco dentro de um programa."""

    bloco_id: str
    tipo: str
    pilha_indice: int
    posicao: int
    profundidade: int
    bloco_pai_id: str | None
    condicao_tipo: str | None
    params: dict[str, Any] | None
    pilha_executavel: bool


@dataclass
class ProgramaLido:
    blocos: list[Bloco] = field(default_factory=list)
    qtd_pilhas: int = 0
    qtd_pilhas_executaveis: int = 0

    @property
    def qtd_blocos(self) -> int:
        """Todas as instancias, inclusive aninhadas e o bloco de evento (RN-014)."""
        return len(self.blocos)

    @property
    def profundidade_max(self) -> int:
        return max((b.profundidade for b in self.blocos), default=0)


def ler_programa(programa: dict[str, Any], tipos_de_evento: set[str]) -> ProgramaLido:
    """Transforma o programa aninhado numa lista plana de blocos.

    `tipos_de_evento` sao os tipos de bloco da categoria "evento" segundo o
    catalogo. Uma pilha so executa se comecar com um deles (RN-018).
    """
    lido = ProgramaLido()
    pilhas = programa.get("pilhas") or []
    lido.qtd_pilhas = len(pilhas)

    for indice, pilha in enumerate(pilhas):
        # RN-018: pilha solta continua registrada no programa, mas nao executa.
        executavel = bool(pilha) and pilha[0].get("tipo") in tipos_de_evento
        if executavel:
            lido.qtd_pilhas_executaveis += 1
        _ler_sequencia(pilha, lido, indice, executavel, pai=None, profundidade=0)

    return lido


def _ler_sequencia(
    sequencia: list[dict[str, Any]],
    lido: ProgramaLido,
    pilha_indice: int,
    executavel: bool,
    pai: str | None,
    profundidade: int,
) -> None:
    for posicao, bruto in enumerate(sequencia):
        bloco_id = bruto["id"]
        condicao = bruto.get("condicao") or {}

        lido.blocos.append(
            Bloco(
                bloco_id=bloco_id,
                tipo=bruto["tipo"],
                pilha_indice=pilha_indice,
                posicao=posicao,
                profundidade=profundidade,
                bloco_pai_id=pai,
                condicao_tipo=condicao.get("tipo"),
                params=bruto.get("params"),
                pilha_executavel=executavel,
            )
        )

        for campo in CAMPOS_DE_CORPO:
            corpo = bruto.get(campo)
            if corpo:
                _ler_sequencia(
                    corpo, lido, pilha_indice, executavel, bloco_id, profundidade + 1
                )


def contar_blocos(programa: dict[str, Any]) -> int:
    """Conta os blocos sem precisar do catalogo.

    Usado para o tamanho da solucao de referencia, onde a questao de qual pilha
    executa nao se coloca: a referencia e um programa so, inteiro (RN-014).
    """
    total = 0
    for pilha in programa.get("pilhas") or []:
        total += _contar_sequencia(pilha)
    return total


def _contar_sequencia(sequencia: list[dict[str, Any]]) -> int:
    total = 0
    for bruto in sequencia:
        total += 1
        for campo in CAMPOS_DE_CORPO:
            corpo = bruto.get(campo)
            if corpo:
                total += _contar_sequencia(corpo)
    return total
