import { create } from "zustand";

export type WizardStep = 1 | 2 | 3 | 4 | 5;

interface UIState {
  currentStep: WizardStep;
  fileLoaded: boolean;
  zoom: number;

  setCurrentStep: (step: WizardStep) => void;
  setFileLoaded: (loaded: boolean) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
  currentStep: 1,
  fileLoaded: false,
  zoom: 1,

  setCurrentStep: (step) => set({ currentStep: step }),
  setFileLoaded: (loaded) => set({ fileLoaded: loaded }),
  setZoom: (zoom) => set({ zoom: Math.max(1, Math.min(500, zoom)) }),
  zoomIn: () => set((s) => ({ zoom: Math.min(500, s.zoom * 1.25) })),
  zoomOut: () => set((s) => ({ zoom: Math.max(1, s.zoom / 1.25) })),
}));
