import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MetadataStep } from "../MetadataStep";

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

  it("updates the title field when the user types", async () => {
    const user = userEvent.setup();
    render(<MetadataStep />);

    const titleInput = screen.getByLabelText(/title/i);
    await user.clear(titleInput);
    await user.type(titleInput, "My Podcast Episode");

    expect(titleInput).toHaveValue("My Podcast Episode");
  });

  it("updates the artist field when the user types", async () => {
    const user = userEvent.setup();
    render(<MetadataStep />);

    const artistInput = screen.getByLabelText(/artist/i);
    await user.clear(artistInput);
    await user.type(artistInput, "John Doe");

    expect(artistInput).toHaveValue("John Doe");
  });

  it("updates the year field when the user types", async () => {
    const user = userEvent.setup();
    render(<MetadataStep />);

    const yearInput = screen.getByLabelText(/year/i);
    await user.clear(yearInput);
    await user.type(yearInput, "2026");

    expect(yearInput).toHaveValue("2026");
  });
});
