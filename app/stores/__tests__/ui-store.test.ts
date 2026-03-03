import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "../ui-store";

describe("UI Store", () => {
  beforeEach(() => {
    useUIStore.setState(useUIStore.getInitialState());
  });

  it("initializes with step 1 and no file loaded", () => {
    const state = useUIStore.getState();
    expect(state.currentStep).toBe(1);
    expect(state.fileLoaded).toBe(false);
  });

  it("setCurrentStep changes the step", () => {
    useUIStore.getState().setCurrentStep(3);
    expect(useUIStore.getState().currentStep).toBe(3);
  });

  it("setFileLoaded updates fileLoaded", () => {
    useUIStore.getState().setFileLoaded(true);
    expect(useUIStore.getState().fileLoaded).toBe(true);
  });

  it("zoom defaults to 1", () => {
    expect(useUIStore.getState().zoom).toBe(1);
  });

  it("zoomIn increases zoom", () => {
    const initial = useUIStore.getState().zoom;
    useUIStore.getState().zoomIn();
    expect(useUIStore.getState().zoom).toBeGreaterThan(initial);
  });

  it("zoomOut decreases zoom (clamped at 1)", () => {
    useUIStore.getState().setZoom(10);
    useUIStore.getState().zoomOut();
    expect(useUIStore.getState().zoom).toBeLessThan(10);
  });

  it("zoom is clamped between 1 and 500", () => {
    useUIStore.getState().setZoom(0);
    expect(useUIStore.getState().zoom).toBe(1);
    useUIStore.getState().setZoom(1000);
    expect(useUIStore.getState().zoom).toBe(500);
  });
});
