import { create } from 'zustand';

export const useWeatherStore = create((set) => ({
  activeTab: 'dash',
  setActiveTab: (tab) => set({ activeTab: tab }),

  loc: null,
  setLoc: (loc) => set({ loc }),

  weatherData: null,
  setWeatherData: (data) => set({ weatherData: data }),

  soundingHourOffset: 0,
  setSoundingHourOffset: (offset) => set({ soundingHourOffset: offset }),

  customParcel: null,
  setCustomParcel: (parcel) => set({ customParcel: parcel }),
}));