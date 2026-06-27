"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "../../lib/api-client";
import { useAdminUsers } from "../../lib/hooks";
import { AdminGuard } from "../../components/AdminGuard";
import { Badge } from "../../components/Badge";
import { Spinner } from "../../components/Spinner";
import { ErrorBox } from "../../components/Section";
import { relativeTime } from "../../lib/format";
import type { AdminUser } from "../../lib/types";

const ROLES = ["analyst", "reviewer", "admin"];

function UserRow({ user }: { user: AdminUser }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-users"] });

  const roleMutation = useMutation({
    mutationFn: async (role: string) => {
      await apiClient.patch(`/admin/users/${user.id}/role`, { role });
    },
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Role update failed."),
  });

  const deactivateMutation = useMutation({
    mutationFn: async () => { await apiClient.patch(`/admin/users/${user.id}/deactivate`); },
    onSuccess: () => { setConfirming(false); invalidate(); },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Deactivate failed."),
  });

  const reactivateMutation = useMutation({
    mutationFn: async () => { await apiClient.patch(`/admin/users/${user.id}/reactivate`); },
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Reactivate failed."),
  });

  return (
    <tr className="border-b border-white/[0.04] last:border-0">
      <td className="px-5 py-3.5 text-slate-200">{user.email}</td>
      <td className="px-5 py-3.5 text-slate-400">{user.full_name || "—"}</td>
      <td className="px-5 py-3.5">
        <select
          value={user.role}
          disabled={roleMutation.isPending}
          onChange={(e) => { setError(null); roleMutation.mutate(e.target.value); }}
          className="rounded-lg border border-white/10 bg-[#1c2333] px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-40 [color-scheme:dark]"
        >
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </td>
      <td className="px-5 py-3.5">
        {user.is_active ? <Badge tone="green">active</Badge> : <Badge tone="gray">inactive</Badge>}
      </td>
      <td className="px-5 py-3.5 text-slate-500">{relativeTime(user.created_at)}</td>
      <td className="px-5 py-3.5">
        {user.is_active ? (
          confirming ? (
            <div className="flex items-center gap-2">
              <button
                disabled={deactivateMutation.isPending}
                onClick={() => { setError(null); deactivateMutation.mutate(); }}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-40 transition-colors"
              >
                {deactivateMutation.isPending ? "…" : "Confirm"}
              </button>
              <button onClick={() => setConfirming(false)} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => { setError(null); setConfirming(true); }}
              className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Deactivate
            </button>
          )
        ) : (
          <button
            disabled={reactivateMutation.isPending}
            onClick={() => { setError(null); reactivateMutation.mutate(); }}
            className="rounded-lg border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40 transition-colors"
          >
            {reactivateMutation.isPending ? "…" : "Reactivate"}
          </button>
        )}
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </td>
    </tr>
  );
}

function UsersTable() {
  const [role, setRole] = useState("");
  const [isActive, setIsActive] = useState("");
  const usersQuery = useAdminUsers({ role, is_active: isActive });
  const users = usersQuery.data ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Users</h1>
        <p className="mt-0.5 text-sm text-slate-500">Manage user roles and access</p>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-[#161b22]">
        <div className="flex flex-wrap items-center gap-4 border-b border-white/[0.06] px-5 py-3.5">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#1c2333] px-3 py-1.5 text-sm text-slate-300 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 [color-scheme:dark]"
          >
            <option value="">All roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select
            value={isActive}
            onChange={(e) => setIsActive(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#1c2333] px-3 py-1.5 text-sm text-slate-300 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 [color-scheme:dark]"
          >
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          {usersQuery.isFetching && <span className="text-xs text-slate-600">Refreshing…</span>}
        </div>

        {usersQuery.isLoading ? (
          <div className="px-5"><Spinner /></div>
        ) : usersQuery.isError ? (
          <div className="px-5 py-4">
            <ErrorBox>{usersQuery.error instanceof ApiError ? usersQuery.error.message : "Failed to load users."}</ErrorBox>
          </div>
        ) : users.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-600">No users found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.05]">
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Email</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Name</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Role</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Status</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Created</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => <UserRow key={u.id} user={u} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <AdminGuard>
      <UsersTable />
    </AdminGuard>
  );
}
