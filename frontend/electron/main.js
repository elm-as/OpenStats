const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const http = require('http');

let mainWindow = null;
let splashWindow = null;
let backendProcess = null;
let backendPort = 5000;

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
  process.env.OPENSTATS_API_PORT = backendPort.toString();

  const isPackaged = app.isPackaged;
  let backendExecutable = null;

  if (isPackaged) {
    backendExecutable = path.join(
      process.resourcesPath,
      'openstats-backend',
      'openstats-backend.exe'
    );
  } else {
    // Mode Dev : chemin relatif vers le binaire ou script python
    const devBinary = path.join(__dirname, '../../backend/dist/openstats-backend/openstats-backend.exe');
    const devScript = path.join(__dirname, '../../backend/run_desktop.py');
    
    if (require('fs').existsSync(devBinary)) {
      backendExecutable = devBinary;
    } else if (require('fs').existsSync(devScript)) {
      // Démarrage fallback via python interpreter
      backendProcess = spawn('python', [devScript, backendPort.toString()]);
    }
  }

  if (backendExecutable && require('fs').existsSync(backendExecutable)) {
    console.log(`[Electron] Démarrage du backend binaire: ${backendExecutable}`);
    backendProcess = spawn(backendExecutable, [backendPort.toString()]);
  } else if (!backendProcess) {
    console.log('[Electron] Aucun binaire backend trouvé, tentative d’utilisation du serveur existant sur 5000');
    backendPort = 5000;
    process.env.OPENSTATS_API_PORT = '5000';
  }

  if (backendProcess) {
    backendProcess.stdout.on('data', (data) => {
      console.log(`[Backend stdout]: ${data}`);
    });
    backendProcess.stderr.on('data', (data) => {
      console.error(`[Backend stderr]: ${data}`);
    });
    backendProcess.on('exit', (code) => {
      console.log(`[Backend] Processus fermé avec le code ${code}`);
    });
  }

  pollBackendHealth(backendPort);
}

function pollBackendHealth(port) {
  let attempts = 0;
  const maxAttempts = 60; // 30 secondes max

  const interval = setInterval(() => {
    attempts++;
    http.get(`http://127.0.0.1:${port}/health`, (res) => {
      if (res.statusCode === 200) {
        clearInterval(interval);
        console.log(`[Electron] Backend opérationnel sur le port ${port}`);
        createMainWindow(port);
      }
    }).on('error', () => {
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        console.error('[Electron] Impossible de joindre le backend Python');
        createMainWindow(port); // tente l'ouverture quand même
      }
    });
  }, 500);
}

function createMainWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: 'OpenStats Desktop',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const isPackaged = app.isPackaged;
  if (isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    // Mode Dev : se connecte au dev server Vite si disponible, sinon fichier statique
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    mainWindow.loadURL(devUrl).catch(() => {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    });
  }

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

app.whenReady().then(async () => {
  createSplashScreen();
  await startBackend();
});

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});
