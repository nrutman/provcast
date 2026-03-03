import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "../useUIStore";

describe("UI Store", () => {
  beforeEach(() => {
    useUIStore.setState(useUIStore.getInitialState());
  });

  it("initializes with default values", () => {
    const state = useUIStore.getState();
    expect(state.currentStep).toBe(1);
    expect(state.fileLoaded).toBe(false);
    expect(state.zoom).toBe(1);
  });

  it("setCurrentStep changes the step", () => {
    useUIStore.getState().setCurrentStep(3);
    expect(useUIStore.getState().currentStep).toBe(3);
  });

  it("setFileLoaded updates fileLoaded", () => {
    useUIStore.getState().setFileLoaded(true);
    expect(useUIStore.getState().fileLoaded).toBe(true);
  });

  it("zoom is clamped between 1 and 500", () => {
    useUIStore.getState().setZoom(0);
    expect(useUIStore.getState().zoom).toBe(1);

    useUIStore.getState().setZoom(1000);
    expect(useUIStore.getState().zoom).toBe(500);

    // zoomOut at minimum stays at 1
    useUIStore.getState().setZoom(1);
    useUIStore.getState().zoomOut();
    expect(useUIStore.getState().zoom).toBe(1);

    // zoomIn at maximum stays at 500
    useUIStore.getState().setZoom(500);
    useUIStore.getState().zoomIn();
    expect(useUIStore.getState().zoom).toBe(500);
  });
});
