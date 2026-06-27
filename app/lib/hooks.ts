"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiClient, type ResponseMeta } from "./api-client";
import type {
  Engagement,
  Gate,
  ResearchItem,
  MethodologyRecommendation,
  ComparableSet,
  DcfModel,
  Report,
  ReviewChecklist,
  AuditEntry,
  AdminUser,
  ConfigSetting,
} from "./types";

export function useEngagement(id: string) {
  return useQuery({
    queryKey: ["engagement", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiClient.get<Engagement>(`/engagements/${id}`);
      return res.data;
    },
  });
}

export function useGates(id: string) {
  return useQuery({
    queryKey: ["gates", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiClient.get<Gate[]>(`/engagements/${id}/gates`);
      return res.data ?? [];
    },
  });
}

export function useResearch(engagementId: string) {
  return useQuery({
    queryKey: ["research", engagementId],
    enabled: !!engagementId,
    staleTime: 30000,
    queryFn: async () => {
      const res = await apiClient.get<ResearchItem[]>(
        `/engagements/${engagementId}/research`
      );
      return res.data ?? [];
    },
  });
}

export function useMethodology(engagementId: string) {
  return useQuery({
    queryKey: ["methodology", engagementId],
    enabled: !!engagementId,
    staleTime: 30000,
    retry: false,
    queryFn: async () => {
      const res = await apiClient.get<MethodologyRecommendation>(
        `/engagements/${engagementId}/methodology`
      );
      return res.data;
    },
  });
}

export function useComparableSet(engagementId: string) {
  return useQuery({
    queryKey: ["comparable-set", engagementId],
    enabled: !!engagementId,
    staleTime: 30000,
    retry: false,
    queryFn: async () => {
      const res = await apiClient.get<ComparableSet>(
        `/engagements/${engagementId}/comparable-sets`
      );
      return res.data;
    },
  });
}

export function useDcfModel(engagementId: string) {
  return useQuery({
    queryKey: ["dcf-model", engagementId],
    enabled: !!engagementId,
    staleTime: 30000,
    retry: false,
    queryFn: async () => {
      const res = await apiClient.get<DcfModel>(
        `/engagements/${engagementId}/dcf-model`
      );
      return res.data;
    },
  });
}

export function useReport(engagementId: string) {
  return useQuery({
    queryKey: ["report", engagementId],
    enabled: !!engagementId,
    staleTime: 30000,
    retry: false,
    queryFn: async () => {
      const res = await apiClient.get<Report>(
        `/engagements/${engagementId}/report`
      );
      return res.data;
    },
  });
}

export function useReviewChecklist(engagementId: string) {
  return useQuery({
    queryKey: ["review-checklist", engagementId],
    enabled: !!engagementId,
    staleTime: 30000,
    retry: false,
    queryFn: async () => {
      const res = await apiClient.get<ReviewChecklist>(
        `/engagements/${engagementId}/review-checklist`
      );
      return res.data;
    },
  });
}

export function useAuditLog(
  engagementId: string,
  page: number,
  pageSize: number
) {
  return useQuery({
    queryKey: ["audit-log", engagementId, page, pageSize],
    enabled: !!engagementId,
    staleTime: 30000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const res = await apiClient.get<AuditEntry[]>(
        `/engagements/${engagementId}/audit-log?page=${page}&page_size=${pageSize}`
      );
      return { items: res.data ?? [], meta: res.meta as ResponseMeta };
    },
  });
}

export function useAdminUsers(filters: { role?: string; is_active?: string }) {
  return useQuery({
    queryKey: ["admin-users", filters.role ?? "", filters.is_active ?? ""],
    staleTime: 30000,
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (filters.role) qs.set("role", filters.role);
      if (filters.is_active) qs.set("is_active", filters.is_active);
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      const res = await apiClient.get<AdminUser[]>(`/admin/users${suffix}`);
      return res.data ?? [];
    },
  });
}

export function useConfig() {
  return useQuery({
    queryKey: ["config"],
    staleTime: 30000,
    queryFn: async () => {
      const res = await apiClient.get<ConfigSetting[]>(`/config`);
      return res.data ?? [];
    },
  });
}
