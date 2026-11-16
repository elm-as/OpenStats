const { Menu, app, dialog } = require('electron');

function sendAction(mainWindow, action) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('openstats:menu-action', action);
  }
}

/**
 * Construit la barre de menus native OS pour OpenStats Desktop.
 * Offre des raccourcis directs vers l'ingestion, les analyses et les préférences.
 */
function buildDesktopMenu(mainWindow) {
  const template = [
    {
      label: 'Fichier',
      submenu: [
        {
          label: 'Poste Données & Variables',
          accelerator: 'Alt+1',
          click: () => sendAction(mainWindow, 'navigate:/'),
        },
        {
          label: 'Importer un jeu de données…',
          accelerator: 'Ctrl+O',
          click: () => sendAction(mainWindow, 'navigate:/workflow'),
        },
        { type: 'separator' },
        {
          label: 'Paramètres & Diagnostics locaux',
          click: () => sendAction(mainWindow, 'navigate:/settings'),
        },
        { type: 'separator' },
        { role: 'quit', label: 'Quitter OpenStats' },
      ],
    },
    {
      label: 'Analyses',
      submenu: [
        {
          label: 'Explorateur Adaptatif (FDR)',
          accelerator: 'Alt+3',
          click: () => sendAction(mainWindow, 'navigate:/explorer'),
        },
        {
          label: 'Méthodologie itérative (11 étapes)',
          accelerator: 'Alt+4',
          click: () => sendAction(mainWindow, 'navigate:/analyzer'),
        },
        {
          label: 'Atelier Statistique Libre (Tests, Séries, ACP)',
          accelerator: 'Alt+Shift+4',
          click: () => sendAction(mainWindow, 'navigate:/analyzer?tab=studio'),
        },
        { type: 'separator' },
        {
          label: 'Studio Canvas Nodal',
          accelerator: 'Alt+5',
          click: () => sendAction(mainWindow, 'navigate:/canvas'),
        },
        {
          label: 'Recettes & Extensions',
          accelerator: 'Alt+6',
          click: () => sendAction(mainWindow, 'navigate:/marketplace'),
        },
      ],
    },
    {
      label: 'Affichage',
      submenu: [
        {
          label: 'Basculer Thème Clair / Sombre',
          accelerator: 'Ctrl+Shift+T',
          click: () => sendAction(mainWindow, 'toggle:theme'),
        },
        {
          label: 'Basculer Densité Compacte / Confortable',
          accelerator: 'Ctrl+Shift+D',
          click: () => sendAction(mainWindow, 'toggle:density'),
        },
        {
          label: 'Ouvrir / Fermer le Bloc-notes',
          click: () => sendAction(mainWindow, 'toggle:pinned'),
        },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom par défaut' },
        { role: 'zoomIn', label: 'Zoom avant' },
        { role: 'zoomOut', label: 'Zoom arrière' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Plein écran' },
        { role: 'toggleDevTools', label: 'Console développeur' },
      ],
    },
    {
      label: 'Aide',
      submenu: [
        {
          label: 'Guide des analyses (intégré)',
          accelerator: 'F1',
          click: () => sendAction(mainWindow, 'navigate:/docs'),
        },
        {
          label: 'Palette de commandes (Ctrl+K)',
          click: () => sendAction(mainWindow, 'open:palette'),
        },
        { type: 'separator' },
        {
          label: 'À propos d’OpenStats Desktop',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'À propos d’OpenStats Desktop',
              message: `OpenStats Desktop v${app.getVersion()}`,
              detail: 'Plateforme d’analyse statistique et de Data Science locale.\nElmasCore — Licence AGPLv3.',
            });
          },
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

module.exports = { buildDesktopMenu };
