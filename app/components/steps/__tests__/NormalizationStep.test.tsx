import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NormalizationStep } from "../NormalizationStep";

describe("NormalizationStep", () => {
  it("renders compression section", () => {
    render(<NormalizationStep />);
    expect(screen.getByText("Compression")).toBeInTheDocument();
  });

  it("renders noise reduction section", () => {
    render(<NormalizationStep />);
    expect(screen.getByText("Noise Reduction")).toBeInTheDocument();
  });

  it("shows default compression parameters", () => {
    render(<NormalizationStep />);
    expect(screen.getByText(/-20/)).toBeInTheDocument();
    expect(screen.getByText(/4:1/)).toBeInTheDocument();
  });

  it("shows A/B toggle buttons for compression", () => {
    render(<NormalizationStep />);
    const buttons = screen.getAllByRole("button");
    const originalButtons = buttons.filter((b) => b.textContent?.includes("Original"));
    expect(originalButtons.length).toBeGreaterThan(0);
  });

  it("shows apply buttons", () => {
    render(<NormalizationStep />);
    const applyButtons = screen
      .getAllByRole("button")
      .filter((b) => b.textContent?.match(/apply/i));
    expect(applyButtons.length).toBeGreaterThanOrEqual(2); // One for compression, one for noise reduction
  });

  it("shows strength slider for noise reduction", () => {
    render(<NormalizationStep />);
    expect(screen.getByText(/strength/i)).toBeInTheDocument();
  });
});
