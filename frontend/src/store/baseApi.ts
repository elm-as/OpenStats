import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_V1_BASE, getAnonymousClientId } from '../lib/apiBase';
import type { DatasetSummary, JobStatus } from '../types';

export type PaginatedDatasets = {
  datasets: DatasetSummary[];
  page: number;
  per_page: number;
  total: number;
  pages: number;
};

export type PaginatedJobs = {
  jobs: JobStatus[];
  page: number;
  per_page: number;
  total: number;
  pages: number;
  async_available: boolean;
};

export type StationarityResult = {
  column: string;
  n_obs: number;
  adf: {
    statistic: number;
    p_value: number;
    lags_used: number;
    n_obs: number;
    critical_values: Record<string, number>;
    is_stationary: boolean;
    interpretation: string;
    error?: string;
  };
  kpss: {
    statistic: number;
    p_value: number;
    lags_used: number;
    critical_values: Record<string, number>;
    is_stationary: boolean;
    interpretation: string;
    error?: string;
  };
  conclusion: string;
  is_stationary: boolean;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: API_V1_BASE,
    timeout: 120000,
    prepareHeaders: headers => {
      try {
        headers.set('X-Client-Id', getAnonymousClientId());
      } catch {
        // ignore (SSR / storage error)
      }
      return headers;
    },
  }),
  tagTypes: ['Dataset', 'Analysis', 'Model', 'Insights', 'Diagnostics', 'Marketplace'],
  endpoints: () => ({}),
});
