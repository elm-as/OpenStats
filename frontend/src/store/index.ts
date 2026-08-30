import { configureStore } from '@reduxjs/toolkit';
import { api } from './api';
import datasetReducer from './slices/datasetSlice';

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    dataset: datasetReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['api/executeMutation/fulfilled', 'api/subscriptions/internal_getRTKQSubscriptions'],
        ignoredPaths: ['api.mutations'],
        isSerializable: (value: unknown) =>
          typeof value === 'symbol' ||
          value instanceof Blob ||
          typeof value === 'function' ||
          typeof value !== 'object' ||
          value === null ||
          Array.isArray(value) ||
          Object.prototype.toString.call(value) === '[object Object]',
      },
    }).concat(api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
