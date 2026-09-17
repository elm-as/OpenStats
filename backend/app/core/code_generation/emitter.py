"""
Socle du generateur de code : bloc, litteraux echappes, tri topologique,
assemblage commun a Python, R et Jupyter.

Trois defauts structurels du generateur historique sont traites ici :

  1. les imports par noeud etaient desactives a l'assemblage, produisant des
     `NameError` ; ils sont desormais collectes et emis en tete ;
  2. les identifiants etaient interpoles bruts, cassant sur `l'annee` ; ils
     passent par `py_literal` / `r_literal` ;
  3. un noeud inconnu produisait un `print` muet, donnant un script qui tourne
     sans rien calculer ; il produit maintenant un marqueur explicite et
     l'assembleur le signale.

L'ordre d'execution suit le graphe (tri topologique sur les aretes) et non
l'ordre de creation des noeuds sur le canvas.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterable


@dataclass
class CodeBlock:
    """Fragment de code d'un noeud, avec ses dependances declarees."""

    body: list[str] = field(default_factory=list)
    imports: list[str] = field(default_factory=list)
    supported: bool = True
    note: str = ""

    def __post_init__(self) -> None:
        if isinstance(self.body, str):            # tolerance d'ecriture
            self.body = self.body.splitlines()


class UnsupportedNodeError(Exception):
    """Un noeud du canvas n'a pas de traduction dans le langage cible."""

    def __init__(self, node_types: list[str], language: str):
        self.node_types = node_types
        self.language = language
        super().__init__(
            f"{len(node_types)} type(s) de noeud sans equivalent {language} : "
            + ", ".join(sorted(set(node_types)))
        )


# ── Litteraux ────────────────────────────────────────────────────────────

def py_literal(value: Any) -> str:
    """Litteral Python sur : `repr` gere apostrophes, accents et retours ligne."""
    return repr(value)


def py_cols(columns: Iterable[str]) -> str:
    """Liste de colonnes Python, chaque nom echappe."""
    return "[" + ", ".join(py_literal(str(c)) for c in columns) + "]"


def r_literal(value: Any) -> str:
    """Litteral R : guillemets doubles, echappement des backslash et guillemets."""
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        return repr(value)
    text = str(value).replace("\\", "\\\\").replace('"', '\\"')
    return f'"{text}"'


def r_cols(columns: Iterable[str]) -> str:
    """Vecteur R de noms de colonnes."""
    return "c(" + ", ".join(r_literal(str(c)) for c in columns) + ")"


def r_name(column: str) -> str:
    """Nom de colonne utilisable en syntaxe non standard (tidyverse) : backticks."""
    return "`" + str(column).replace("`", "\\`") + "`"


# ── Ordre d'execution ────────────────────────────────────────────────────

def topological_order(nodes: list[dict[str, Any]],
                      edges: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    """Trie les noeuds selon les aretes du canvas (Kahn), ordre d'origine a defaut.

    Sans ce tri, un canvas ou l'utilisateur a ajoute le nettoyage apres avoir
    pose la regression genere un script qui regresse sur des donnees sales.
    """
    if not edges:
        return list(nodes)

    by_id: dict[str, dict[str, Any]] = {}
    for index, node in enumerate(nodes):
        node_id = str(node.get("id") or f"__pos{index}")
        by_id[node_id] = node

    indegree = {node_id: 0 for node_id in by_id}
    children: dict[str, list[str]] = {node_id: [] for node_id in by_id}

    for edge in edges:
        source, target = str(edge.get("source", "")), str(edge.get("target", ""))
        if source in by_id and target in by_id:
            children[source].append(target)
            indegree[target] += 1

    # File initialisee dans l'ordre d'origine : deux noeuds independants gardent
    # l'ordre du canvas, ce qui rend la sortie deterministe.
    order: list[dict[str, Any]] = []
    ready = [nid for nid in by_id if indegree[nid] == 0]
    seen: set[str] = set()

    while ready:
        node_id = ready.pop(0)
        if node_id in seen:
            continue
        seen.add(node_id)
        order.append(by_id[node_id])
        for child in children.get(node_id, []):
            indegree[child] -= 1
            if indegree[child] == 0:
                ready.append(child)

    # Cycle ou noeuds orphelins : on les ajoute en fin plutot que de les perdre.
    for node_id, node in by_id.items():
        if node_id not in seen:
            order.append(node)

    return order


# ── Assemblage ───────────────────────────────────────────────────────────

@dataclass
class Assembled:
    """Resultat d'un assemblage, avec le diagnostic de ce qui n'a pas pu etre traduit."""

    code: str
    unsupported: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


def node_identity(node: dict[str, Any]) -> tuple[str, dict[str, Any], str]:
    """Extrait (type, parametres, libelle) quel que soit le format du noeud.

    Les noeuds arrivent tantot du canvas (`type` / `data`), tantot d'une recette
    d'auto-pipeline (`operation` / `params`).
    """
    node_type = str(node.get("operation") or node.get("type") or "unknown")
    params = node.get("params") or node.get("data") or {}
    if not isinstance(params, dict):
        params = {}
    label = str(node.get("label") or params.get("title") or params.get("label") or node_type)
    return node_type, params, label


def assemble(
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]] | None,
    dataset_name: str,
    *,
    emit,                       # (node_type, params, dataset_name) -> CodeBlock
    loader,                     # (dataset_name) -> CodeBlock
    base_imports: list[str],
    header: list[str],
    footer: list[str],
    comment: str = "#",
    strict: bool = False,
) -> Assembled:
    """Assemble un script complet a partir des blocs produits par chaque noeud."""
    ordered = topological_order(nodes, edges)

    imports: list[str] = []
    seen_imports: set[str] = set()

    def add_imports(candidates: Iterable[str]) -> None:
        for item in candidates:
            if item and item not in seen_imports:
                seen_imports.add(item)
                imports.append(item)

    add_imports(base_imports)

    load_block = loader(dataset_name)
    add_imports(load_block.imports)

    body: list[str] = []
    unsupported: list[str] = []
    notes: list[str] = []
    step = 0

    for node in ordered:
        node_type, params, label = node_identity(node)
        if node_type in ("dataset", "unknown") and step == 0:
            continue  # le chargement est deja emis par `loader`

        block = emit(node_type, params, dataset_name)
        if not block.supported:
            unsupported.append(node_type)
        if block.note:
            notes.append(f"{label} : {block.note}")
        if not block.body:
            continue

        add_imports(block.imports)
        step += 1
        rule = comment + " " + "-" * 66
        body.extend([rule, f"{comment} Etape {step} : {label} ({node_type})", rule])
        body.extend(block.body)
        body.append("")

    if strict and unsupported:
        raise UnsupportedNodeError(unsupported, comment)

    parts = list(header) + imports + [""] + load_block.body + [""] + body + list(footer)
    return Assembled(code="\n".join(parts), unsupported=unsupported, notes=notes)
