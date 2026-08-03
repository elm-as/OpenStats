import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_V1_BASE, getAnonymousClientId } from '../lib/apiBase';
import type {
  DatasetSummary, DatasetDetail, PreviewData,
  CleaningResult, DescriptiveStats, CorrelationResult,
  TestResult, ModelResults, DataCapabilities,
  TimeSeriesResults, MultivariateTimeSeriesResults,
  ChartDataRequest, ChartDataResponse,
  TransformCatalogItem, TransformRecommendation,
  TransformPreview, TransformApplyResult,
  PCAResult, CAResult, MCAResult,
  FeatureRanges, PredictionResult,
  DatasetVersion, AnalysisHistoryEntry, AuditLogEntry,
  JobStatus,
  MarketplaceItemSummary, MarketplaceItemDetail,
} from '../types';

type PaginatedDatasets = { datasets: DatasetSummary[]; page: number; per_page: number; total: number; pages: number };
type PaginatedJobs = { jobs: JobStatus[]; page: number; per_page: number; total: number; pages: number; async_available: boolean };

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: API_V1_BASE,
    prepareHeaders: (headers) => {
      // Mode "anonyme" : isoler par navigateur via un identifiant stable.
      try {
        headers.set('X-Client-Id', getAnonymousClientId());
      } catch {
        // ignore (SSR / accès storage)
      }
      return headers;
    },
  }),
  tagTypes: ['Dataset', 'Analysis', 'Model', 'Insights', 'Diagnostics', 'Marketplace'],
  endpoints: (builder) => ({
    // ── Datasets ──
    listDatasets: builder.query<PaginatedDatasets, { page?: number; per_page?: number } | void>({
      query: (params) => {
        const p = new URLSearchParams();
        if (params && 'page' in params && params.page) p.set('page', String(params.page));
        if (params && 'per_page' in params && params.per_page) p.set('per_page', String(params.per_page));
        const qs = p.toString();
        return `/datasets${qs ? `?${qs}` : ''}`;
      },
      providesTags: ['Dataset'],
    }),

    getDataset: builder.query<DatasetDetail, string>({
      query: (id) => `/datasets/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Dataset', id }],
    }),

    uploadDataset: builder.mutation<
      { dataset_id: string; name: string; profile: unknown },
      FormData
    >({
      query: (formData) => ({
        url: '/datasets/upload',
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: ['Dataset'],
    }),

    switchDatasetSheet: builder.mutation<DatasetDetail, { datasetId: string; sheetName: string }>({
      query: ({ datasetId, sheetName }) => ({
        url: `/datasets/${datasetId}/sheet`,
        method: 'POST',
        body: { sheet_name: sheetName },
      }),
      invalidatesTags: (_r, _e, { datasetId }) => [{ type: 'Dataset', id: datasetId }],
    }),

    deleteDataset: builder.mutation<{ message: string; dataset_id: string; name: string }, string>({
      query: (id) => ({
        url: `/datasets/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Dataset', 'Analysis', 'Model'],
    }),

    copyDataset: builder.mutation<{ message: string; dataset: DatasetDetail }, { id: string; new_name?: string }>({
      query: ({ id, new_name }) => ({
        url: `/datasets/${id}/copy`,
        method: 'POST',
        body: new_name ? { new_name } : {},
      }),
      invalidatesTags: ['Dataset'],
    }),

    previewDataset: builder.query<PreviewData, { id: string; n?: number; cleaned?: boolean }>({
      query: ({ id, n = 50, cleaned = true }) =>
        `/datasets/${id}/preview?n=${n}&cleaned=${cleaned}`,
    }),

    // ── Nettoyage ──
    cleanDataset: builder.mutation<CleaningResult, { id: string; pipeline: unknown[] }>({
      query: ({ id, pipeline }) => ({
        url: `/datasets/${id}/clean`,
        method: 'POST',
        body: { pipeline },
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Dataset', id }],
    }),

    autoClean: builder.mutation<CleaningResult, string>({
      query: (id) => ({
        url: `/datasets/${id}/clean/auto`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, id) => [{ type: 'Dataset', id }],
    }),

    // ── Analyse ──
    getCapabilities: builder.query<DataCapabilities, string>({
      query: (id) => `/datasets/${id}/capabilities`,
      providesTags: (_r, _e, id) => [{ type: 'Dataset', id }],
    }),

    getExcludedColumns: builder.query<
      { excluded_columns: string[]; active_columns: string[]; all_columns: string[] },
      string
    >({
      query: (id) => `/datasets/${id}/excluded-columns`,
      providesTags: (_r, _e, id) => [{ type: 'Dataset', id }],
    }),

    setExcludedColumns: builder.mutation<
      { excluded_columns: string[]; active_columns: string[] },
      { id: string; excluded_columns: string[] }
    >({
      query: ({ id, excluded_columns }) => ({
        url: `/datasets/${id}/excluded-columns`,
        method: 'PUT',
        body: { excluded_columns },
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Dataset', id },
        { type: 'Insights', id: `insights-${id}` },
        { type: 'Diagnostics', id: `diagnostics-${id}` },
      ],
    }),

    runAnalysis: builder.mutation<
      { descriptive_stats: DescriptiveStats; correlations: unknown; vif: unknown },
      string
    >({
      query: (id) => ({
        url: `/datasets/${id}/analysis`,
        method: 'POST',
      }),
      invalidatesTags: ['Analysis'],
    }),

    getCorrelations: builder.query<CorrelationResult, { id: string; method?: string }>({
      query: ({ id, method = 'pearson' }) =>
        `/datasets/${id}/analysis/correlations?method=${method}`,
    }),

    runTest: builder.mutation<TestResult, { id: string; config: Record<string, string> }>({
      query: ({ id, config }) => ({
        url: `/datasets/${id}/analysis/test`,
        method: 'POST',
        body: config,
      }),
    }),

    // ── Modélisation ──
    trainModels: builder.mutation<
      ModelResults,
      {
        id: string;
        target_column: string;
        models?: string[];
        test_size?: number;
        split_strategy?: 'auto' | 'random' | 'time';
        temporal_column?: string;
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/model/train`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Model'],
    }),

    getModelResults: builder.query<ModelResults, string>({
      query: (id) => `/datasets/${id}/model/results`,
      providesTags: ['Model'],
    }),

    // ── Rapport ──
    generateReport: builder.mutation<Blob, { id: string; title?: string; organization?: string }>({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/report`,
        method: 'POST',
        body,
        responseHandler: (response) => response.blob(),
      }),
    }),

    generateProfessionalReport: builder.mutation<Blob, { id: string; format: 'pdf' | 'docx' | 'pptx'; title?: string }>({
      query: ({ id, format, title }) => ({
        url: `/datasets/${id}/report/professional/${format}`,
        method: 'POST',
        body: title ? { title } : {},
        responseHandler: (response) => response.blob(),
      }),
    }),

    // ── Séries temporelles ──
    runTimeSeries: builder.mutation<
      TimeSeriesResults,
      { id: string; date_col: string; value_col: string; models?: string[]; forecast_steps?: number }
    >({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/timeseries`,
        method: 'POST',
        body,
      }),
    }),

    runMultivariateTimeSeries: builder.mutation<
      MultivariateTimeSeriesResults,
      {
        id: string;
        date_col: string;
        value_cols: string[];
        models?: string[];
        forecast_steps?: number;
        granger_max_lag?: number;
        forced_model?: 'var' | 'vecm' | 'ardl' | 'bvar' | 'pairwise_var' | 'varmax';
        var_data_mode?: 'auto' | 'levels' | 'diff';
        var_trend?: 'c' | 'ct' | 'ctt' | 'n';
        granger_data_mode?: 'auto' | 'levels' | 'diff';
        forecast_dates?: string[];
        target_col?: string;
        bvar_lambda1?: number;
        bvar_lambda2?: number;
        max_lag?: number;
        ic_criterion?: 'aic' | 'bic' | 'hqic' | 'fpe';
        irf_periods?: number;
        fevd_periods?: number;
        confidence_level?: number;
        bootstrap_irf?: boolean;
        irf_orth?: boolean;
        vecm_det_order?: number;
        max_diff_order?: number;
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/timeseries/multivariate`,
        method: 'POST',
        body,
      }),
    }),

    // ── Graphiques ──
    getChartData: builder.mutation<
      ChartDataResponse,
      { id: string } & ChartDataRequest
    >({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/chart-data`,
        method: 'POST',
        body,
      }),
    }),

    // ── Transformations ──
    getTransformCatalog: builder.query<{ transforms: TransformCatalogItem[] }, string>({
      query: (id) => `/datasets/${id}/transforms/catalog`,
    }),

    getTransformRecommendations: builder.query<{ recommendations: TransformRecommendation[] }, string>({
      query: (id) => `/datasets/${id}/transforms/recommend`,
      providesTags: (_r, _e, id) => [{ type: 'Dataset', id }],
    }),

    previewTransform: builder.mutation<
      TransformPreview,
      { id: string; column: string; transform: string; params?: Record<string, unknown> }
    >({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/transforms/preview`,
        method: 'POST',
        body,
      }),
    }),

    applyTransforms: builder.mutation<
      TransformApplyResult,
      { id: string; transforms: { column: string; transform: string; params?: Record<string, unknown> }[]; inplace?: boolean }
    >({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/transforms/apply`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Dataset', id },
        { type: 'Insights', id: `insights-${id}` },
        { type: 'Diagnostics', id: `diagnostics-${id}` },
      ],
    }),

    computeVariable: builder.mutation<
      { applied: boolean; shape: { rows: number; columns: number } },
      { id: string; new_column: string; formula: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/compute-variable`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Dataset', id }, { type: 'Analysis', id }, { type: 'Model', id },
        { type: 'Insights', id: `insights-${id}` },
        { type: 'Diagnostics', id: `diagnostics-${id}` },
      ],
    }),

    // ── Analyse factorielle ──
    runPCA: builder.mutation<
      PCAResult,
      { id: string; columns?: string[]; n_components?: number }
    >({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/factor-analysis/pca`,
        method: 'POST',
        body,
      }),
    }),

    runCA: builder.mutation<
      CAResult,
      { id: string; row_col: string; col_col: string; n_components?: number }
    >({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/factor-analysis/ca`,
        method: 'POST',
        body,
      }),
    }),

    runMCA: builder.mutation<
      MCAResult,
      { id: string; columns?: string[]; n_components?: number }
    >({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/factor-analysis/mca`,
        method: 'POST',
        body,
      }),
    }),

    // ── Simulation / Prédiction ──
    getFeatureRanges: builder.query<FeatureRanges, string>({
      query: (id) => `/datasets/${id}/model/feature-ranges`,
      providesTags: ['Model'],
    }),

    predict: builder.mutation<
      PredictionResult,
      { id: string; features: Record<string, number> | Record<string, number>[] }
    >({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/model/predict`,
        method: 'POST',
        body,
      }),
    }),

    // ── Type de colonne ──
    updateColumnType: builder.mutation<
      { column: string; old_type: string; new_type: string; profile: unknown },
      { id: string; column: string; new_type: string }
    >({
      query: ({ id, column, new_type }) => ({
        url: `/datasets/${id}/column-type`,
        method: 'PUT',
        body: { column, new_type },
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Dataset', id }],
    }),

    // ── Versions, historique et audit ──
    getDatasetVersions: builder.query<DatasetVersion[], string>({
      query: (id) => `/datasets/${id}/versions`,
      providesTags: (_r, _e, id) => [{ type: 'Dataset', id }],
    }),

    restoreVersion: builder.mutation<DatasetVersion, { id: string; versionNumber: number }>({
      query: ({ id, versionNumber }) => ({
        url: `/datasets/${id}/versions/${versionNumber}/restore`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Dataset', id }],
    }),

    getAnalysisHistory: builder.query<AnalysisHistoryEntry[], { id: string; limit?: number }>({
      query: ({ id, limit = 50 }) => `/datasets/${id}/history?limit=${limit}`,
      providesTags: ['Analysis'],
    }),

    getAuditTrail: builder.query<AuditLogEntry[], { id: string; limit?: number }>({
      query: ({ id, limit = 100 }) => `/datasets/${id}/audit?limit=${limit}`,
      providesTags: (_r, _e, { id }) => [{ type: 'Dataset', id }],
    }),

    // ── Diagnostics & recommandations ──
    getDiagnostics: builder.query<{ advisories: Array<{ severity: string; category: string; title: string; message: string; suggestion?: string }>; count: number }, string>({
      query: (id) => `/datasets/${id}/diagnostics`,
      providesTags: (_r, _e, id) => [{ type: 'Diagnostics', id: `diagnostics-${id}` }],
    }),

    // ── Tests de stationnarité ──
    runStationarity: builder.mutation<{
      column: string; n_obs: number;
      adf: { statistic: number; p_value: number; lags_used: number; n_obs: number; critical_values: Record<string, number>; is_stationary: boolean; interpretation: string; error?: string };
      kpss: { statistic: number; p_value: number; lags_used: number; critical_values: Record<string, number>; is_stationary: boolean; interpretation: string; error?: string };
      conclusion: string; is_stationary: boolean;
    }, { id: string; col: string }>({
      query: ({ id, col }) => ({
        url: `/datasets/${id}/analysis/stationarity`,
        method: 'POST',
        body: { col },
      }),
    }),

    // ── Pipeline intelligent automatique ──
    detectPipeline: builder.query<{
      profile: {
        n_rows: number; n_cols: number;
        column_types: Record<string, string>;
        numeric_cols: string[]; categorical_cols: string[]; binary_cols: string[];
        temporal_cols: string[]; id_cols: string[]; discrete_cols: string[];
        suggested_target: string | null; target_score: number; problem_type: string;
        has_temporal: boolean; is_timeseries: boolean; is_panel: boolean; is_cross_section: boolean;
        duplicate_rows: number; duplicate_ratio: number; overall_null_rate: number;
        high_missing_cols: string[]; near_constant_cols: string[];
        flags: string[]; candidate_targets: Array<{ column: string; type: string; score: number }>;
        notes: string[];
        integration_orders: Record<string, { order: number; is_stationary: boolean; adf_p: number | null; kpss_p: number | null; error?: string }>;
        stationarity_summary: 'all_stationary' | 'all_nonstationary' | 'mixed' | 'unknown';
        cointegration_likely: boolean;
      };
    }, { id: string; target?: string }>({
      query: ({ id, target }) => `/datasets/${id}/auto-pipeline/detect${target ? `?target=${target}` : ''}`,
    }),

    buildPipelineRecipe: builder.mutation<{
      profile: any;
      recipe: {
        title: string; description: string; problem_type: string;
        target: string | null; estimated_duration_sec: number; confidence: string;
        steps: Array<{
          key: string; operation: string; label: string; rationale: string;
          params: Record<string, unknown>; optional: boolean;
        }>;
      };
    }, { id: string; target?: string }>({
      query: ({ id, target }) => ({
        url: `/datasets/${id}/auto-pipeline/recipe`,
        method: 'POST',
        body: target ? { target } : {},
      }),
    }),

    executeAutoPipeline: builder.mutation<{
      profile: any;
      recipe: any;
      execution: {
        title: string; problem_type: string; target: string | null;
        steps: Record<string, {
          status: 'success' | 'error' | 'skipped';
          label: string; operation?: string; duration_ms?: number;
          result?: unknown; error?: string; reason?: string;
        }>;
      };
    }, { id: string; target?: string; execute_optional?: boolean; exclude_columns?: string[] }>({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/auto-pipeline/execute`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Dataset', id }],
    }),

    // ── Moteur d'interprétation (insights narratifs) ──
    getInsights: builder.query<{
      insights: Array<{
        title: string;
        message: string;
        severity: 'critical' | 'warning' | 'info' | 'success' | 'methodological';
        category: string;
        confidence: 'high' | 'medium' | 'low';
        suggestion?: string | null;
        evidence?: Record<string, unknown>;
        variables?: string[];
        score: number;
        tags?: string[];
      }>;
      count: number;
      summary: { critical: number; warning: number; info: number; success: number; methodological: number };
    }, string>({
      query: (id) => `/datasets/${id}/insights`,
      providesTags: (_r, _e, id) => [
        { type: 'Dataset', id },
        { type: 'Insights', id: `insights-${id}` },
      ],
    }),

    recommendTests: builder.mutation<{ recommendations: unknown[] }, { id: string; col1: string; col2?: string }>({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/recommend-tests`,
        method: 'POST',
        body,
      }),
    }),

    checkAssumptions: builder.mutation<{ checks: unknown[]; all_passed: boolean }, { id: string; test_type: string; [key: string]: unknown }>({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/check-assumptions`,
        method: 'POST',
        body,
      }),
    }),

    recommendModels: builder.mutation<{ recommendations: unknown[] }, { id: string; target_column: string }>({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/recommend-models`,
        method: 'POST',
        body,
      }),
    }),

    // ── Jobs ──
    listJobs: builder.query<PaginatedJobs, { datasetId?: string; status?: string; page?: number; per_page?: number }>({
      query: ({ datasetId, status, page, per_page } = {}) => {
        const params = new URLSearchParams();
        if (datasetId) params.set('dataset_id', datasetId);
        if (status) params.set('status', status);
        if (page) params.set('page', String(page));
        if (per_page) params.set('per_page', String(per_page));
        return `/jobs?${params.toString()}`;
      },
    }),

    submitJob: builder.mutation<JobStatus, { dataset_id: string; task_type: string; parameters?: Record<string, unknown> }>({
      query: (body) => ({
        url: '/jobs/submit',
        method: 'POST',
        body,
      }),
    }),

    getJobStatus: builder.query<JobStatus, string>({
      query: (jobId) => `/jobs/${jobId}`,
    }),

    cancelJob: builder.mutation<JobStatus, string>({
      query: (jobId) => ({
        url: `/jobs/${jobId}/cancel`,
        method: 'POST',
      }),
    }),

    // ── Scénarios ──
    createScenario: builder.mutation<
      { name: string; modifications: unknown[]; n_rows: number },
      { id: string; name: string; modifications: Record<string, unknown> }
    >({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/scenarios/create`,
        method: 'POST',
        body,
      }),
    }),

    createPresetScenarios: builder.mutation<
      { scenarios: Array<{ name: string; modifications: unknown[]; n_rows: number }> },
      { id: string; columns?: string[] }
    >({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/scenarios/presets`,
        method: 'POST',
        body,
      }),
    }),

    runScenarios: builder.mutation<
      {
        task_type: string;
        results: Array<{ name: string; predictions_mean: number; predictions_std: number; predictions_min: number; predictions_max: number }>;
        comparison: {
          baseline: string;
          scenarios: Array<{ name: string; predictions_mean: number; diff_from_baseline: number; pct_change: number | null; is_baseline: boolean }>;
          spread: number;
        };
      },
      { id: string; scenario_names?: string[] }
    >({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/scenarios/run`,
        method: 'POST',
        body,
      }),
    }),

    listScenarios: builder.query<
      { scenarios: Array<{ name: string; modifications: unknown[]; n_rows: number }>; count: number },
      string
    >({
      query: (id) => `/datasets/${id}/scenarios`,
    }),

    getSensitivity: builder.mutation<
      { analyses: Array<{ variable: string; base_mean: number; base_std: number; elasticity: number | null; points: Array<{ value: number; prediction_mean: number }> }>; count: number },
      { id: string; variables?: string[]; n_points?: number; range_pct?: number }
    >({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/sensitivity`,
        method: 'POST',
        body,
      }),
    }),

    getTornado: builder.mutation<
      { baseline_prediction: number; sigma: number; bars: Array<{ variable: string; pred_low: number; pred_high: number; swing: number; direction: string }> },
      { id: string; sigma?: number }
    >({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/tornado`,
        method: 'POST',
        body,
      }),
    }),

    getPartialDependence: builder.mutation<
      { features: Record<string, { values: number[]; predictions: number[]; feature_mean: number }> },
      { id: string; features?: string[]; n_points?: number }
    >({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/partial-dependence`,
        method: 'POST',
        body,
      }),
    }),

    runMonteCarlo: builder.mutation<
      {
        n_simulations: number;
        distribution: { mean: number; std: number; min: number; max: number; q05: number; q25: number; median: number; q75: number; q95: number };
        histogram: { bin_centers: number[]; counts: number[] };
      },
      { id: string; n_simulations?: number; noise_type?: string; noise_scale?: number; seed?: number }
    >({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/monte-carlo`,
        method: 'POST',
        body,
      }),
    }),

    runStressTest: builder.mutation<
      {
        baseline_prediction: number;
        sigmas_tested: number[];
        variables: Array<{
          variable: string; mean: number; std: number;
          shocks: Array<{ sigma: number; value: number; prediction: number; impact: number; impact_pct: number | null }>;
        }>;
      },
      { id: string; sigmas?: number[] }
    >({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/stress-test`,
        method: 'POST',
        body,
      }),
    }),

    // ── Auth / Workspaces retirés en mode open-source local ──
    // Réactiver quand AUTH_ENABLED=true (cf. ARCHITECTURE.md)

    // ── Extensions ──
    generateExtension: builder.mutation<
      { name: string; description: string; code: string; input_config: Record<string, unknown> },
      { prompt: string; dataset_id: string }
    >({
      query: (body) => ({
        url: '/extensions/generate',
        method: 'POST',
        body,
      }),
    }),

    saveExtension: builder.mutation<
      { id: string; name: string; code: string; description: string },
      { name: string; code: string; description?: string; input_config?: Record<string, unknown> }
    >({
      query: (body) => ({
        url: '/extensions',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Analysis'],
    }),

    listExtensions: builder.query<{ id: string; name: string; description: string; code: string }[], void>({
      query: () => '/extensions',
      providesTags: ['Analysis'],
    }),

    listExtensionTemplates: builder.query<{ name: string; description: string; code: string }[], void>({
      query: () => '/extensions/templates',
    }),

    runExtension: builder.mutation<
      Record<string, unknown>,
      { script_id: string; dataset_id: string; params?: Record<string, unknown> }
    >({
      query: (body) => ({
        url: `/extensions/${body.script_id}/run`,
        method: 'POST',
        body: { dataset_id: body.dataset_id, params: body.params },
      }),
    }),

    runExtensionCode: builder.mutation<
      Record<string, unknown>,
      { code: string; dataset_id: string; params?: Record<string, unknown> }
    >({
      query: (body) => ({
        url: '/extensions/run-code',
        method: 'POST',
        body,
      }),
    }),

    // ── Marketplace ──
    listMarketplaceItems: builder.query<
      { items: MarketplaceItemSummary[]; page: number; per_page: number; total: number; pages: number },
      { category?: string; type?: string; featured?: boolean; page?: number; per_page?: number; search?: string } | void
    >({
      query: (params) => {
        const p = new URLSearchParams();
        if (params && 'category' in params && params.category) p.set('category', params.category);
        if (params && 'type' in params && params.type) p.set('type', params.type);
        if (params && 'featured' in params && params.featured !== undefined) p.set('featured', String(params.featured));
        if (params && 'page' in params && params.page) p.set('page', String(params.page));
        if (params && 'per_page' in params && params.per_page) p.set('per_page', String(params.per_page));
        if (params && 'search' in params && params.search) p.set('search', params.search);
        const qs = p.toString();
        return `/marketplace${qs ? `?${qs}` : ''}`;
      },
      providesTags: ['Marketplace'],
    }),

    getMarketplaceItem: builder.query<MarketplaceItemDetail, string>({
      query: (id) => `/marketplace/${id}`,
    }),

    exportMarketplaceItem: builder.query<MarketplaceItemDetail, string>({
      query: (id) => `/marketplace/${id}/export`,
    }),

    importMarketplaceItem: builder.mutation<MarketplaceItemDetail, Record<string, unknown>>({
      query: (body) => ({
        url: '/marketplace/import',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Marketplace'],
    }),
  }),
});

export const {
  useListDatasetsQuery,
  useGetDatasetQuery,
  useUploadDatasetMutation,
  useSwitchDatasetSheetMutation,
  useDeleteDatasetMutation,
  useCopyDatasetMutation,
  usePreviewDatasetQuery,
  useCleanDatasetMutation,
  useAutoCleanMutation,
  useGetCapabilitiesQuery,
  useGetExcludedColumnsQuery,
  useSetExcludedColumnsMutation,
  useRunAnalysisMutation,
  useGetCorrelationsQuery,
  useRunTestMutation,
  useTrainModelsMutation,
  useGetModelResultsQuery,
  useGenerateReportMutation,
  useGenerateProfessionalReportMutation,
  useRunTimeSeriesMutation,
  useRunMultivariateTimeSeriesMutation,
  useGetChartDataMutation,
  useGetTransformCatalogQuery,
  useGetTransformRecommendationsQuery,
  usePreviewTransformMutation,
  useApplyTransformsMutation,
  useComputeVariableMutation,
  useRunPCAMutation,
  useRunCAMutation,
  useRunMCAMutation,
  useGetFeatureRangesQuery,
  usePredictMutation,
  useUpdateColumnTypeMutation,
  useGetDatasetVersionsQuery,
  useRestoreVersionMutation,
  useGetAnalysisHistoryQuery,
  useGetAuditTrailQuery,
  useGetDiagnosticsQuery,
  useGetInsightsQuery,
  useDetectPipelineQuery,
  useBuildPipelineRecipeMutation,
  useExecuteAutoPipelineMutation,
  useRecommendTestsMutation,
  useCheckAssumptionsMutation,
  useRecommendModelsMutation,
  useListJobsQuery,
  useSubmitJobMutation,
  useGetJobStatusQuery,
  useCancelJobMutation,
  useCreateScenarioMutation,
  useCreatePresetScenariosMutation,
  useRunScenariosMutation,
  useListScenariosQuery,
  useGetSensitivityMutation,
  useGetTornadoMutation,
  useGetPartialDependenceMutation,
  useRunMonteCarloMutation,
  useRunStressTestMutation,
  useRunStationarityMutation,
  // Extensions
  useGenerateExtensionMutation,
  useSaveExtensionMutation,
  useListExtensionsQuery,
  useListExtensionTemplatesQuery,
  useRunExtensionMutation,
  useRunExtensionCodeMutation,
  // Marketplace
  useListMarketplaceItemsQuery,
  useGetMarketplaceItemQuery,
  useExportMarketplaceItemQuery,
  useImportMarketplaceItemMutation,
} = api;

export type StationarityResult = {
  column: string; n_obs: number;
  adf: { statistic: number; p_value: number; lags_used: number; n_obs: number; critical_values: Record<string, number>; is_stationary: boolean; interpretation: string; error?: string };
  kpss: { statistic: number; p_value: number; lags_used: number; critical_values: Record<string, number>; is_stationary: boolean; interpretation: string; error?: string };
  conclusion: string; is_stationary: boolean;
};
