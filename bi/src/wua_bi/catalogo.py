"""Leitura do catalogo de fases (ADR-006).

O catalogo e a fonte unica sobre o que e cada fase: qual conceito ela ensina,
quais blocos a Palette mostra e qual e a solucao de referencia. O jogo le o
mesmo arquivo, e por isso jogo e dashboard nunca discordam.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from . import config
from .programa import contar_blocos


@dataclass(frozen=True)
class Conceito:
    conceito_id: str
    nome: str
    ordem: int


@dataclass(frozen=True)
class Fase:
    fase_id: str
    ordem: int
    titulo: str
    conceito_id: str
    blocos_disponiveis: tuple[str, ...]
    solucao_referencia: dict[str, Any]

    @property
    def tamanho_referencia(self) -> int:
        """Blocos da solucao de referencia, contados do proprio programa (RN-014)."""
        return contar_blocos(self.solucao_referencia)


@dataclass(frozen=True)
class Catalogo:
    catalog_version: str
    conceitos: tuple[Conceito, ...]
    fases: tuple[Fase, ...]
    tipos_de_bloco: dict[str, str]  # tipo -> categoria
    condicoes: tuple[str, ...]
    # tipos que iniciam uma pilha (os blocos "hat" do jogo). Vem do catalogo,
    # nao do nome da categoria - ver tipos_de_evento.
    inicia_pilha: frozenset[str] = frozenset()
    # tipos que tem corpo (os "c-block" do jogo)
    com_corpo: frozenset[str] = frozenset()
    # quantas vezes um bloco de repeticao sem parametro repete o corpo
    vezes_fixas: tuple[tuple[str, int], ...] = ()
    # rotulo legivel de cada tipo, como o jogo o escreve na Palette
    rotulos: tuple[tuple[str, str], ...] = ()

    def rotulo(self, tipo: str) -> str:
        """Nome do bloco como o jogador o le. Cai no proprio tipo se faltar."""
        return dict(self.rotulos).get(tipo, tipo)

    @property
    def tipos_de_evento(self) -> set[str]:
        """Tipos que iniciam uma pilha. Definem qual pilha executa (RN-018).

        Antes isto era `cat == "evento"`, com o nome da categoria cravado no
        codigo. Nao servia: o catalogo do jogo chama a categoria de `event`, e
        o dia em que o nome mudasse o conjunto viraria vazio, nenhuma pilha
        seria executavel e a RN-018 passaria a reprovar tudo em silencio.

        Agora quem declara e o proprio catalogo, em `inicia_pilha` - que e a
        traducao direta do `shape: 'hat'` do BlockTemplate do jogo. A ADR-006
        diz que o catalogo e a fonte unica; isto faz valer tambem para "qual
        bloco comeca uma pilha".
        """
        return set(self.inicia_pilha)

    def repeticoes(self, bloco: dict[str, Any]) -> int | None:
        """Quantas vezes este bloco repete o corpo, se for de repeticao.

        Duas formas, nesta ordem: um parametro `vezes` no proprio bloco (se um
        dia a Palette ganhar parametro editavel) ou o `vezes_fixas` declarado
        no catalogo - que hoje e o caso do `repeat`, cujo rotulo no jogo e
        literalmente "Repetir 3x". Nulo quando o bloco nao repete.
        """
        params = bloco.get("params") or {}
        if "vezes" in params:
            return int(params["vezes"])
        return dict(self.vezes_fixas).get(bloco.get("tipo", ""))

    def fase(self, fase_id: str) -> Fase | None:
        return next((f for f in self.fases if f.fase_id == fase_id), None)

    def papel(self, fase: Fase) -> str:
        """"introducao" se a fase apresenta o conceito, "reforco" se o repete.

        Nem toda fase ensina um conceito novo: algumas existem para reforcar o
        que a fase anterior ensinou, quando o conteudo e mais avancado. Uma
        fase de reforco e simplesmente uma fase cujo conceito_id ja apareceu
        numa fase anterior, entao isso sai do catalogo como ele ja e, sem
        campo novo (ADR-006).
        """
        primeira = min(
            (f for f in self.fases if f.conceito_id == fase.conceito_id),
            key=lambda f: f.ordem,
        )
        return "introducao" if primeira.fase_id == fase.fase_id else "reforco"

    def bloco_introduzido(self, fase: Fase) -> str | None:
        """O bloco que esta fase acrescenta a Palette, se acrescentar algum."""
        anteriores: set[str] = set()
        for outra in sorted(self.fases, key=lambda f: f.ordem):
            if outra.ordem >= fase.ordem:
                break
            anteriores |= set(outra.blocos_disponiveis)

        novos = [t for t in fase.blocos_disponiveis if t not in anteriores]
        # a primeira fase introduz tudo; nao ha o que comparar
        return novos[-1] if novos and anteriores else None

    def bloco_do_conceito(self, fase: Fase) -> str | None:
        """O bloco que representa o conceito desta fase.

        Serve para uma pergunta que nenhum outro indicador responde: o jogador
        venceu a fase USANDO o conceito, ou achou um jeito de contornar? (ex.:
        vencer a fase de repeticao copiando "atacar" tres vezes em vez de usar
        "repetir".)

        Numa fase de introducao e o bloco que ela acrescenta. Numa fase de
        reforco e o bloco da fase que introduziu aquele conceito — o reforco
        nao traz bloco novo, mas e exatamente onde interessa saber se o
        conceito pegou.

        Nulo quando o conceito nao se resume a um bloco: "combinacao" e usar
        um bloco dentro do outro, e nao ha bloco novo que a represente.
        """
        introdutora = min(
            (f for f in self.fases if f.conceito_id == fase.conceito_id),
            key=lambda f: f.ordem,
        )
        return self.bloco_introduzido(introdutora)

    def categoria(self, tipo: str) -> str | None:
        return self.tipos_de_bloco.get(tipo)

    def blocos_simples_de(self, fase: Fase) -> tuple[str, ...]:
        """Blocos da Palette da fase que nao iniciam pilha nem tem corpo.

        Sao as acoes soltas - as pecas que um programa pode ganhar a mais sem
        mudar de forma. O gerador usa isto para inchar um programa sem citar
        nenhum identificador de bloco pelo nome.
        """
        return tuple(
            t for t in fase.blocos_disponiveis
            if t not in self.inicia_pilha and t not in self.com_corpo
        )

    def validar(self) -> list[str]:
        """Problemas que tornariam o catalogo inutilizavel pelo ETL."""
        problemas: list[str] = []
        ids_conceito = {c.conceito_id for c in self.conceitos}

        # Sem nenhum bloco iniciando pilha, a RN-018 reprovaria todo programa
        # e o erro so apareceria como "nenhuma tentativa executavel" la na
        # frente. Melhor recusar o catalogo aqui.
        if not self.inicia_pilha:
            problemas.append(
                "nenhum tipo de bloco declara inicia_pilha: sem isso a RN-018 "
                "considera que nenhuma pilha executa"
            )

        for tipo in self.inicia_pilha:
            if tipo not in self.tipos_de_bloco:
                problemas.append(
                    f"inicia_pilha cita '{tipo}', que nao esta em tipos_de_bloco"
                )

        for fase in self.fases:
            if fase.conceito_id not in ids_conceito:
                problemas.append(
                    f"{fase.fase_id}: conceito '{fase.conceito_id}' nao existe no catalogo"
                )
            for tipo in fase.blocos_disponiveis:
                if tipo not in self.tipos_de_bloco:
                    problemas.append(
                        f"{fase.fase_id}: bloco '{tipo}' da Palette nao existe no catalogo"
                    )
            if fase.tamanho_referencia == 0:
                # Sem referencia nao da para calcular a eficiencia (RN-014).
                problemas.append(f"{fase.fase_id}: solucao de referencia vazia")

        return problemas


def carregar(caminho: Path | None = None) -> Catalogo:
    bruto = json.loads((caminho or config.CAMINHO_CATALOGO).read_text(encoding="utf-8"))

    return Catalogo(
        catalog_version=bruto["catalog_version"],
        conceitos=tuple(
            Conceito(c["conceito_id"], c["nome"], c["ordem"]) for c in bruto["conceitos"]
        ),
        fases=tuple(
            Fase(
                fase_id=f["fase_id"],
                ordem=f["ordem"],
                titulo=f["titulo"],
                conceito_id=f["conceito_id"],
                blocos_disponiveis=tuple(f["blocos_disponiveis"]),
                solucao_referencia=f["solucao_referencia"],
            )
            for f in bruto["fases"]
        ),
        tipos_de_bloco={t["tipo"]: t["categoria"] for t in bruto["tipos_de_bloco"]},
        condicoes=tuple(c["tipo"] for c in bruto.get("condicoes", [])),
        inicia_pilha=frozenset(
            t["tipo"] for t in bruto["tipos_de_bloco"] if t.get("inicia_pilha")
        ),
        com_corpo=frozenset(
            t["tipo"] for t in bruto["tipos_de_bloco"] if t.get("tem_corpo")
        ),
        vezes_fixas=tuple(
            (t["tipo"], int(t["vezes_fixas"]))
            for t in bruto["tipos_de_bloco"] if t.get("vezes_fixas") is not None
        ),
        rotulos=tuple(
            (t["tipo"], t["rotulo"])
            for t in bruto["tipos_de_bloco"] if t.get("rotulo")
        ),
    )


@lru_cache(maxsize=1)
def catalogo_padrao() -> Catalogo:
    return carregar()
