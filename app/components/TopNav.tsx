"use client";

import Link from "next/link";
import { useAuth } from "../lib/auth-context";

export function TopNav() {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-gray-100 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-base font-semibold tracking-tight text-gray-900">VRAIP</span>
          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
            v1
          </span>
        </Link>

        {user && (
          <div className="flex items-center gap-5 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <span>{user.full_name || user.email}</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                {user.role}
              </span>
            </div>
            <Link
              href="/change-password"
              className="text-gray-400 hover:text-gray-700 transition-colors"
            >
              Change password
            </Link>
            <button
              onClick={logout}
              className="rounded-lg bg-gray-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-gray-700 transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
