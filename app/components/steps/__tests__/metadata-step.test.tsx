import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetadataStep } from "../metadata-step";

describe("MetadataStep", () => {
  it("renders album art section", () => {
    render(<MetadataStep />);
    expect(screen.getByText(/album art/i)).toBeInTheDocument();
  });

  it("renders choose image button", () => {
    render(<MetadataStep />);
    expect(screen.getByRole("button", { name: /choose image/i })).toBeInTheDocument();
  });

  it("renders metadata input fields", () => {
    render(<MetadataStep />);
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/artist/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/album/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/genre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/year/i)).toBeInTheDocument();
  });

  it("renders save button", () => {
    render(<MetadataStep />);
    expect(screen.getByRole("button", { name: /save metadata/i })).toBeInTheDocument();
  });
});
