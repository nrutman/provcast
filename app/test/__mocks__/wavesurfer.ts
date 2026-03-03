import { vi } from "vitest";

// Mock @wavesurfer/react
export const useWavesurfer = vi.fn().mockReturnValue({
  wavesurfer: null,
});
