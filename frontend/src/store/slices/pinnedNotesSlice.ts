import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface PinnedItem {
  id: string;
  title: string;
  category: 'stat' | 'model' | 'timeseries' | 'test' | 'note';
  badge?: string;
  details?: string;
  created_at: string;
}

interface PinnedNotesState {
  items: PinnedItem[];
  isOpen: boolean;
}

const initialState: PinnedNotesState = {
  items: [],
  isOpen: false,
};

export const pinnedNotesSlice = createSlice({
  name: 'pinnedNotes',
  initialState,
  reducers: {
    addPinnedItem: (state, action: PayloadAction<Omit<PinnedItem, 'id' | 'created_at'>>) => {
      const newItem: PinnedItem = {
        ...action.payload,
        id: `pin_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      state.items.unshift(newItem);
    },
    removePinnedItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(item => item.id !== action.payload);
    },
    clearAllPinnedItems: (state) => {
      state.items = [];
    },
    togglePinnedDrawer: (state) => {
      state.isOpen = !state.isOpen;
    },
    setPinnedDrawerOpen: (state, action: PayloadAction<boolean>) => {
      state.isOpen = action.payload;
    },
  },
});

export const {
  addPinnedItem,
  removePinnedItem,
  clearAllPinnedItems,
  togglePinnedDrawer,
  setPinnedDrawerOpen,
} = pinnedNotesSlice.actions;

export default pinnedNotesSlice.reducer;
