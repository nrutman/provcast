import { create } from "zustand";
import { temporal } from "zundo";

export interface AudioInfo {
  duration: number;
  sampleRate: number;
  channels: number;
  format: string;
  peaks: number[];
}

export interface Metadata {
  title: string;
  artist: string;
  album: string;
  genre: string;
  year: string;
  trackNumber: string;
  comment: string;
  copyright: string;
  publisher: string;
  url: string;
  albumArt: string | null;
}

export interface AudioState {
  filePath: string | null;
  audioInfo: AudioInfo | null;
  metadata: Metadata;
  isPlaying: boolean;
  playbackPosition: number;
  editCount: number;
  undoCount: number;
  redoCount: number;
  selectedRegion: { start: number; end: number } | null;

  setFile: (path: string, info: AudioInfo) => void;
  clearFile: () => void;
  setPlaying: (playing: boolean) => void;
  setPlaybackPosition: (position: number) => void;
  setSelectedRegion: (region: { start: number; end: number } | null) => void;
  updatePeaks: (peaks: number[]) => void;
  setEditCounts: (edit: number, undo: number, redo: number) => void;
  setMetadata: (metadata: Partial<Metadata>) => void;
}

const defaultMetadata: Metadata = {
  title: "",
  artist: "",
  album: "",
  genre: "Podcast",
  year: "",
  trackNumber: "",
  comment: "",
  copyright: "",
  publisher: "",
  url: "",
  albumArt: null,
};

export const useAudioStore = create<AudioState>()(
  temporal(
    (set) => ({
      filePath: null,
      audioInfo: null,
      metadata: { ...defaultMetadata },
      isPlaying: false,
      playbackPosition: 0,
      editCount: 0,
      undoCount: 0,
      redoCount: 0,
      selectedRegion: null,

      setFile: (path, info) =>
        set({
          filePath: path,
          audioInfo: info,
          playbackPosition: 0,
          isPlaying: false,
          editCount: 0,
          undoCount: 0,
          redoCount: 0,
          selectedRegion: null,
        }),

      clearFile: () =>
        set({
          filePath: null,
          audioInfo: null,
          metadata: { ...defaultMetadata },
          isPlaying: false,
          playbackPosition: 0,
          editCount: 0,
          undoCount: 0,
          redoCount: 0,
          selectedRegion: null,
        }),

      setPlaying: (playing) => set({ isPlaying: playing }),

      setPlaybackPosition: (position) => set({ playbackPosition: position }),

      setSelectedRegion: (region) => set({ selectedRegion: region }),

      updatePeaks: (peaks) =>
        set((state) => ({
          audioInfo: state.audioInfo ? { ...state.audioInfo, peaks } : null,
        })),

      setEditCounts: (edit, undo, redo) =>
        set({ editCount: edit, undoCount: undo, redoCount: redo }),

      setMetadata: (metadata) =>
        set((state) => ({
          metadata: { ...state.metadata, ...metadata },
        })),
    }),
    {
      limit: 100,
    },
  ),
);
