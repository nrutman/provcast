import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Toolbar } from "@/components/toolbar";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <Toolbar />
      <main className="flex flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
