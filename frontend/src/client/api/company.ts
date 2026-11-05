import type { z } from "zod";
import type {
  createOpeningSchema,
  registerCompanySchema,
  updateCompanySchema,
  updateOpeningSchema,
} from "@siip/shared/validators/company";
import type { checkInSchema, evaluationSchema } from "@siip/shared/validators/internship";
import type { OpeningStatus } from "@siip/shared/enums";
import { call, callPage, del, get, patch, post } from "./http";
import type {
  CheckIn,
  Company,
  CompanyMatch,
  CompanyMember,
  Evaluation,
  Invitation,
  Opening,
  Placement,
} from "./types";

const m = () => import("../mocks/company");

export const companyApi = {
  register: (input: z.input<typeof registerCompanySchema>) =>
    call(
      () => post<Company>("/company/register", input),
      async () => (await m()).register(input),
    ),
  getProfile: () =>
    call(
      () => get<Company>("/company/profile"),
      async () => (await m()).getProfile(),
      { read: true },
    ),
  updateProfile: (input: z.input<typeof updateCompanySchema>) =>
    call(
      () => patch<Company>("/company/profile", input),
      async () => (await m()).updateProfile(input),
    ),
  resubmit: () =>
    call(
      () => post<Company>("/company/resubmit"),
      async () => (await m()).resubmit(),
    ),

  listMembers: () =>
    call(
      () => get<CompanyMember[]>("/company/members"),
      async () => (await m()).listMembers(),
      { read: true },
    ),
  removeMember: (id: string) =>
    call(
      () => del<{ id: string }>(`/company/members/${id}`),
      async () => (await m()).removeMember(id),
    ),
  listInvitations: () =>
    call(
      () => get<Invitation[]>("/company/invitations"),
      async () => (await m()).listInvitations(),
      { read: true },
    ),
  invite: (email: string) =>
    call(
      () => post<Invitation>("/company/invitations", { email }),
      async () => (await m()).invite(email),
    ),
  revokeInvitation: (id: string) =>
    call(
      () => del<{ id: string }>(`/company/invitations/${id}`),
      async () => (await m()).revokeInvitation(id),
    ),
  acceptInvitation: (token: string) =>
    call(
      () => post<{ id: string }>("/company/invitations/accept", { token }),
      async () => (await m()).acceptInvitation(token),
    ),

  listOpenings: (status?: OpeningStatus) =>
    callPage(
      () => get<Opening[]>("/company/openings", { status, limit: 100 }),
      async () => (await m()).listOpenings(status),
    ),
  getOpening: (id: string) =>
    call(
      () => get<Opening>(`/company/openings/${id}`),
      async () => (await m()).getOpening(id),
      { read: true },
    ),
  createOpening: (input: z.input<typeof createOpeningSchema>) =>
    call(
      () => post<Opening>("/company/openings", input),
      async () => (await m()).createOpening(input),
    ),
  updateOpening: (id: string, input: z.input<typeof updateOpeningSchema>) =>
    call(
      () => patch<Opening>(`/company/openings/${id}`, input),
      async () => (await m()).updateOpening(id, input),
    ),
  setOpeningStatus: (id: string, status: OpeningStatus) =>
    call(
      () => post<Opening>(`/company/openings/${id}/status`, { status }),
      async () => (await m()).setOpeningStatus(id, status),
    ),

  listMatches: () =>
    callPage(
      () => get<CompanyMatch[]>("/company/matches", { limit: 100 }),
      async () => (await m()).listMatches(),
    ),
  getMatch: (id: string) =>
    call(
      () => get<CompanyMatch>(`/company/matches/${id}`),
      async () => (await m()).getMatch(id),
      { read: true },
    ),
  acceptMatch: (id: string, input: { startDate?: string; supervisorId?: string } = {}) =>
    call(
      () => post<Placement>(`/company/matches/${id}/accept`, input),
      async () => (await m()).acceptMatch(id, input),
    ),
  rejectMatch: (id: string, reason: string) =>
    call(
      () => post<{ id: string }>(`/company/matches/${id}/reject`, { reason }),
      async () => (await m()).rejectMatch(id, reason),
    ),
  getMatchCv: (id: string) =>
    call(
      () => get<{ url: string; expiresAt: string }>(`/company/matches/${id}/cv`),
      () => ({ url: "#", expiresAt: new Date().toISOString() }),
    ),

  listInterns: () =>
    callPage(
      () => get<Placement[]>("/company/interns", { limit: 100 }),
      async () => (await m()).listInterns(),
    ),
  getIntern: (id: string) =>
    call(
      () => get<Placement>(`/company/interns/${id}`),
      async () => (await m()).getIntern(id),
      { read: true },
    ),
  assignSupervisor: (id: string, supervisorId: string) =>
    call(
      () => post<Placement>(`/company/interns/${id}/supervisor`, { supervisorId }),
      async () => (await m()).assignSupervisor(id, supervisorId),
    ),
  listInternCheckIns: (id: string) =>
    call(
      () => get<CheckIn[]>(`/company/interns/${id}/check-ins`),
      async () => (await m()).listInternCheckIns(id),
      { read: true },
    ),
  submitCheckIn: (id: string, input: z.input<typeof checkInSchema>) =>
    call(
      () => post<CheckIn>(`/company/interns/${id}/check-ins`, input),
      async () => (await m()).submitCheckIn(id, input),
    ),
  getEvaluation: (id: string) =>
    call(
      () => get<Evaluation | null>(`/company/interns/${id}/evaluation`),
      async () => (await m()).getEvaluation(id),
      { read: true },
    ),
  submitEvaluation: (id: string, input: z.input<typeof evaluationSchema>) =>
    call(
      () => post<Evaluation>(`/company/interns/${id}/evaluation`, input),
      async () => (await m()).submitEvaluation(id, input),
    ),
  recordOffer: (id: string, notes?: string) =>
    call(
      () => post<Placement>(`/company/interns/${id}/permanent-offer`, { notes }),
      async () => (await m()).recordOffer(id, notes),
    ),
};
