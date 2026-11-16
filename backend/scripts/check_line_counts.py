"""Script canonique de vérification de conformité à la charte ElmasCore (ELMAS.md).

Vérifie les règles d'architecture et de qualité de code suivantes :
1. Plafond strict de 350 lignes par fichier (ELMAS.md §2).
2. Absence de dossiers fourre-tout interdits : utils, helpers, misc, common (ELMAS.md §1).
3. Absence de noms de fichiers génériques interdits : utils.*, helper.*, helpers.*,
   misc.*, temp.*, final.*, v2.*, table2.*, newtable.* (ELMAS.md §5).

Scanne :
- backend/app, backend/tests, backend/scripts
- frontend/src, frontend/electron
- scripts/
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from typing import List, Pattern, Set, Tuple

MAX_LINES_LIMIT: int = 350

CHECKED_EXTENSIONS: Set[str] = {
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".css",
    ".cjs",
    ".mjs",
}

EXCLUDE_DIRS: Set[str] = {
    "node_modules",
    "dist",
    "build",
    "release",
    ".git",
    "__pycache__",
    ".pytest_cache",
    ".venv",
    "venv",
}

FORBIDDEN_FOLDERS: Set[str] = {
    "utils",
    "helpers",
    "misc",
    "common",
}

FORBIDDEN_FILE_PATTERNS: List[Pattern[str]] = [
    re.compile(
        r"^(utils|helper|helpers|misc|temp|final|v2|table2|newtable)(\..*)?$",
        re.IGNORECASE,
    ),
]


def get_project_root() -> Path:
    """Localise la racine du dépôt Openstats indépendamment du répertoire courant.

    Retourne:
        Path: Chemin absolu vers la racine du dépôt Openstats.
    """
    script_dir = Path(__file__).resolve().parent
    for candidate in [script_dir, script_dir.parent, script_dir.parent.parent]:
        if (candidate / "backend").is_dir() and (candidate / "frontend").is_dir():
            return candidate

    cwd = Path.cwd().resolve()
    for candidate in [cwd, cwd.parent]:
        if (candidate / "backend").is_dir() and (candidate / "frontend").is_dir():
            return candidate

    return script_dir.parent.parent


def to_relative_str(path: Path, base_dir: Path) -> str:
    """Convertit un chemin en chaîne relative par rapport à base_dir si possible.

    Paramètres:
        path: Le chemin cible.
        base_dir: Le répertoire de référence.

    Retourne:
        str: Chemin relatif ou absolu sous forme normalisée.
    """
    try:
        return str(path.relative_to(base_dir))
    except ValueError:
        return str(path)


def is_forbidden_folder(folder_name: str) -> bool:
    """Vérifie si un nom de dossier enfreint la règle des dossiers fourre-tout.

    Paramètres:
        folder_name: Nom du dossier à tester.

    Retourne:
        bool: True si le dossier est interdit, False sinon.
    """
    return folder_name.lower() in FORBIDDEN_FOLDERS


def is_forbidden_filename(filename: str, file_path: Path | None = None) -> bool:
    """Vérifie si un nom de fichier enfreint la règle des noms génériques.

    Paramètres:
        filename: Nom simple du fichier (avec extension).
        file_path: Chemin optionnel pour exclure les répertoires de données/cache.

    Retourne:
        bool: True si le nom de fichier est interdit, False sinon.
    """
    if file_path and ("data" in file_path.parts or "cachedir" in file_path.parts):
        return False

    for pattern in FORBIDDEN_FILE_PATTERNS:
        if pattern.match(filename):
            return True

    return False


def count_file_lines(file_path: Path) -> int:
    """Compte le nombre total de lignes d'un fichier source de manière efficace.

    Paramètres:
        file_path: Chemin du fichier à analyser.

    Retourne:
        int: Nombre de lignes, ou -1 en cas d'erreur de lecture.
    """
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as fp:
            return sum(1 for _ in fp)
    except Exception as exc:
        print(f"[AVERTISSEMENT] Erreur lecture {file_path}: {exc}", file=sys.stderr)
        return -1


def check_folder_anti_patterns(
    root: str,
    dirs: List[str],
    project_dir: Path,
) -> List[str]:
    """Détecte les sous-dossiers interdits dans le répertoire courant.

    Paramètres:
        root: Répertoire courant parcouru.
        dirs: Liste des sous-dossiers présents.
        project_dir: Racine du dépôt pour le calcul du chemin relatif.

    Retourne:
        List[str]: Chemins relatifs des dossiers interdits détectés.
    """
    violations: List[str] = []
    for d in dirs:
        if not is_forbidden_folder(d):
            continue
        p_dir = Path(root) / d
        violations.append(to_relative_str(p_dir, project_dir))
    return violations


def check_files_in_dir(
    root: str,
    files: List[str],
    project_dir: Path,
) -> Tuple[List[Tuple[int, str]], List[Tuple[str, str]], int]:
    """Vérifie les fichiers d'un répertoire pour les lignes et les noms génériques.

    Paramètres:
        root: Répertoire courant.
        files: Liste des noms de fichiers.
        project_dir: Racine du dépôt pour chemins relatifs.

    Retourne:
        Tuple: (line_violations, filename_violations, scanned_files_count)
    """
    line_violations: List[Tuple[int, str]] = []
    filename_violations: List[Tuple[str, str]] = []
    scanned_count = 0

    for f in files:
        p_file = Path(root) / f
        if p_file.suffix.lower() not in CHECKED_EXTENSIONS:
            continue

        scanned_count += 1
        rel_path = to_relative_str(p_file, project_dir)

        if is_forbidden_filename(f, p_file):
            filename_violations.append((f, rel_path))

        lines_count = count_file_lines(p_file)
        if lines_count > MAX_LINES_LIMIT:
            line_violations.append((lines_count, rel_path))

    return line_violations, filename_violations, scanned_count


def scan_directory(
    scan_dir: Path,
    project_dir: Path,
) -> Tuple[List[Tuple[int, str]], List[str], List[Tuple[str, str]], int]:
    """Parcourt récursivement un répertoire cible en appliquant les filtres.

    Paramètres:
        scan_dir: Répertoire à analyser.
        project_dir: Racine du projet.

    Retourne:
        Tuple: (line_violations, folder_violations, filename_violations, total_files)
    """
    if not scan_dir.exists():
        return [], [], [], 0

    line_violations: List[Tuple[int, str]] = []
    folder_violations: List[str] = []
    filename_violations: List[Tuple[str, str]] = []
    total_files = 0

    for root, dirs, files in os.walk(scan_dir):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith(".")]

        folder_violations.extend(check_folder_anti_patterns(root, dirs, project_dir))

        lines_v, name_v, count = check_files_in_dir(root, files, project_dir)
        line_violations.extend(lines_v)
        filename_violations.extend(name_v)
        total_files += count

    return line_violations, folder_violations, filename_violations, total_files


def check_codebase(
    scan_dirs: List[Path] | None = None,
    project_dir: Path | None = None,
) -> Tuple[List[Tuple[int, str]], List[str], List[Tuple[str, str]], int]:
    """Exécute l'audit complet de la base de code sur tous les répertoires spécifiés.

    Paramètres:
        scan_dirs: Liste optionnelle des répertoires à scanner.
        project_dir: Racine optionnelle du projet.

    Retourne:
        Tuple: (line_violations, folder_violations, filename_violations, total_scanned)
    """
    base_dir = project_dir or get_project_root()
    target_dirs = scan_dirs or [
        base_dir / "backend" / "app",
        base_dir / "backend" / "tests",
        base_dir / "backend" / "scripts",
        base_dir / "frontend" / "src",
        base_dir / "frontend" / "electron",
        base_dir / "scripts",
    ]

    all_line_violations: List[Tuple[int, str]] = []
    all_folder_violations: List[str] = []
    all_filename_violations: List[Tuple[str, str]] = []
    total_scanned = 0

    for directory in target_dirs:
        line_v, folder_v, name_v, count = scan_directory(directory, base_dir)
        all_line_violations.extend(line_v)
        all_folder_violations.extend(folder_v)
        all_filename_violations.extend(name_v)
        total_scanned += count

    return all_line_violations, all_folder_violations, all_filename_violations, total_scanned


def format_report(
    line_violations: List[Tuple[int, str]],
    folder_violations: List[str],
    filename_violations: List[Tuple[str, str]],
    total_scanned: int,
) -> int:
    """Affiche le rapport formaté dans stdout et retourne le code de sortie (0 ou 1).

    Paramètres:
        line_violations: Fichiers dépassant MAX_LINES_LIMIT.
        folder_violations: Dossiers fourre-tout détectés.
        filename_violations: Noms de fichiers génériques détectés.
        total_scanned: Nombre total de fichiers analysés.

    Retourne:
        int: 0 si aucune violation, 1 si au moins une violation.
    """
    has_violations = bool(line_violations or folder_violations or filename_violations)

    print("=" * 72)
    print("  RAPPORT D'AUDIT DE CONFORMITÉ CHARTE ELMASCORE (ELMAS.md)")
    print("=" * 72)
    print(f"Fichiers scannés : {total_scanned}")
    print(f"Limite maximale  : {MAX_LINES_LIMIT} lignes par fichier (ELMAS.md §2)")
    print(f"Extensions       : {', '.join(sorted(CHECKED_EXTENSIONS))}")
    print("-" * 72)

    if line_violations:
        print(f"\n[ÉCHEC] {len(line_violations)} fichier(s) dépassent {MAX_LINES_LIMIT} lignes :")
        for count, path in sorted(line_violations, reverse=True):
            print(f"  • {count:4d} lignes : {path}")

    if folder_violations:
        print(f"\n[ÉCHEC] {len(folder_violations)} dossier(s) fourre-tout interdits (ELMAS.md §1) :")
        for folder_path in sorted(folder_violations):
            print(f"  • Dossier interdit : {folder_path}")

    if filename_violations:
        print(f"\n[ÉCHEC] {len(filename_violations)} fichier(s) au nom générique (ELMAS.md §5) :")
        for fname, fpath in sorted(filename_violations):
            print(f"  • Nom interdit : '{fname}' dans {fpath}")

    if has_violations:
        print("-" * 72)
        total_errors = len(line_violations) + len(folder_violations) + len(filename_violations)
        print(f"RÉSULTAT : NON CONFORME ({total_errors} infraction(s) constatée(s)).")
        print("=" * 72)
        return 1

    print("RÉSULTAT : CONFORME.")
    print(f"Tous les {total_scanned} fichiers respectent strictement la charte ELMAS.md")
    print("(<= 350 lignes, aucun dossier/fichier générique ou fourre-tout).")
    print("=" * 72)
    return 0


def main() -> int:
    """Point d'entrée principal du script d'audit."""
    line_v, folder_v, name_v, total = check_codebase()
    return format_report(line_v, folder_v, name_v, total)


if __name__ == "__main__":
    sys.exit(main())
