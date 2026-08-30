import { baseApi } from '../baseApi';
import type {
  ModelResults,
  TimeSeriesResults,
  MultivariateTimeSeriesResults,
  FeatureRanges,
  PredictionResult,
} from '../../types';

export const modelingEndpoints = baseApi.injectEndpoints({
  endpoints: builder => ({
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
      query: id => `/datasets/${id}/model/results`,
      providesTags: ['Model'],
    }),

    runTimeSeries: builder.mutation<
      TimeSeriesResults,
      {
        id: string;
        date_col: string;
        value_col: string;
        models?: string[];
        forecast_steps?: number;
      }
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

    getFeatureRanges: builder.query<FeatureRanges, string>({
      query: id => `/datasets/${id}/model/feature-ranges`,
      providesTags: ['Model'],
    }),

    predict: builder.mutation<
      PredictionResult,
      {
        id: string;
        features:
          | Record<string, number | string>
          | Record<string, number | string>[];
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/model/predict`,
        method: 'POST',
        body,
      }),
    }),

    recommendTests: builder.mutation<
      { recommendations: unknown[] },
      { id: string; col1: string; col2?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/recommend-tests`,
        method: 'POST',
        body,
      }),
    }),

    checkAssumptions: builder.mutation<
      { checks: unknown[]; all_passed: boolean },
      { id: string; test_type: string; [key: string]: unknown }
    >({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/check-assumptions`,
        method: 'POST',
        body,
      }),
    }),

    recommendModels: builder.mutation<
      { recommendations: unknown[] },
      { id: string; target_column: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/recommend-models`,
        method: 'POST',
        body,
      }),
    }),

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
        results: Array<{
          name: string;
          predictions_mean: number;
          predictions_std: number;
          predictions_min: number;
          predictions_max: number;
        }>;
        comparison: {
          baseline: string;
          scenarios: Array<{
            name: string;
            predictions_mean: number;
            diff_from_baseline: number;
            pct_change: number | null;
            is_baseline: boolean;
          }>;
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
      {
        scenarios: Array<{ name: string; modifications: unknown[]; n_rows: number }>;
        count: number;
      },
      string
    >({
      query: id => `/datasets/${id}/scenarios`,
    }),

    getSensitivity: builder.mutation<
      {
        analyses: Array<{
          variable: string;
          base_mean: number;
          base_std: number;
          elasticity: number | null;
          points: Array<{ value: number; prediction_mean: number }>;
        }>;
        count: number;
      },
      { id: string; variables?: string[]; n_points?: number; range_pct?: number }
    >({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/sensitivity`,
        method: 'POST',
        body,
      }),
    }),

    getTornado: builder.mutation<
      {
        baseline_prediction: number;
        sigma: number;
        bars: Array<{
          variable: string;
          pred_low: number;
          pred_high: number;
          swing: number;
          direction: string;
        }>;
      },
      { id: string; sigma?: number }
    >({
      query: ({ id, ...body }) => ({
        url: `/datasets/${id}/tornado`,
        method: 'POST',
        body,
      }),
    }),

    getPartialDependence: builder.mutation<
      {
        features: Record<
          string,
          { values: number[]; predictions: number[]; feature_mean: number }
        >;
      },
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
        distribution: {
          mean: number;
          std: number;
          min: number;
          max: number;
          q05: number;
          q25: number;
          median: number;
          q75: number;
          q95: number;
        };
        histogram: { bin_centers: number[]; counts: number[] };
      },
      {
        id: string;
        n_simulations?: number;
        noise_type?: string;
        noise_scale?: number;
        seed?: number;
      }
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
          variable: string;
          mean: number;
          std: number;
          shocks: Array<{
            sigma: number;
            value: number;
            prediction: number;
            impact: number;
            impact_pct: number | null;
          }>;
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
  }),
  overrideExisting: false,
});

export const {
  useTrainModelsMutation,
  useGetModelResultsQuery,
  useRunTimeSeriesMutation,
  useRunMultivariateTimeSeriesMutation,
  useGetFeatureRangesQuery,
  usePredictMutation,
  useRecommendTestsMutation,
  useCheckAssumptionsMutation,
  useRecommendModelsMutation,
  useCreateScenarioMutation,
  useCreatePresetScenariosMutation,
  useRunScenariosMutation,
  useListScenariosQuery,
  useGetSensitivityMutation,
  useGetTornadoMutation,
  useGetPartialDependenceMutation,
  useRunMonteCarloMutation,
  useRunStressTestMutation,
} = modelingEndpoints;
