"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth-context";
import { Spinner } from "./Spinner";

export function AdminGuard({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const isAdmin = (user?.role ?? "").toLowerCase() === "admin";

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.replace("/?error=admin_only");
    }
  }, [isLoading, isAdmin, router]);

  if (isLoading) return <Spinner />;

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
        Admin access required. Redirecting…
      </div>
    );
  }

  return <>{children}</>;
}
