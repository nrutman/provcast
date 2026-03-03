import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WizardLayout } from "../wizard-layout";

describe("WizardLayout", () => {
  it("renders waveform area and wizard area", () => {
    render(
      <WizardLayout
        waveform={<div data-testid="waveform">Waveform</div>}
        controls={<div data-testid="controls">Controls</div>}
      >
        <div data-testid="step-content">Step Content</div>
      </WizardLayout>,
    );
    expect(screen.getByTestId("waveform")).toBeInTheDocument();
    expect(screen.getByTestId("controls")).toBeInTheDocument();
    expect(screen.getByTestId("step-content")).toBeInTheDocument();
  });
});
