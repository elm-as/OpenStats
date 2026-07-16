import { configureStore } from '@reduxjs/toolkit';
import { api } from './api';
import datasetReducer from './slices/datasetSlice';

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    dataset: datasetReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
