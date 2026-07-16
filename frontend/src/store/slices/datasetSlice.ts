import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface DatasetState {
  currentDatasetId: string | null;
  currentStep: 'upload' | 'profile' | 'clean' | 'analyze' | 'report';
}

const initialState: DatasetState = {
  currentDatasetId: null,
  currentStep: 'upload',
};

const datasetSlice = createSlice({
  name: 'dataset',
  initialState,
  reducers: {
    setCurrentDataset(state, action: PayloadAction<string>) {
      state.currentDatasetId = action.payload;
      state.currentStep = 'profile';
    },
    setStep(state, action: PayloadAction<DatasetState['currentStep']>) {
      state.currentStep = action.payload;
    },
    resetWorkflow(state) {
      state.currentDatasetId = null;
      state.currentStep = 'upload';
    },
  },
});

export const { setCurrentDataset, setStep, resetWorkflow } = datasetSlice.actions;
export default datasetSlice.reducer;
