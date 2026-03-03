import { type ReactNode } from "react";

interface WizardLayoutProps {
  waveform: ReactNode;
  controls: ReactNode;
  children: ReactNode;
}

export function WizardLayout({
  waveform,
  controls,
  children,
}: WizardLayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Top half: waveform */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0">{waveform}</div>
        <div className="shrink-0 border-t border-border">{controls}</div>
      </div>
      {/* Bottom half: wizard */}
      <div className="flex-1 min-h-0 border-t border-border overflow-hidden">
        {children}
      </div>
    </div>
  );
}
