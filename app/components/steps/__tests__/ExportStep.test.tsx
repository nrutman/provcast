import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportStep } from "../ExportStep";

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

  it("switches to VBR mode when VBR button is clicked", async () => {
    const user = userEvent.setup();
    render(<ExportStep />);

    // CBR bitrate buttons should be visible initially
    expect(screen.getByRole("button", { name: "128" })).toBeInTheDocument();

    // Click VBR
    await user.click(screen.getByRole("button", { name: /vbr/i }));

    // Bitrate buttons should disappear, VBR quality slider should appear
    expect(screen.queryByRole("button", { name: "128" })).not.toBeInTheDocument();
    expect(screen.getByText(/vbr quality/i)).toBeInTheDocument();
  });

  it("switches back to CBR mode when CBR button is clicked after VBR", async () => {
    const user = userEvent.setup();
    render(<ExportStep />);

    // Switch to VBR
    await user.click(screen.getByRole("button", { name: /vbr/i }));
    expect(screen.queryByRole("button", { name: "128" })).not.toBeInTheDocument();

    // Switch back to CBR
    await user.click(screen.getByRole("button", { name: /cbr/i }));
    expect(screen.getByRole("button", { name: "128" })).toBeInTheDocument();
  });

  it("changes selected bitrate when a bitrate button is clicked", async () => {
    const user = userEvent.setup();
    render(<ExportStep />);

    // Click the 256 bitrate button
    await user.click(screen.getByRole("button", { name: "256" }));

    // The display should show "256 kbps"
    expect(screen.getByText("256 kbps")).toBeInTheDocument();
  });

  it("toggles between mono and stereo", async () => {
    const user = userEvent.setup();
    render(<ExportStep />);

    // Click Stereo
    await user.click(screen.getByRole("button", { name: /stereo/i }));

    // Click back to Mono
    await user.click(screen.getByRole("button", { name: /mono/i }));

    // Both buttons should still be present
    expect(screen.getByRole("button", { name: /mono/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /stereo/i })).toBeInTheDocument();
  });
});
