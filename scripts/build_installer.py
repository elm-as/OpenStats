"""Assemble l'installateur Windows Inno Setup pour OpenStats Desktop.

Ce script :
1. Vérifie la présence du binaire Python compilé (backend/dist/openstats-backend/).
2. Compile le frontend React et génère le paquet décompressé Electron (electron-builder --dir).
3. Détecte le compilateur Inno Setup (ISCC.exe) sur le poste.
4. Produit l'exécutable d'installation final (frontend/release/OpenStats_Setup_v1.0.0.exe).
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent


def trouver_iscc() -> Path | None:
    """Localise le compilateur Inno Setup (ISCC.exe) sur le système."""
    dans_path = shutil.which("iscc")
    if dans_path:
        return Path(dans_path)

    candidats = [
        Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Inno Setup 6" / "ISCC.exe",
        Path("C:/Program Files/Inno Setup 6/ISCC.exe"),
        Path("C:/Program Files (x86)/Inno Setup 6/ISCC.exe"),
    ]
    for candidat in candidats:
        if candidat.exists():
            return candidat
    return None


def main() -> int:
    import argparse
    parser = argparse.ArgumentParser(description="Assemble l'installateur Windows Inno Setup pour OpenStats Desktop.")
    parser.add_argument("--rebuild-backend", action="store_true", help="Recompile d'abord le backend Python avec PyInstaller")
    args, _ = parser.parse_known_args()

    if args.rebuild_backend:
        print("\n[0/3] Recompilation du backend Python via PyInstaller...")
        res_backend = subprocess.run([sys.executable, "backend/build_backend.py"], cwd=str(RACINE))
        if res_backend.returncode != 0:
            print(f"[ERREUR] Échec de la compilation du backend (code {res_backend.returncode})", file=sys.stderr)
            return res_backend.returncode

    backend_exe = RACINE / "backend" / "dist" / "openstats-backend" / "openstats-backend.exe"
    if not backend_exe.exists():
        print(f"[ERREUR] Le binaire backend est introuvable : {backend_exe}", file=sys.stderr)
        print("Veuillez d'abord exécuter : python backend/build_backend.py (ou ajouter --rebuild-backend)", file=sys.stderr)
        return 1

    iscc_path = trouver_iscc()
    if not iscc_path:
        print("[ERREUR] Compilateur Inno Setup (ISCC.exe) introuvable.", file=sys.stderr)
        print("Installez-le avec : winget install --id JRSoftware.InnoSetup -e", file=sys.stderr)
        return 1

    print(f"[1/3] Compilateur Inno Setup détecté : {iscc_path}")

    print("\n[2/3] Compilation du frontend et assemblage Electron décompressé...")
    cmd_electron = ["npm", "run", "build:pack"]
    res_electron = subprocess.run(cmd_electron, cwd=str(RACINE / "frontend"), shell=True)
    if res_electron.returncode != 0:
        print(f"[ERREUR] Échec du build Electron (code {res_electron.returncode})", file=sys.stderr)
        return res_electron.returncode

    script_iss = RACINE / "installer.iss"
    if not script_iss.exists():
        print(f"[ERREUR] Script Inno Setup introuvable : {script_iss}", file=sys.stderr)
        return 1

    print(f"\n[3/3] Compilation de l'installateur Windows Inno Setup ({script_iss.name})...")
    cmd_inno = [str(iscc_path), str(script_iss)]
    res_inno = subprocess.run(cmd_inno, cwd=str(RACINE))
    if res_inno.returncode != 0:
        print(f"[ERREUR] Échec de la compilation Inno Setup (code {res_inno.returncode})", file=sys.stderr)
        return res_inno.returncode

    dossier_sortie = RACINE / "frontend" / "release"
    setups = list(dossier_sortie.glob("OpenStats_Setup_*.exe"))
    if setups:
        dernier = max(setups, key=lambda f: f.stat().st_mtime)
        taille_mo = dernier.stat().st_size / (1024 * 1024)
        print("\n" + "=" * 70)
        print("  Installateur OpenStats Desktop généré avec succès !")
        print("=" * 70)
        print(f"Fichier : {dernier}")
        print(f"Taille  : {taille_mo:.1f} Mo")
        print("=" * 70 + "\n")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
