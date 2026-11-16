import type { z } from "zod";
import type {
  ApplicationStatus,
  CohortStatus,
  CompanyVerificationStatus,
  OpeningStatus,
} from "@siip/shared/enums";
import type { adminApplicationListQuery, changeStatusSchema } from "@siip/shared/validators/application";
import type { createCohortSchema, updateCohortSchema } from "@siip/shared/validators/cohort";
import { ApiError, call, callPage, get, patch, post } from "./http";
import type {
  AdminApplicationDetail,
  AdminApplicationRow,
  AdminCohort,
  AdminPlacement,
  Analytics,
  ApplicationNote,
  AuditEntry,
  CertificateVerification,
  Company,
  Opening,
  Placement,
  ReviewDetail,
  ReviewQueueRow,
  GraduateSkill,
  Suggestions,
} from "./types";
import type { ReviewQueue, profileDecisionSchema, skillDecisionSchema } from "@siip/shared/validators/review";

type AppQuery = Partial<z.input<typeof adminApplicationListQuery>>;
type StatusInput = z.input<typeof changeStatusSchema>;

export const adminApi = {
  // Skill reviews
  listReviews: (queue: ReviewQueue, q?: string) =>
    callPage(() =>
      get<ReviewQueueRow[]>("/admin/reviews", { queue, q: q && q.length >= 2 ? q : undefined, limit: 100 }),
    ),
  getReview: (graduateId: string) => call(() => get<ReviewDetail>(`/admin/reviews/${graduateId}`)),
  decideSkill: (graduateId: string, skillId: string, input: z.input<typeof skillDecisionSchema>) =>
    call(() => post<GraduateSkill>(`/admin/reviews/${graduateId}/skills/${skillId}`, input)),
  decideProfile: (graduateId: string, input: z.input<typeof profileDecisionSchema>) =>
    call(() => post<ReviewDetail>(`/admin/reviews/${graduateId}/decision`, input)),
  getSkillDocumentUrl: (documentId: string) =>
    call(() => get<{ url: string; kind: "FILE" | "LINK" }>(`/admin/skill-documents/${documentId}/url`)),

  // Cohorts
  listCohorts: () => call(() => get<AdminCohort[]>("/admin/cohorts")),
  getCohort: (id: string) => call(() => get<AdminCohort>(`/admin/cohorts/${id}`)),
  createCohort: (input: z.input<typeof createCohortSchema>) =>
    call(() => post<AdminCohort>("/admin/cohorts", input)),
  updateCohort: (id: string, input: z.input<typeof updateCohortSchema>) =>
    call(() => patch<AdminCohort>(`/admin/cohorts/${id}`, input)),
  setCohortStatus: (id: string, status: CohortStatus) =>
    call(() => post<AdminCohort>(`/admin/cohorts/${id}/status`, { status })),

  // Applications
  listApplications: (query: AppQuery = {}) =>
    callPage(() =>
      get<AdminApplicationRow[]>("/admin/applications", {
        ...query,
        status: query.status as string[] | undefined,
        limit: 100,
      }),
    ),
  getApplication: (id: string) => call(() => get<AdminApplicationDetail>(`/admin/applications/${id}`)),
  changeStatus: (id: string, input: StatusInput) =>
    call(() => post<AdminApplicationDetail>(`/admin/applications/${id}/status`, input)),
  bulkStatus: (ids: string[], input: StatusInput) =>
    call(() =>
      post<{
        succeeded: number;
        failed: number;
        results: Array<{ applicationId: string; ok: boolean; error?: { message: string } }>;
      }>("/admin/applications/bulk-status", { ...input, applicationIds: ids }),
    ),
  addNote: (id: string, body: string) =>
    call(() => post<ApplicationNote>(`/admin/applications/${id}/notes`, { body })),
  getGraduateCv: (graduateId: string) =>
    call(() => get<{ url: string; expiresAt: string }>(`/admin/graduates/${graduateId}/cv`)),

  // Companies & openings
  listCompanies: (status?: CompanyVerificationStatus) =>
    callPage(() => get<Company[]>("/admin/companies", { status, limit: 100 })),
  getCompany: (id: string) =>
    call(() =>
      get<
        Company & {
          members: Array<{
            id: string;
            role: string;
            jobTitle: string | null;
            user: { id: string; name: string; email: string };
          }>;
          openings: Array<{
            id: string;
            title: string;
            status: OpeningStatus;
            slots: number;
            country: string | null;
            city: string | null;
            state: string | null;
          }>;
        }
      >(`/admin/companies/${id}`),
    ),
  setCompanyStatus: (id: string, status: CompanyVerificationStatus, reason?: string) =>
    call(() => post<Company>(`/admin/companies/${id}/status`, { status, reason })),
  listOpenings: (status?: OpeningStatus) =>
    callPage(() => get<Opening[]>("/admin/openings", { status, limit: 100 })),

  // Matching
  getSuggestions: (openingId: string, limit = 30) =>
    call(() => get<Suggestions>("/admin/matching/suggestions", { openingId, limit })),
  proposeMatch: (openingId: string, applicationId: string) =>
    call(() => post<{ id: string }>("/admin/matches", { openingId, applicationId })),
  withdrawMatch: (id: string, reason: string) =>
    call(() => post<{ id: string }>(`/admin/matches/${id}/withdraw`, { reason })),

  // Placements & certificates
  listPlacements: () => callPage(() => get<Placement[]>("/admin/placements", { limit: 100 })),
  getPlacement: (id: string) => call(() => get<AdminPlacement>(`/admin/placements/${id}`)),
  completePlacement: (id: string) => call(() => post<AdminPlacement>(`/admin/placements/${id}/complete`)),
  terminatePlacement: (id: string, reason: string) =>
    call(() => post<AdminPlacement>(`/admin/placements/${id}/terminate`, { reason })),
  reviewPlacement: (id: string, input: { approvedForCertificate: boolean; notes?: string }) =>
    call(() => post<{ approvedForCertificate: boolean }>(`/admin/placements/${id}/review`, input)),
  issueCertificate: (id: string) =>
    call(() => post<{ id: string; serialNumber: string }>(`/admin/placements/${id}/certificate`)),

  // Reporting
  getAnalytics: (cohortId?: string) => call(() => get<Analytics>("/admin/analytics", { cohortId })),
  /** CSV export: downloads the backend's file. */
  exportCsv: async (
    kind: "applications" | "placements",
    query: { cohortId?: string; status?: ApplicationStatus[] } = {},
  ): Promise<Blob> => {
    const params = new URLSearchParams();
    if (query.cohortId) params.set("cohortId", query.cohortId);
    query.status?.forEach((s) => params.append("status", s));
    const res = await fetch(`/api/v1/admin/exports/${kind}?${params}`, { credentials: "include" });
    if (!res.ok) throw new ApiError("INTERNAL_ERROR", "Export failed. Please try again.", res.status);
    return res.blob();
  },
  listAudit: () => callPage(() => get<AuditEntry[]>("/admin/audit", { limit: 100 })),
};

export const publicApi = {
  verifyCertificate: (code: string) =>
    call(() => get<CertificateVerification>(`/public/certificates/verify/${encodeURIComponent(code)}`)),
};
