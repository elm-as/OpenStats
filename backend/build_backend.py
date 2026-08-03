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
        "--onedir",
        "--console",
        "--name", "openstats-backend",
        "--collect-all", "duckdb",
        "--collect-submodules", "app",
        # Exclure les énormes bibliothèques globales inutiles détectées dans Python 3.10
        "--exclude-module", "torch",
        "--exclude-module", "tensorflow",
        "--exclude-module", "PySide6",
        "--exclude-module", "PyQt5",
        "--exclude-module", "django",
        "--exclude-module", "skimage",
        "--exclude-module", "pygame",
        "--exclude-module", "nltk",
        "--exclude-module", "jupyter",
        "--exclude-module", "notebook",
        "--exclude-module", "sympy",
        "--exclude-module", "PIL.SpiderImagePlugin",
        "--hidden-import", "engineio.async_drivers.threading",
        "run_desktop.py"
    ]

    print("Exécution de la commande d'analyse rapide...")
    res = subprocess.run(cmd)
    if res.returncode == 0:
        print("\n✅ Compilation backend réussie ! Exécutable généré dans dist/openstats-backend/")
    else:
        print(f"\n❌ Erreur lors de la compilation (code retour: {res.returncode})")
        sys.exit(res.returncode)

if __name__ == "__main__":
    build_backend()
