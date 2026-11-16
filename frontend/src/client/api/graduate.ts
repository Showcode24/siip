import type { z } from "zod";
import type { ProfileReviewStatus } from "@siip/shared/enums";
import type { applySchema } from "@siip/shared/validators/application";
import type { checkInSchema } from "@siip/shared/validators/internship";
import type {
  addSkillSchema,
  updateProfileSchema,
  updateSkillSchema,
} from "@siip/shared/validators/graduate";
import { ApiError, call, callPage, del, get, patch, post } from "./http";
import type {
  CheckIn,
  Certificate,
  GraduateSkill,
  Cohort,
  GraduateProfile,
  MyApplication,
  MyPlacement,
  Notification,
  Skill,
} from "./types";

export const graduateApi = {
  getProfile: () => call(() => get<GraduateProfile>("/graduate/profile")),
  updateProfile: (input: z.input<typeof updateProfileSchema>) =>
    call(() => patch<GraduateProfile>("/graduate/profile", input)),
  // ─── Skills and the documents that prove them ──────────────────────────────
  listMySkills: () => call(() => get<GraduateSkill[]>("/graduate/skills")),
  addSkill: (input: z.input<typeof addSkillSchema>) =>
    call(() => post<GraduateSkill>("/graduate/skills", input)),
  updateSkill: (id: string, input: z.input<typeof updateSkillSchema>) =>
    call(() => patch<GraduateSkill>(`/graduate/skills/${id}`, input)),
  removeSkill: (id: string) => call(() => del<{ deleted: true }>(`/graduate/skills/${id}`)),
  /** Real: sign → upload straight to Cloudinary → confirm (the server checks type, size and owner). */
  addSkillFile: (id: string, file: File) =>
    call(async () => {
      const sig = (
        await post<{ uploadUrl: string; fields: Record<string, string>; publicId: string }>(
          `/graduate/skills/${id}/documents/sign`,
        )
      ).data;
      const form = new FormData();
      Object.entries(sig.fields).forEach(([k, v]) => form.append(k, v));
      form.append("file", file);
      const upload = await fetch(sig.uploadUrl, { method: "POST", body: form });
      if (!upload.ok)
        throw new ApiError("UPLOAD_FAILED", "The upload didn't go through. Please try again.", upload.status);
      return post<GraduateSkill>(`/graduate/skills/${id}/documents`, {
        kind: "FILE",
        publicId: sig.publicId,
        fileName: file.name,
      });
    }),
  addSkillLink: (id: string, url: string) =>
    call(() => post<GraduateSkill>(`/graduate/skills/${id}/documents`, { kind: "LINK", url })),
  removeSkillDocument: (id: string, documentId: string) =>
    call(() => del<GraduateSkill>(`/graduate/skills/${id}/documents/${documentId}`)),
  getSkillDocumentUrl: (documentId: string) =>
    call(() => get<{ url: string; kind: "FILE" | "LINK" }>(`/graduate/skill-documents/${documentId}/url`)),
  submitForReview: () =>
    call(() => post<{ reviewStatus: ProfileReviewStatus; submittedAt: string }>("/graduate/profile/submit")),

  /** Mock: pretends the browser upload to Cloudinary succeeded. Real: sign → upload → confirm. */
  uploadFile: async (kind: "cv" | "photo", file: File): Promise<GraduateProfile> =>
    call(async () => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      const sig = (
        await post<{ uploadUrl: string; fields: Record<string, string>; publicId: string }>(
          "/graduate/uploads",
          { kind, extension: ext },
        )
      ).data;
      const form = new FormData();
      Object.entries(sig.fields).forEach(([k, v]) => form.append(k, v));
      form.append("file", file);
      await fetch(sig.uploadUrl, { method: "POST", body: form });
      return post<GraduateProfile>("/graduate/uploads/confirm", { kind, publicId: sig.publicId });
    }),
  getCvUrl: () => call(() => get<{ url: string; expiresAt: string }>("/graduate/profile/cv")),

  listSkills: () => call(() => get<Skill[]>("/skills")),
  listOpenCohorts: () => call(() => get<Cohort[]>("/cohorts")),

  listApplications: () =>
    call(() =>
      get<Array<Omit<MyApplication, "timeline" | "motivation" | "rejectionReason">>>("/graduate/applications"),
    ),
  getApplication: (id: string) => call(() => get<MyApplication>(`/graduate/applications/${id}`)),
  apply: (input: z.input<typeof applySchema>) =>
    call(() => post<MyApplication>("/graduate/applications", input)),
  withdraw: (id: string, reason?: string) =>
    call(() => post<MyApplication>(`/graduate/applications/${id}/withdraw`, { reason })),

  getPlacement: () => call(() => get<MyPlacement>("/graduate/placement")),
  listCheckIns: () => call(() => get<CheckIn[]>("/graduate/placement/check-ins")),
  submitCheckIn: (input: z.input<typeof checkInSchema>) =>
    call(() => post<CheckIn>("/graduate/placement/check-ins", input)),

  listCertificates: () => call(() => get<Certificate[]>("/graduate/certificates")),
  downloadCertificate: (id: string) =>
    call(() => get<{ url: string; expiresAt: string }>(`/graduate/certificates/${id}/download`)),
};

export const notificationsApi = {
  list: (unread?: boolean) => callPage(() => get<Notification[]>("/notifications", { unread })),
  markRead: (id: string) => call(() => post<{ id: string; read: boolean }>(`/notifications/${id}/read`)),
  markAllRead: () => call(() => post<{ updated: number }>("/notifications/read-all")),
};
