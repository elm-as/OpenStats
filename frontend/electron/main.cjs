const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const { spawn, execFile } = require('child_process');
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const { buildDesktopMenu } = require('./desktopMenu.cjs');

let mainWindow = null;
let splashWindow = null;
let backendProcess = null;
let backendPort = 5000;
let backendExitCode = null;
let backendErrorTail = '';
const sessionToken = crypto.randomBytes(32).toString('hex');
process.env.OPENSTATS_SESSION_TOKEN = sessionToken;

function getFreePort() {
  return new Promise((resolve) => {
    const server = require('net').createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function createSplashScreen() {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 340,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    center: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
}

async function startBackend() {
  backendPort = await getFreePort();
  backendExitCode = null;
  backendErrorTail = '';
  process.env.OPENSTATS_API_PORT = backendPort.toString();

  const isPackaged = app.isPackaged;
  const spawnEnv = {
    ...process.env,
    OPENSTATS_SESSION_TOKEN: sessionToken,
    OPENSTATS_WATCH_PARENT_STDIN: '1',
    CORS_ORIGINS: '*',
  };
  delete spawnEnv.ELECTRON_RUN_AS_NODE;

  if (isPackaged) {
    const prodExecutable = path.join(
      process.resourcesPath,
      'openstats-backend',
      'openstats-backend.exe'
    );
    if (fs.existsSync(prodExecutable)) {
      console.log(`[Electron] Démarrage du backend binaire packagé: ${prodExecutable}`);
      backendProcess = spawn(prodExecutable, [backendPort.toString()], {
        cwd: path.dirname(prodExecutable),
        env: spawnEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } else {
      console.error(`[Electron] Binaire packagé introuvable: ${prodExecutable}`);
    }
  } else {
    const backendDir = path.join(__dirname, '../../backend');
    const devScript = path.join(backendDir, 'run_desktop.py');
    const devBinary = path.join(backendDir, 'dist/openstats-backend/openstats-backend.exe');

    if (fs.existsSync(devScript)) {
      const pythonBin = process.env.PYTHON_PATH || 'python';
      console.log(`[Electron] Démarrage du backend Python (dev): ${pythonBin} ${devScript}`);
      backendProcess = spawn(pythonBin, [devScript, backendPort.toString()], {
        cwd: backendDir,
        env: spawnEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } else if (fs.existsSync(devBinary)) {
      console.log(`[Electron] Démarrage du backend binaire compilé (dev fallback): ${devBinary}`);
      backendProcess = spawn(devBinary, [backendPort.toString()], {
        cwd: path.dirname(devBinary),
        env: spawnEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    }
  }

  if (!backendProcess) {
    console.log('[Electron] Aucun backend lancé, tentative d’utilisation du serveur existant sur 5000');
    backendPort = 5000;
    process.env.OPENSTATS_API_PORT = '5000';
  }

  if (backendProcess) {
    backendProcess.stdout.on('data', (data) => {
      console.log(`[Backend stdout]: ${data}`);
    });
    backendProcess.stderr.on('data', (data) => {
      const text = data.toString();
      backendErrorTail = (backendErrorTail + text).slice(-1500);
      console.error(`[Backend stderr]: ${text}`);
    });
    backendProcess.on('exit', (code) => {
      backendExitCode = code ?? 1;
      console.log(`[Backend] Processus fermé avec le code ${code}`);
    });
  }

  pollBackendHealth(backendPort);
}

function updateSplashStatus(text) {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  const script = `const el=document.getElementById('statusMessage');if(el)el.textContent=${JSON.stringify(text)};`;
  splashWindow.webContents.executeJavaScript(script).catch(() => {});
}

function abortOnBackendFailure(reason) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
  const detail = backendErrorTail ? `\n\nDétail :\n${backendErrorTail.slice(-500)}` : '';
  dialog.showErrorBox('OpenStats Desktop — Démarrage impossible', `${reason}${detail}`);
  stopBackend();
  app.quit();
}

function pollBackendHealth(port) {
  let attempts = 0;
  const maxAttempts = 240; // Jusqu'à 120 s pour premier démarrage / antivirus Windows
  let finished = false;

  const interval = setInterval(() => {
    if (finished) return;
    attempts++;

    if (backendExitCode !== null) {
      finished = true;
      clearInterval(interval);
      abortOnBackendFailure(`Le moteur analytique Python s’est arrêté prématurément (code ${backendExitCode}).`);
      return;
    }

    if (attempts % 4 === 0) {
      updateSplashStatus(`Initialisation du moteur DuckDB & Python… (${Math.floor(attempts / 2)} s)`);
    }

    const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
      if (!finished && res.statusCode === 200) {
        finished = true;
        clearInterval(interval);
        console.log(`[Electron] Backend opérationnel sur le port ${port}`);
        createMainWindow(port);
      }
      res.resume();
    });

    req.on('error', () => {
      if (!finished && attempts >= maxAttempts) {
        finished = true;
        clearInterval(interval);
        console.error('[Electron] Impossible de joindre le backend Python');
        abortOnBackendFailure(`Délai dépassé : le backend local n'a pas répondu sur le port ${port} après 120 secondes.`);
      }
    });
  }, 500);
}

function loadDevOrFallback(url, fallbackPath) {
  const probe = http.get(url, (res) => {
    res.resume();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.loadURL(url).catch(() => mainWindow.loadFile(fallbackPath));
  });
  probe.setTimeout(800, () => probe.destroy());
  probe.on('error', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadFile(fallbackPath);
    }
  });
}

function createMainWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: 'OpenStats Desktop',
    icon: path.join(__dirname, 'icon.ico'),
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  Menu.setApplicationMenu(buildDesktopMenu(mainWindow));

  const isPackaged = app.isPackaged;
  const pageLocale = path.join(__dirname, '../dist/index.html');

  if (isPackaged) {
    mainWindow.loadFile(pageLocale);
  } else {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';
    if (devUrl.startsWith('file://')) {
      mainWindow.loadURL(devUrl).catch(() => mainWindow.loadFile(pageLocale));
    } else {
      loadDevOrFallback(devUrl, pageLocale);
    }
  }

  // Un echec de chargement laissait jusqu'ici une fenetre blanche muette :
  // l'utilisateur n'avait aucun moyen de savoir ce qui manquait.
  mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error('[OpenStats] Chargement echoue (' + code + ') : ' + description + ' - ' + url);
    const message =
      '<div style="font-family:system-ui;padding:2rem;color:#e5e7eb;background:#0b0f19;height:100vh">' +
      "<h1 style=\"font-size:1.1rem\">OpenStats n'a pas pu charger son interface</h1>" +
      '<p style="font-size:.85rem;color:#9ca3af">Erreur ' + code + ' : ' + description + '</p>' +
      '<p style="font-size:.8rem;color:#6b7280">Ressource : ' + url + '</p>' +
      '</div>';
    mainWindow.webContents
      .executeJavaScript('document.body.innerHTML = ' + JSON.stringify(message))
      .catch(() => {});
  });

  mainWindow.once('ready-to-show', () => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function stopBackend() {
  if (!backendProcess || backendProcess.killed) return;
  const proc = backendProcess;
  backendProcess = null;
  if (process.platform === 'win32' && proc.pid) {
    // Sur Windows, PyInstaller/multiprocessing crée des sous-processus non tués par proc.kill()
    execFile('taskkill', ['/pid', String(proc.pid), '/T', '/F'], () => {});
    return;
  }
  proc.kill();
}

app.whenReady().then(async () => {
  createSplashScreen();
  await startBackend();
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  stopBackend();
});
