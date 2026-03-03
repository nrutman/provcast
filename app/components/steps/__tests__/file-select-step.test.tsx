import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FileSelectStep } from "../file-select-step";

describe("FileSelectStep", () => {
  it("shows drop zone text when no file loaded", () => {
    render(<FileSelectStep />);
    expect(screen.getByText(/drop an audio file/i)).toBeInTheDocument();
  });

  it("shows supported formats", () => {
    render(<FileSelectStep />);
    expect(screen.getByText(/mp3.*wav.*flac.*ogg.*aiff/i)).toBeInTheDocument();
  });

  it("has a clickable browse area", () => {
    render(<FileSelectStep />);
    // The drop zone should have a role or be a button
    expect(screen.getByRole("button", { name: /browse/i })).toBeInTheDocument();
  });
});
