import type {
  AnalysisCapability,
  CorrelationResult,
  DescriptiveStats,
  ModelResults,
  TestResult,
} from '../../types';
import type { StationarityResult } from '../../store/api';
import type { WizardStep } from './WizardTypes';

export interface WizardSessionState {
  wizardStep: WizardStep;
  selectedAnalysis: AnalysisCapability | null;
  configValues: Record<string, string>;
  selectedModels: string[];
  descriptiveStats: DescriptiveStats | null;
  correlations: CorrelationResult | null;
  vif: { variable: string; vif: number; multicollinearity: string }[];
  testResult: TestResult | null;
  stationarityResult: StationarityResult | null;
  modelResults: ModelResults | null;
  advancedResult: { key: string; data: unknown } | null;
  error: string | null;
}

const DEFAULT_WIZARD: WizardSessionState = {
  wizardStep: 'overview',
  selectedAnalysis: null,
  configValues: {},
  selectedModels: [],
  descriptiveStats: null,
  correlations: null,
  vif: [],
  testResult: null,
  stationarityResult: null,
  modelResults: null,
  advancedResult: null,
  error: null,
};

const sessions = new Map<string, WizardSessionState>();
const listeners = new Set<() => void>();

export function subscribeWizardStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getWizardSnapshot(datasetId?: string): WizardSessionState {
  if (!datasetId) return DEFAULT_WIZARD;
  return sessions.get(datasetId) ?? DEFAULT_WIZARD;
}

export function updateWizardSession(
  datasetId: string,
  patch: Partial<WizardSessionState>,
): void {
  const current = sessions.get(datasetId) ?? DEFAULT_WIZARD;
  sessions.set(datasetId, { ...current, ...patch });
  listeners.forEach(fn => fn());
}
