import * as React from "react";

import { cn } from "@/lib/utils";

const ScrollArea = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative overflow-auto",
        "[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2",
        "[&::-webkit-scrollbar-track]:bg-transparent",
        "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border",
        "[&::-webkit-scrollbar-thumb]:hover:bg-border/80",
        "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);
ScrollArea.displayName = "ScrollArea";

const ScrollBar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    orientation?: "horizontal" | "vertical";
  }
>(({ className, orientation = "vertical", ...props }, ref) => (
  <div
    ref={ref}
    data-orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent p-px",
      orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent p-px",
      className,
    )}
    {...props}
  />
));
ScrollBar.displayName = "ScrollBar";

export { ScrollArea, ScrollBar };
