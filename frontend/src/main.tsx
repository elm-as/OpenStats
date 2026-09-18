import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { store } from './store';
import App from './App';
import { ToastProvider } from './components/ui/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

/**
 * Routeur adapte au protocole de chargement.
 *
 * Sous Electron, l'interface est chargee en `file://` : l'API History dont
 * depend BrowserRouter n'y existe pas, et toute navigation rend une page vide.
 * Le routeur a base de hash fonctionne dans les deux cas ; on ne l'impose pas
 * au web, ou les URL propres restent preferables.
 */
const Routeur = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <Routeur future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ToastProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </ToastProvider>
      </Routeur>
    </Provider>
  </React.StrictMode>,
);
