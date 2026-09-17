"""
Discipline d'interception des exceptions dans le code d'analyse.

Ces tests encodent une regle : un `except Exception` masque aussi bien une
matrice singuliere qu'une faute de frappe dans un nom d'attribut. Le second cas
produit alors un resultat faux sans que personne ne s'en apercoive — sur une
plateforme statistique, c'est le pire mode de defaillance.

La regle admet deux exceptions, listees nommement plus bas : le sommet d'un
thread de travail, ou l'interception est la seule facon d'eviter que le client
attende indefiniment.
"""

import ast
import pathlib

import pytest

BACKEND = pathlib.Path(__file__).resolve().parents[2]

# Modules couverts par la regle.
SUPERVISED = [
    "app/core/pipeline",
    "app/core/exploration",
    "app/core/code_generation/emitter.py",
    "app/core/code_generation/python_nodes.py",
    "app/core/code_generation/python_script.py",
    "app/core/code_generation/r_nodes.py",
    "app/core/code_generation/r_script.py",
    "app/core/code_generation/notebook_script.py",
    "app/core/statistical_attempt.py",
]

# Sommets de thread : sans interception large, l'exception se perd et le client
# reste bloque. Chacun doit journaliser la trace complete (verifie plus bas).
THREAD_BOUNDARIES = {
    "app/api/v1/analysis/methodology.py",
    "app/api/v1/analysis/exploration.py",
}


def _python_files() -> list[pathlib.Path]:
    files: list[pathlib.Path] = []
    for entry in SUPERVISED:
        path = BACKEND / entry
        if path.is_dir():
            files.extend(sorted(path.rglob("*.py")))
        elif path.exists():
            files.append(path)
    return files


def _handlers(tree: ast.AST):
    for node in ast.walk(tree):
        if isinstance(node, ast.ExceptHandler):
            yield node


def _names(handler: ast.ExceptHandler) -> list[str]:
    if handler.type is None:
        return ["<nu>"]
    targets = handler.type.elts if isinstance(handler.type, ast.Tuple) else [handler.type]
    out = []
    for target in targets:
        if isinstance(target, ast.Name):
            out.append(target.id)
        elif isinstance(target, ast.Attribute):
            out.append(target.attr)
    return out


@pytest.mark.parametrize("path", _python_files(), ids=lambda p: p.name)
def test_no_broad_or_bare_except(path):
    """Aucune interception large ni nue dans le code d'analyse."""
    tree = ast.parse(path.read_text(encoding="utf-8"))
    offenders = [
        f"ligne {handler.lineno} : except {', '.join(_names(handler))}"
        for handler in _handlers(tree)
        if "Exception" in _names(handler) or "BaseException" in _names(handler)
        or handler.type is None
    ]
    assert not offenders, f"{path.name} — {offenders}"


@pytest.mark.parametrize("path", _python_files(), ids=lambda p: p.name)
def test_no_silent_swallow(path):
    """Un echec intercepte doit produire quelque chose : jamais un `pass` nu."""
    tree = ast.parse(path.read_text(encoding="utf-8"))
    offenders = [
        f"ligne {handler.lineno}"
        for handler in _handlers(tree)
        if len(handler.body) == 1 and isinstance(handler.body[0], ast.Pass)
    ]
    assert not offenders, f"{path.name} avale un echec sans rien dire — {offenders}"


@pytest.mark.parametrize("path", sorted(THREAD_BOUNDARIES))
def test_thread_boundaries_log_the_traceback(path):
    """Les rares interceptions larges autorisees doivent tracer l'exception.

    Renvoyer un message court au client est utile ; perdre la trace ne l'est pas.
    """
    tree = ast.parse((BACKEND / path).read_text(encoding="utf-8"))
    broad = [h for h in _handlers(tree) if "Exception" in _names(h)]
    assert broad, f"{path} : la frontiere de thread a disparu, retirer l'exemption"

    for handler in broad:
        logged = any(
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr in ("exception", "error")
            for node in ast.walk(handler)
        )
        assert logged, f"{path} ligne {handler.lineno} : interception large sans journalisation"


def test_the_only_authorised_catch_list_is_closed():
    """`DEGENERATE_DATA_ERRORS` ne doit pas devenir un fourre-tout."""
    from app.core.statistical_attempt import DEGENERATE_DATA_ERRORS

    forbidden = {Exception, BaseException, AttributeError, NameError, ImportError}
    assert not (set(DEGENERATE_DATA_ERRORS) & forbidden), (
        "Ces erreurs signalent un defaut de programmation : les intercepter "
        "transformerait un bug en resultat silencieusement faux."
    )


def test_attempt_reports_the_reason():
    """Un echec passe par `attempt` doit porter son motif."""
    from app.core.statistical_attempt import attempt

    ok = attempt(lambda: 21 * 2)
    assert ok and ok.value == 42 and not ok.reason

    failed = attempt(lambda: 1 / 0)
    assert not failed
    assert failed.failed
    assert "ZeroDivisionError" in failed.reason
    assert failed.or_else(-1) == -1


def test_attempt_lets_programming_errors_through():
    """Une faute de frappe ne doit pas se transformer en resultat vide."""
    from app.core.statistical_attempt import attempt

    with pytest.raises(AttributeError):
        attempt(lambda: "texte".methode_inexistante())
