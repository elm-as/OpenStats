import { baseApi, type PaginatedJobs } from '../baseApi';
import type {
  JobStatus,
  MarketplaceItemSummary,
  MarketplaceItemDetail,
} from '../../types';

export const platformEndpoints = baseApi.injectEndpoints({
  endpoints: builder => ({
    listJobs: builder.query<
      PaginatedJobs,
      { datasetId?: string; status?: string; page?: number; per_page?: number } | void
    >({
      query: (params = {}) => {
        const p = new URLSearchParams();
        if (params?.datasetId) p.set('dataset_id', params.datasetId);
        if (params?.status) p.set('status', params.status);
        if (params?.page) p.set('page', String(params.page));
        if (params?.per_page) p.set('per_page', String(params.per_page));
        return `/jobs?${p.toString()}`;
      },
    }),

    submitJob: builder.mutation<
      JobStatus,
      { dataset_id: string; task_type: string; parameters?: Record<string, unknown> }
    >({
      query: body => ({
        url: '/jobs/submit',
        method: 'POST',
        body,
      }),
    }),

    getJobStatus: builder.query<JobStatus, string>({
      query: jobId => `/jobs/${jobId}`,
    }),

    cancelJob: builder.mutation<JobStatus, string>({
      query: jobId => ({
        url: `/jobs/${jobId}/cancel`,
        method: 'POST',
      }),
    }),

    generateExtension: builder.mutation<
      { name: string; description: string; code: string; input_config: Record<string, unknown> },
      { prompt: string; dataset_id: string }
    >({
      query: body => ({
        url: '/extensions/generate',
        method: 'POST',
        body,
      }),
    }),

    saveExtension: builder.mutation<
      { id: string; name: string; code: string; description: string },
      { name: string; code: string; description?: string; input_config?: Record<string, unknown> }
    >({
      query: body => ({
        url: '/extensions',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Analysis'],
    }),

    listExtensions: builder.query<
      { id: string; name: string; description: string; code: string }[],
      void
    >({
      query: () => '/extensions',
      providesTags: ['Analysis'],
    }),

    listExtensionTemplates: builder.query<
      { name: string; description: string; code: string }[],
      void
    >({
      query: () => '/extensions/templates',
    }),

    runExtension: builder.mutation<
      Record<string, unknown>,
      { script_id: string; dataset_id: string; params?: Record<string, unknown> }
    >({
      query: body => ({
        url: `/extensions/${body.script_id}/run`,
        method: 'POST',
        body: { dataset_id: body.dataset_id, params: body.params },
      }),
    }),

    runExtensionCode: builder.mutation<
      Record<string, unknown>,
      { code: string; dataset_id: string; params?: Record<string, unknown> }
    >({
      query: body => ({
        url: '/extensions/run-code',
        method: 'POST',
        body,
      }),
    }),

    listMarketplaceItems: builder.query<
      {
        items: MarketplaceItemSummary[];
        page: number;
        per_page: number;
        total: number;
        pages: number;
      },
      | {
          category?: string;
          type?: string;
          featured?: boolean;
          page?: number;
          per_page?: number;
          search?: string;
        }
      | void
    >({
      query: params => {
        const p = new URLSearchParams();
        if (params && 'category' in params && params.category) p.set('category', params.category);
        if (params && 'type' in params && params.type) p.set('type', params.type);
        if (params && 'featured' in params && params.featured !== undefined)
          p.set('featured', String(params.featured));
        if (params && 'page' in params && params.page) p.set('page', String(params.page));
        if (params && 'per_page' in params && params.per_page)
          p.set('per_page', String(params.per_page));
        if (params && 'search' in params && params.search) p.set('search', params.search);
        const qs = p.toString();
        return `/marketplace${qs ? `?${qs}` : ''}`;
      },
      providesTags: ['Marketplace'],
    }),

    getMarketplaceItem: builder.query<MarketplaceItemDetail, string>({
      query: id => `/marketplace/${id}`,
    }),

    exportMarketplaceItem: builder.query<MarketplaceItemDetail, string>({
      query: id => `/marketplace/${id}/export`,
    }),

    importMarketplaceItem: builder.mutation<MarketplaceItemDetail, Record<string, unknown>>({
      query: body => ({
        url: '/marketplace/import',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Marketplace'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListJobsQuery,
  useSubmitJobMutation,
  useGetJobStatusQuery,
  useCancelJobMutation,
  useGenerateExtensionMutation,
  useSaveExtensionMutation,
  useListExtensionsQuery,
  useListExtensionTemplatesQuery,
  useRunExtensionMutation,
  useRunExtensionCodeMutation,
  useListMarketplaceItemsQuery,
  useGetMarketplaceItemQuery,
  useExportMarketplaceItemQuery,
  useImportMarketplaceItemMutation,
} = platformEndpoints;
