import { create } from "zustand";

export interface UIState {
  zoom: number;
  showProcessingPanel: boolean;
  showMetadataPanel: boolean;
  exportDialogOpen: boolean;

  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  toggleProcessingPanel: () => void;
  toggleMetadataPanel: () => void;
  setExportDialogOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  zoom: 1,
  showProcessingPanel: true,
  showMetadataPanel: true,
  exportDialogOpen: false,

  setZoom: (zoom) => set({ zoom: Math.max(1, Math.min(zoom, 500)) }),
  zoomIn: () =>
    set((s) => ({ zoom: Math.min(s.zoom * 1.5, 500) })),
  zoomOut: () =>
    set((s) => ({ zoom: Math.max(s.zoom / 1.5, 1) })),
  toggleProcessingPanel: () =>
    set((s) => ({ showProcessingPanel: !s.showProcessingPanel })),
  toggleMetadataPanel: () =>
    set((s) => ({ showMetadataPanel: !s.showMetadataPanel })),
  setExportDialogOpen: (open) => set({ exportDialogOpen: open }),
}));
