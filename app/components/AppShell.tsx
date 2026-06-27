"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { AuthGuard } from "./AuthGuard";

const NO_SHELL = ["/login", "/register"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const noShell = NO_SHELL.includes(pathname);

  if (noShell) {
    return <div className="flex flex-1 items-center justify-center">{children}</div>;
  }

  return (
    <>
      <Sidebar />
      <div className="flex flex-1 flex-col min-h-screen overflow-auto">
        <main className="flex-1 px-8 py-7">
          <AuthGuard>{children}</AuthGuard>
        </main>
      </div>
    </>
  );
}
