import { baseApi, type StationarityResult } from '../baseApi';
import type {
  DataCapabilities,
  DescriptiveStats,
  CorrelationResult,
  TestResult,
  ChartDataRequest,
  ChartDataResponse,
  PCAResult,
  CAResult,
  MCAResult,
} from '../../types';

export const analysisEndpoints = baseApi.injectEndpoints({
  endpoints: builder => ({
    getCapabilities: builder.query<DataCapabilities, string>({
      query: id => `/datasets/${id}/capabilities`,
      providesTags: (_r, _e, id) => [{ type: 'Dataset', id }],
    }),

    getExcludedColumns: builder.query<
      { excluded_columns: string[]; active_columns: string[]; all_columns: string[] },
      string
    >({
      query: id => `/datasets/${id}/excluded-columns`,
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
      query: id => ({
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

    getChartData: builder.mutation<ChartDataResponse, { id: string } & ChartDataRequest>({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/chart-data`,
        method: 'POST',
        body,
      }),
    }),

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

    getDiagnostics: builder.query<
      {
        advisories: Array<{
          severity: string;
          category: string;
          title: string;
          message: string;
          suggestion?: string;
        }>;
        count: number;
      },
      string
    >({
      query: id => `/datasets/${id}/diagnostics`,
      providesTags: (_r, _e, id) => [{ type: 'Diagnostics', id: `diagnostics-${id}` }],
    }),

    runStationarity: builder.mutation<StationarityResult, { id: string; col: string }>({
      query: ({ id, col }) => ({
        url: `/datasets/${id}/analysis/stationarity`,
        method: 'POST',
        body: { col },
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCapabilitiesQuery,
  useGetExcludedColumnsQuery,
  useSetExcludedColumnsMutation,
  useRunAnalysisMutation,
  useGetCorrelationsQuery,
  useRunTestMutation,
  useGetChartDataMutation,
  useRunPCAMutation,
  useRunCAMutation,
  useRunMCAMutation,
  useGetDiagnosticsQuery,
  useRunStationarityMutation,
} = analysisEndpoints;
