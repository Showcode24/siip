import type { z } from "zod";
import type { applySchema } from "@siip/shared/validators/application";
import type { checkInSchema } from "@siip/shared/validators/internship";
import type { setSkillsSchema, updateProfileSchema } from "@siip/shared/validators/graduate";
import { call, callPage, get, patch, post, put } from "./http";
import type {
  CheckIn,
  Certificate,
  Cohort,
  GraduateProfile,
  MyApplication,
  MyPlacement,
  Notification,
  Skill,
} from "./types";

const m = () => import("../mocks/graduate");

export const graduateApi = {
  getProfile: () =>
    call(
      () => get<GraduateProfile>("/graduate/profile"),
      async () => (await m()).getProfile(),
      { read: true },
    ),
  updateProfile: (input: z.input<typeof updateProfileSchema>) =>
    call(
      () => patch<GraduateProfile>("/graduate/profile", input),
      async () => (await m()).updateProfile(input),
    ),
  setSkills: (input: z.input<typeof setSkillsSchema>) =>
    call(
      () => put<GraduateProfile>("/graduate/profile/skills", input),
      async () => (await m()).setSkills(input),
    ),

  /** Mock: pretends the browser upload to Cloudinary succeeded. Real: sign → upload → confirm. */
  uploadFile: async (kind: "cv" | "photo", file: File): Promise<GraduateProfile> =>
    call(
      async () => {
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
      },
      async () => (await m()).confirmUpload(kind, file),
    ),
  getCvUrl: () =>
    call(
      () => get<{ url: string; expiresAt: string }>("/graduate/profile/cv"),
      () => ({ url: "#", expiresAt: new Date().toISOString() }),
    ),

  listSkills: () =>
    call(
      () => get<Skill[]>("/skills"),
      async () => (await m()).listSkills(),
      { read: true },
    ),
  listOpenCohorts: () =>
    call(
      () => get<Cohort[]>("/cohorts"),
      async () => (await m()).listOpenCohorts(),
      { read: true },
    ),

  listApplications: () =>
    call(
      () =>
        get<Array<Omit<MyApplication, "timeline" | "motivation" | "rejectionReason">>>(
          "/graduate/applications",
        ),
      async () => (await m()).listApplications(),
      { read: true },
    ),
  getApplication: (id: string) =>
    call(
      () => get<MyApplication>(`/graduate/applications/${id}`),
      async () => (await m()).getApplication(id),
      { read: true },
    ),
  apply: (input: z.input<typeof applySchema>) =>
    call(
      () => post<MyApplication>("/graduate/applications", input),
      async () => (await m()).apply(input),
    ),
  withdraw: (id: string, reason?: string) =>
    call(
      () => post<MyApplication>(`/graduate/applications/${id}/withdraw`, { reason }),
      async () => (await m()).withdraw(id, reason),
    ),

  getPlacement: () =>
    call(
      () => get<MyPlacement>("/graduate/placement"),
      async () => (await m()).getPlacement(),
      { read: true },
    ),
  listCheckIns: () =>
    call(
      () => get<CheckIn[]>("/graduate/placement/check-ins"),
      async () => (await m()).listCheckIns(),
      { read: true },
    ),
  submitCheckIn: (input: z.input<typeof checkInSchema>) =>
    call(
      () => post<CheckIn>("/graduate/placement/check-ins", input),
      async () => (await m()).submitCheckIn(input),
    ),

  listCertificates: () =>
    call(
      () => get<Certificate[]>("/graduate/certificates"),
      async () => (await m()).listCertificates(),
      { read: true },
    ),
  downloadCertificate: (id: string) =>
    call(
      () => get<{ url: string; expiresAt: string }>(`/graduate/certificates/${id}/download`),
      () => ({ url: "#", expiresAt: new Date().toISOString() }),
    ),
};

export const notificationsApi = {
  list: (unread?: boolean) =>
    callPage(
      () => get<Notification[]>("/notifications", { unread }),
      async () => (await m()).listNotifications(unread),
    ),
  markRead: (id: string) =>
    call(
      () => post<{ id: string; read: boolean }>(`/notifications/${id}/read`),
      async () => (await m()).markRead(id),
    ),
  markAllRead: () =>
    call(
      () => post<{ updated: number }>("/notifications/read-all"),
      async () => (await m()).markAllRead(),
    ),
};
