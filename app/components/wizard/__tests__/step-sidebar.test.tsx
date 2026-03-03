import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StepSidebar } from "../step-sidebar";

describe("StepSidebar", () => {
  it("renders all 5 step labels", () => {
    render(<StepSidebar currentStep={1} onStepClick={() => {}} />);
    expect(screen.getByText("File")).toBeInTheDocument();
    expect(screen.getByText("Normalize")).toBeInTheDocument();
    expect(screen.getByText("Trim")).toBeInTheDocument();
    expect(screen.getByText("Metadata")).toBeInTheDocument();
    expect(screen.getByText("Export")).toBeInTheDocument();
  });

  it("highlights the current step", () => {
    render(<StepSidebar currentStep={3} onStepClick={() => {}} />);
    const trimButton = screen.getByText("Trim").closest("button");
    expect(trimButton).toHaveAttribute("data-active", "true");
  });

  it("does not highlight non-current steps", () => {
    render(<StepSidebar currentStep={3} onStepClick={() => {}} />);
    const fileButton = screen.getByText("File").closest("button");
    expect(fileButton).toHaveAttribute("data-active", "false");
  });

  it("calls onStepClick when a step is clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<StepSidebar currentStep={1} onStepClick={onClick} />);
    await user.click(screen.getByText("Export"));
    expect(onClick).toHaveBeenCalledWith(5);
  });
});
