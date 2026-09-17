# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_submodules
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
for _optional in ('xgboost', 'lightgbm', 'lifelines', 'prophet'):
    try:
        _ret = collect_all(_optional)
    except Exception:
        continue
    datas += _ret[0]; binaries += _ret[1]; hiddenimports += _ret[2]

hiddenimports += [
    'sklearn.ensemble', 'sklearn.linear_model', 'sklearn.svm', 'sklearn.neighbors',
    'sklearn.feature_selection', 'sklearn.model_selection', 'sklearn.decomposition',
    'statsmodels.tsa.arima.model', 'statsmodels.tsa.holtwinters',
    'statsmodels.tsa.stattools', 'statsmodels.stats.diagnostic',
    'statsmodels.stats.multitest', 'statsmodels.stats.outliers_influence',
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
