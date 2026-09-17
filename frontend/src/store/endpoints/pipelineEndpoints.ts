import { baseApi } from '../baseApi';

export const pipelineEndpoints = baseApi.injectEndpoints({
  endpoints: builder => ({
    generateReport: builder.mutation<Blob, { id: string; title?: string; organization?: string }>({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/report`,
        method: 'POST',
        body,
        responseHandler: response => response.blob(),
      }),
    }),

    generateProfessionalReport: builder.mutation<
      Blob,
      { id: string; format: 'pdf' | 'docx' | 'pptx'; title?: string }
    >({
      query: ({ id, format, title }) => ({
        url: `/datasets/${id}/report/professional/${format}`,
        method: 'POST',
        body: title ? { title } : {},
        responseHandler: response => response.blob(),
      }),
    }),

    detectPipeline: builder.query<{
      profile: {
        n_rows: number;
        n_cols: number;
        column_types: Record<string, string>;
        numeric_cols: string[];
        categorical_cols: string[];
        binary_cols: string[];
        temporal_cols: string[];
        id_cols: string[];
        discrete_cols: string[];
        suggested_target: string | null;
        target_score: number;
        problem_type: string;
        has_temporal: boolean;
        is_timeseries: boolean;
        is_panel: boolean;
        is_cross_section: boolean;
        duplicate_rows: number;
        duplicate_ratio: number;
        overall_null_rate: number;
        high_missing_cols: string[];
        near_constant_cols: string[];
        flags: string[];
        candidate_targets: Array<{ column: string; type: string; score: number }>;
        notes: string[];
        integration_orders: Record<
          string,
          {
            order: number;
            is_stationary: boolean;
            adf_p: number | null;
            kpss_p: number | null;
            error?: string;
          }
        >;
        stationarity_summary: 'all_stationary' | 'all_nonstationary' | 'mixed' | 'unknown';
        cointegration_likely: boolean;
      };
    }, { id: string; target?: string }>({
      query: ({ id, target }) =>
        `/datasets/${id}/auto-pipeline/detect${target ? `?target=${target}` : ''}`,
      providesTags: (_r, _e, { id }) => [{ type: 'Dataset', id }],
    }),

    buildPipelineRecipe: builder.mutation<
      {
        profile: any;
        recipe: {
          title: string;
          description: string;
          problem_type: string;
          target: string | null;
          estimated_duration_sec: number;
          confidence: string;
          warnings?: string[];
          steps: Array<{
            key: string;
            operation: string;
            label: string;
            rationale: string;
            params: Record<string, unknown>;
            optional: boolean;
          }>;
        };
      },
      {
        id: string;
        target?: string;
        task_type?: string;
        selected_analyses?: string[];
        custom_steps?: any[];
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/auto-pipeline/recipe`,
        method: 'POST',
        body,
      }),
    }),

    executeAutoPipeline: builder.mutation<
      {
        profile: any;
        recipe: any;
        execution: {
          title: string;
          problem_type: string;
          target: string | null;
          steps: Record<
            string,
            {
              status: 'success' | 'error' | 'skipped';
              label: string;
              operation?: string;
              duration_ms?: number;
              result?: unknown;
              error?: string;
              reason?: string;
            }
          >;
        };
      },
      {
        id: string;
        target?: string;
        task_type?: string;
        selected_analyses?: string[];
        recipe?: any;
        execute_optional?: boolean;
        exclude_columns?: string[];
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/auto-pipeline/execute`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Dataset', id }],
    }),

    generateCanvasFromRecipe: builder.mutation<
      { nodes: any[]; edges: any[] },
      {
        dataset_id: string;
        target?: string;
        task_type?: string;
        selected_analyses?: string[];
        recipe?: any;
      }
    >({
      query: ({ dataset_id, target, task_type, selected_analyses, recipe }) => ({
        url: `/datasets/${dataset_id}/auto-pipeline/canvas`,
        method: 'POST',
        body: { target, task_type, selected_analyses, recipe },
      }),
    }),

    exportCanvasCode: builder.mutation<
      {
        success: boolean;
        language: string;
        filename: string;
        code?: string;
        notebook_json?: any;
      },
      { nodes: any[]; edges: any[]; language: 'python' | 'r' | 'notebook'; dataset_name?: string }
    >({
      query: body => ({
        url: '/canvas/export_code',
        method: 'POST',
        body,
      }),
    }),

    getInsights: builder.query<
      {
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
        summary: {
          critical: number;
          warning: number;
          info: number;
          success: number;
          methodological: number;
        };
      },
      string
    >({
      query: id => `/datasets/${id}/insights`,
      providesTags: (_r, _e, id) => [
        { type: 'Dataset', id },
        { type: 'Insights', id: `insights-${id}` },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGenerateReportMutation,
  useGenerateProfessionalReportMutation,
  useDetectPipelineQuery,
  useBuildPipelineRecipeMutation,
  useExecuteAutoPipelineMutation,
  useGenerateCanvasFromRecipeMutation,
  useExportCanvasCodeMutation,
  useGetInsightsQuery,
} = pipelineEndpoints;
