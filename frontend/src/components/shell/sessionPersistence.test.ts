import { describe, expect, it } from 'vitest';
import {
  getMethodologySnapshot,
  resetMethodologySession,
  updateMethodologySession,
} from '../methodology/methodologySessionStore';
import {
  getExplorerSnapshot,
  resetExplorerSession,
  updateExplorerSession,
} from '../explorer/explorerSessionStore';
import {
  getCanvasSessionSnapshot,
  saveCanvasGraphState,
  saveCanvasPipelineState,
} from '../canvas/canvasSessionStore';
import {
  getWizardSnapshot,
  updateWizardSession,
} from '../wizard/wizardSessionStore';

describe('Persistance inter-onglets des analyses', () => {
  it('conserve les résultats méthodologie par datasetId', () => {
    updateMethodologySession('ds_1', { target: 'churn', done: true });
    expect(getMethodologySnapshot('ds_1').target).toBe('churn');
    expect(getMethodologySnapshot('ds_1').done).toBe(true);
    resetMethodologySession('ds_1');
    expect(getMethodologySnapshot('ds_1').done).toBe(false);
  });

  it('conserve les paramètres et découvertes explorateur par datasetId', () => {
    updateExplorerSession('ds_2', { target: 'satisfaction', budget: 120, facts: ['linéaire'] });
    expect(getExplorerSnapshot('ds_2').budget).toBe(120);
    expect(getExplorerSnapshot('ds_2').facts).toEqual(['linéaire']);
    resetExplorerSession('ds_2');
    expect(getExplorerSnapshot('ds_2').facts).toEqual([]);
  });

  it('conserve le graphe et les résultats du Canvas en session', () => {
    saveCanvasGraphState([{ id: 'n1', position: { x: 0, y: 0 }, data: {} }], []);
    saveCanvasPipelineState({ n1: { status: 'success', message: 'OK' } }, true);
    const snap = getCanvasSessionSnapshot();
    expect(snap.nodes).toHaveLength(1);
    expect(snap.pipelineResults?.n1.status).toBe('success');
    expect(snap.showResults).toBe(true);
  });

  it('conserve l’étape et les résultats de l’atelier libre par datasetId', () => {
    updateWizardSession('ds_3', { wizardStep: 'results', vif: [{ variable: 'x', vif: 1.5, multicollinearity: 'low' }] });
    expect(getWizardSnapshot('ds_3').wizardStep).toBe('results');
    expect(getWizardSnapshot('ds_3').vif).toHaveLength(1);
  });
});
