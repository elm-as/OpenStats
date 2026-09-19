"""
Script optimisé pour compiler le backend Python OpenStats avec PyInstaller.
Exclut les grosses bibliothèques globales non utilisées (Torch, TensorFlow, PySide6, Django, etc.)
afin que la compilation prenne moins d'une minute.
"""
import os
import sys
import subprocess

def build_backend():
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(backend_dir)

    print("=== Compilation PyInstaller Optimisée du Backend OpenStats ===")

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm",
        "openstats-backend.spec",
    ]

    print("Exécution de la compilation PyInstaller avec openstats-backend.spec...")
    res = subprocess.run(cmd)
    if res.returncode == 0:
        print("\n[SUCCES] Compilation backend reussie ! Executable genere dans dist/openstats-backend/")
    else:
        print(f"\n[ERREUR] Erreur lors de la compilation (code retour: {res.returncode})")
        sys.exit(res.returncode)

if __name__ == "__main__":
    build_backend()
