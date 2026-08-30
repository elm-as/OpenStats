import { baseApi, type PaginatedDatasets } from '../baseApi';
import type {
  DatasetDetail,
  PreviewData,
  CleaningResult,
  DatasetVersion,
  AnalysisHistoryEntry,
  AuditLogEntry,
  TransformCatalogItem,
  TransformRecommendation,
  TransformPreview,
  TransformApplyResult,
} from '../../types';

export const datasetEndpoints = baseApi.injectEndpoints({
  endpoints: builder => ({
    listDatasets: builder.query<PaginatedDatasets, { page?: number; per_page?: number } | void>({
      query: params => {
        const p = new URLSearchParams();
        if (params && 'page' in params && params.page) p.set('page', String(params.page));
        if (params && 'per_page' in params && params.per_page)
          p.set('per_page', String(params.per_page));
        const qs = p.toString();
        return `/datasets${qs ? `?${qs}` : ''}`;
      },
      providesTags: ['Dataset'],
    }),

    getDataset: builder.query<DatasetDetail, string>({
      query: id => `/datasets/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Dataset', id }],
    }),

    uploadDataset: builder.mutation<
      { dataset_id: string; name: string; profile: unknown },
      FormData
    >({
      query: formData => ({
        url: '/datasets/upload',
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: ['Dataset'],
    }),

    switchDatasetSheet: builder.mutation<
      DatasetDetail,
      { datasetId: string; sheetName: string }
    >({
      query: ({ datasetId, sheetName }) => ({
        url: `/datasets/${datasetId}/sheet`,
        method: 'POST',
        body: { sheet_name: sheetName },
      }),
      invalidatesTags: (_r, _e, { datasetId }) => [{ type: 'Dataset', id: datasetId }],
    }),

    deleteDataset: builder.mutation<
      { message: string; dataset_id: string; name: string },
      string
    >({
      query: id => ({
        url: `/datasets/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Dataset', 'Analysis', 'Model'],
    }),

    copyDataset: builder.mutation<
      { message: string; dataset: DatasetDetail },
      { id: string; new_name?: string }
    >({
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

    cleanDataset: builder.mutation<CleaningResult, { id: string; pipeline: unknown[] }>({
      query: ({ id, pipeline }) => ({
        url: `/datasets/${id}/clean`,
        method: 'POST',
        body: { pipeline },
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Dataset', id }],
    }),

    autoClean: builder.mutation<CleaningResult, string>({
      query: id => ({
        url: `/datasets/${id}/clean/auto`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, id) => [{ type: 'Dataset', id }],
    }),

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

    getDatasetVersions: builder.query<DatasetVersion[], string>({
      query: id => `/datasets/${id}/versions`,
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

    getTransformCatalog: builder.query<{ transforms: TransformCatalogItem[] }, string>({
      query: id => `/datasets/${id}/transforms/catalog`,
    }),

    getTransformRecommendations: builder.query<
      { recommendations: TransformRecommendation[] },
      string
    >({
      query: id => `/datasets/${id}/transforms/recommend`,
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
      {
        id: string;
        transforms: { column: string; transform: string; params?: Record<string, unknown> }[];
        inplace?: boolean;
      }
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
        { type: 'Dataset', id },
        { type: 'Analysis', id },
        { type: 'Model', id },
        { type: 'Insights', id: `insights-${id}` },
        { type: 'Diagnostics', id: `diagnostics-${id}` },
      ],
    }),
  }),
  overrideExisting: false,
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
  useUpdateColumnTypeMutation,
  useGetDatasetVersionsQuery,
  useRestoreVersionMutation,
  useGetAnalysisHistoryQuery,
  useGetAuditTrailQuery,
  useGetTransformCatalogQuery,
  useGetTransformRecommendationsQuery,
  usePreviewTransformMutation,
  useApplyTransformsMutation,
  useComputeVariableMutation,
} = datasetEndpoints;
