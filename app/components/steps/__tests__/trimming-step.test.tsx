import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrimmingStep } from "../trimming-step";

describe("TrimmingStep", () => {
  it("renders delete and play selection buttons", () => {
    render(<TrimmingStep />);
    expect(
      screen.getByRole("button", { name: /delete selection/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /play selection/i }),
    ).toBeInTheDocument();
  });

  it("renders silence detection section", () => {
    render(<TrimmingStep />);
    expect(screen.getByText(/silence detection/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /detect silence/i }),
    ).toBeInTheDocument();
  });

  it("renders undo and redo buttons", () => {
    render(<TrimmingStep />);
    expect(screen.getByRole("button", { name: /undo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /redo/i })).toBeInTheDocument();
  });

  it("shows duration stats section", () => {
    render(<TrimmingStep />);
    expect(screen.getByText(/original/i)).toBeInTheDocument();
    expect(screen.getByText(/final/i)).toBeInTheDocument();
  });

  it("disables delete selection when no region selected", () => {
    render(<TrimmingStep />);
    expect(
      screen.getByRole("button", { name: /delete selection/i }),
    ).toBeDisabled();
  });
});
