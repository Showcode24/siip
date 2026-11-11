import type { z } from "zod";
import type {
  ApplicationStatus,
  CohortStatus,
  CompanyVerificationStatus,
  OpeningStatus,
} from "@siip/shared/enums";
import type { adminApplicationListQuery, changeStatusSchema } from "@siip/shared/validators/application";
import type { createCohortSchema, updateCohortSchema } from "@siip/shared/validators/cohort";
import { ApiError, USE_MOCKS, call, callPage, get, patch, post } from "./http";
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

const m = () => import("../mocks/admin");
type AppQuery = Partial<z.input<typeof adminApplicationListQuery>>;
type StatusInput = z.input<typeof changeStatusSchema>;

export const adminApi = {
  // Skill reviews
  listReviews: (queue: ReviewQueue, q?: string) =>
    callPage(
      () => get<ReviewQueueRow[]>("/admin/reviews", { queue, q: q && q.length >= 2 ? q : undefined, limit: 100 }),
      async () => (await m()).listReviews(queue, q),
    ),
  getReview: (graduateId: string) =>
    call(
      () => get<ReviewDetail>(`/admin/reviews/${graduateId}`),
      async () => (await m()).getReview(graduateId),
      { read: true },
    ),
  decideSkill: (graduateId: string, skillId: string, input: z.input<typeof skillDecisionSchema>) =>
    call(
      () => post<GraduateSkill>(`/admin/reviews/${graduateId}/skills/${skillId}`, input),
      async () => (await m()).decideSkill(graduateId, skillId, input),
    ),
  decideProfile: (graduateId: string, input: z.input<typeof profileDecisionSchema>) =>
    call(
      () => post<ReviewDetail>(`/admin/reviews/${graduateId}/decision`, input),
      async () => (await m()).decideProfile(graduateId, input),
    ),
  getSkillDocumentUrl: (documentId: string) =>
    call(
      () => get<{ url: string; kind: "FILE" | "LINK" }>(`/admin/skill-documents/${documentId}/url`),
      async () => (await m()).getSkillDocumentUrl(documentId),
    ),

  // Cohorts
  listCohorts: () =>
    call(
      () => get<AdminCohort[]>("/admin/cohorts"),
      async () => (await m()).listCohorts(),
      { read: true },
    ),
  getCohort: (id: string) =>
    call(
      () => get<AdminCohort>(`/admin/cohorts/${id}`),
      async () => (await m()).getCohort(id),
      { read: true },
    ),
  createCohort: (input: z.input<typeof createCohortSchema>) =>
    call(
      () => post<AdminCohort>("/admin/cohorts", input),
      async () => (await m()).createCohort(input),
    ),
  updateCohort: (id: string, input: z.input<typeof updateCohortSchema>) =>
    call(
      () => patch<AdminCohort>(`/admin/cohorts/${id}`, input),
      async () => (await m()).updateCohort(id, input),
    ),
  setCohortStatus: (id: string, status: CohortStatus) =>
    call(
      () => post<AdminCohort>(`/admin/cohorts/${id}/status`, { status }),
      async () => (await m()).setCohortStatus(id, status),
    ),

  // Applications
  listApplications: (query: AppQuery = {}) =>
    callPage(
      () =>
        get<AdminApplicationRow[]>("/admin/applications", {
          ...query,
          status: query.status as string[] | undefined,
          limit: 100,
        }),
      async () => (await m()).listApplications(query),
    ),
  getApplication: (id: string) =>
    call(
      () => get<AdminApplicationDetail>(`/admin/applications/${id}`),
      async () => (await m()).getApplication(id),
      { read: true },
    ),
  changeStatus: (id: string, input: StatusInput) =>
    call(
      () => post<AdminApplicationDetail>(`/admin/applications/${id}/status`, input),
      async () => (await m()).changeStatus(id, input),
    ),
  bulkStatus: (ids: string[], input: StatusInput) =>
    call(
      () =>
        post<{
          succeeded: number;
          failed: number;
          results: Array<{ applicationId: string; ok: boolean; error?: { message: string } }>;
        }>("/admin/applications/bulk-status", { ...input, applicationIds: ids }),
      async () => (await m()).bulkStatus(ids, input),
    ),
  addNote: (id: string, body: string) =>
    call(
      () => post<ApplicationNote>(`/admin/applications/${id}/notes`, { body }),
      async () => (await m()).addNote(id, body),
    ),
  getGraduateCv: (graduateId: string) =>
    call(
      () => get<{ url: string; expiresAt: string }>(`/admin/graduates/${graduateId}/cv`),
      () => ({ url: "#", expiresAt: new Date().toISOString() }),
    ),

  // Companies & openings
  listCompanies: (status?: CompanyVerificationStatus) =>
    callPage(
      () => get<Company[]>("/admin/companies", { status, limit: 100 }),
      async () => (await m()).listCompanies(status),
    ),
  getCompany: (id: string) =>
    call(
      () =>
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
      async () => (await m()).getCompany(id),
      { read: true },
    ),
  setCompanyStatus: (id: string, status: CompanyVerificationStatus, reason?: string) =>
    call(
      () => post<Company>(`/admin/companies/${id}/status`, { status, reason }),
      async () => (await m()).setCompanyStatus(id, status, reason),
    ),
  listOpenings: (status?: OpeningStatus) =>
    callPage(
      () => get<Opening[]>("/admin/openings", { status, limit: 100 }),
      async () => (await m()).listOpenings(status),
    ),

  // Matching
  getSuggestions: (openingId: string, limit = 30) =>
    call(
      () => get<Suggestions>("/admin/matching/suggestions", { openingId, limit }),
      async () => (await m()).getSuggestions(openingId, limit),
      { read: true },
    ),
  proposeMatch: (openingId: string, applicationId: string) =>
    call(
      () => post<{ id: string }>("/admin/matches", { openingId, applicationId }),
      async () => (await m()).proposeMatch(openingId, applicationId),
    ),
  withdrawMatch: (id: string, reason: string) =>
    call(
      () => post<{ id: string }>(`/admin/matches/${id}/withdraw`, { reason }),
      async () => (await m()).withdrawMatch(id, reason),
    ),

  // Placements & certificates
  listPlacements: () =>
    callPage(
      () => get<Placement[]>("/admin/placements", { limit: 100 }),
      async () => (await m()).listPlacements(),
    ),
  getPlacement: (id: string) =>
    call(
      () => get<AdminPlacement>(`/admin/placements/${id}`),
      async () => (await m()).getPlacement(id),
      { read: true },
    ),
  completePlacement: (id: string) =>
    call(
      () => post<AdminPlacement>(`/admin/placements/${id}/complete`),
      async () => (await m()).completePlacement(id),
    ),
  terminatePlacement: (id: string, reason: string) =>
    call(
      () => post<AdminPlacement>(`/admin/placements/${id}/terminate`, { reason }),
      async () => (await m()).terminatePlacement(id, reason),
    ),
  reviewPlacement: (id: string, input: { approvedForCertificate: boolean; notes?: string }) =>
    call(
      () => post<{ approvedForCertificate: boolean }>(`/admin/placements/${id}/review`, input),
      async () => (await m()).reviewPlacement(id, input),
    ),
  issueCertificate: (id: string) =>
    call(
      () => post<{ id: string; serialNumber: string }>(`/admin/placements/${id}/certificate`),
      async () => (await m()).issueCertificate(id),
    ),

  // Reporting
  getAnalytics: (cohortId?: string) =>
    call(
      () => get<Analytics>("/admin/analytics", { cohortId }),
      async () => (await m()).getAnalytics(cohortId),
      { read: true },
    ),
  /** CSV export. Real mode downloads the backend's file; mock mode builds one locally. */
  exportCsv: async (
    kind: "applications" | "placements",
    query: { cohortId?: string; status?: ApplicationStatus[] } = {},
  ): Promise<Blob> => {
    if (USE_MOCKS) return new Blob([(await m()).exportCsv(kind)], { type: "text/csv" });
    const params = new URLSearchParams();
    if (query.cohortId) params.set("cohortId", query.cohortId);
    query.status?.forEach((s) => params.append("status", s));
    const res = await fetch(`/api/v1/admin/exports/${kind}?${params}`, { credentials: "include" });
    if (!res.ok) throw new ApiError("INTERNAL_ERROR", "Export failed. Please try again.", res.status);
    return res.blob();
  },
  /** Backend gap: there is no audit-log list endpoint yet (see FRONTEND.md). */
  listAudit: () =>
    callPage(
      () => get<AuditEntry[]>("/admin/audit", { limit: 100 }),
      async () => (await m()).listAudit(),
    ),
};

export const publicApi = {
  verifyCertificate: (code: string) =>
    call(
      () => get<CertificateVerification>(`/public/certificates/verify/${encodeURIComponent(code)}`),
      async () => (await m()).verifyCertificate(code),
    ),
};
