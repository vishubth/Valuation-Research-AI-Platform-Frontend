"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth-context";
import { Spinner } from "./Spinner";

const PUBLIC_ROUTES = ["/login", "/register"];

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isPublic = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    if (isLoading) return;
    if (!user && !isPublic) {
      router.replace("/login");
    }
  }, [user, isLoading, isPublic, router]);

  if (isLoading) {
    return <Spinner label="Checking session…" />;
  }

  // Public routes always render.
  if (isPublic) {
    return <>{children}</>;
  }

  // Protected route, not authenticated → redirect is in flight.
  if (!user) {
    return <Spinner label="Redirecting to sign in…" />;
  }

  return <>{children}</>;
}
