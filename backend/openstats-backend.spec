# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_submodules
import importlib.util
import os
import sys

from PyInstaller.utils.hooks import collect_all

datas = []
binaries = []
hiddenimports = ['engineio.async_drivers.threading']
hiddenimports += collect_submodules('app')
tmp_ret = collect_all('duckdb')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]

# Les moteurs d'analyse importent ces bibliotheques a l'interieur des fonctions,
# pour ne pas ralentir le demarrage. PyInstaller analyse les imports statiques :
# sans cette declaration, elles seraient absentes du binaire et les modeles
# correspondants echoueraient silencieusement chez l'utilisateur final.
# La liste derive du registre unique (app/core/bibliotheques_optionnelles.py) :
# recopier les noms ici les ferait diverger au premier ajout de dependance.
_registre = os.path.join(os.getcwd(), 'app', 'core', 'bibliotheques_optionnelles.py')
_spec = importlib.util.spec_from_file_location('bibliotheques_optionnelles', _registre)
_module = importlib.util.module_from_spec(_spec)
# L'enregistrement prealable est indispensable : le decorateur @dataclass
# resout son module via sys.modules pendant l'execution du fichier.
sys.modules['bibliotheques_optionnelles'] = _module
_spec.loader.exec_module(_module)

for _optional in _module.MODULES:
    try:
        _ret = collect_all(_optional)
    except Exception:
        continue
    datas += _ret[0]; binaries += _ret[1]; hiddenimports += _ret[2]

# Le secret de verification des jetons de licence doit etre scelle AVANT la
# construction (scripts/sceller_secret_licence.py). Sans lui, le binaire se
# construit sans erreur mais aucune licence ne peut y etre activee : l'echec
# n'apparaitrait que chez le premier client. On le refuse donc ici.
if not os.path.exists(os.path.join(os.getcwd(), 'app', 'core', '_secret_licence.py')):
    raise SystemExit(
        "Secret de licence absent. Executez d'abord :
"
        "  OPENSTATS_SECRET_JETON=<ACTIVATION_SECRET du site> "
        "python scripts/sceller_secret_licence.py"
    )

hiddenimports += [
    'sklearn.ensemble', 'sklearn.linear_model', 'sklearn.svm', 'sklearn.neighbors',
    'sklearn.feature_selection', 'sklearn.model_selection', 'sklearn.decomposition',
    'statsmodels.tsa.arima.model', 'statsmodels.tsa.holtwinters',
    'statsmodels.tsa.stattools', 'statsmodels.stats.diagnostic',
    'statsmodels.stats.multitest', 'statsmodels.stats.outliers_influence',
    # Modules d'inference ajoutes en 1.3.0 : puissance, post-hoc, diagnostics,
    # regression quantile, modeles de comptage.
    'statsmodels.stats.power', 'statsmodels.stats.multicomp',
    'statsmodels.stats.stattools', 'statsmodels.regression.quantile_regression',
    'statsmodels.genmod.families', 'statsmodels.discrete.discrete_model',
    'statsmodels.tsa.seasonal', 'arch.univariate',
]


a = Analysis(
    ['run_desktop.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['torch', 'tensorflow', 'PySide6', 'PyQt5', 'django', 'skimage', 'pygame', 'nltk', 'jupyter', 'notebook', 'sympy', 'PIL.SpiderImagePlugin'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='openstats-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='openstats-backend',
)
