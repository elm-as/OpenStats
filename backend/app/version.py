"""Version d'OpenStats — source de verite unique.

Le numero vit cote backend et non dans `frontend/package.json` : le binaire
PyInstaller n'embarque pas `package.json`, et c'est lui qui doit pouvoir
annoncer sa version chez l'utilisateur, via `/health`.

Les autres emplacements (package.json, badge du README, en-tete du CHANGELOG,
nom de l'installeur dans DESKTOP_GUIDE.md) en derivent ; leur coherence est
verifiee par `tests/core/test_coherence_version.py`.
"""

VERSION = "1.3.0"
