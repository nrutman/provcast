import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExportStep } from "../export-step";

describe("ExportStep", () => {
  it("renders format display", () => {
    render(<ExportStep />);
    expect(screen.getByText("MP3")).toBeInTheDocument();
  });

  it("renders CBR/VBR toggle", () => {
    render(<ExportStep />);
    expect(screen.getByRole("button", { name: /cbr/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /vbr/i })).toBeInTheDocument();
  });

  it("renders sample rate options", () => {
    render(<ExportStep />);
    expect(screen.getByText(/44100/)).toBeInTheDocument();
  });

  it("renders mono/stereo options", () => {
    render(<ExportStep />);
    expect(screen.getByRole("button", { name: /mono/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /stereo/i })).toBeInTheDocument();
  });

  it("renders estimated file size area", () => {
    render(<ExportStep />);
    expect(screen.getByText(/estimated/i)).toBeInTheDocument();
  });

  it("renders export button", () => {
    render(<ExportStep />);
    expect(screen.getByRole("button", { name: /^export$/i })).toBeInTheDocument();
  });

  it("renders preview button", () => {
    render(<ExportStep />);
    expect(screen.getByRole("button", { name: /preview/i })).toBeInTheDocument();
  });
});
