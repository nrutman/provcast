import * as React from "react"

import { cn } from "@/lib/utils"

interface TooltipProviderProps {
  children: React.ReactNode
  delayDuration?: number
}

function TooltipProvider({ children }: TooltipProviderProps) {
  return <>{children}</>
}

interface TooltipProps {
  children: React.ReactNode
}

function Tooltip({ children }: TooltipProps) {
  return <div className="relative inline-flex group">{children}</div>
}

const TooltipTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, asChild, children, ...props }, ref) => {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      ref,
      className: cn((children as React.ReactElement<any>).props.className, className),
    })
  }

  return (
    <button ref={ref} type="button" className={className} {...props}>
      {children}
    </button>
  )
})
TooltipTrigger.displayName = "TooltipTrigger"

const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { side?: "top" | "bottom" | "left" | "right" }
>(({ className, side = "top", ...props }, ref) => (
  <div
    ref={ref}
    role="tooltip"
    className={cn(
      "pointer-events-none absolute z-50 hidden overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 group-hover:block",
      side === "top" && "bottom-full left-1/2 mb-2 -translate-x-1/2",
      side === "bottom" && "top-full left-1/2 mt-2 -translate-x-1/2",
      side === "left" && "right-full top-1/2 mr-2 -translate-y-1/2",
      side === "right" && "left-full top-1/2 ml-2 -translate-y-1/2",
      className
    )}
    {...props}
  />
))
TooltipContent.displayName = "TooltipContent"

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
