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

export const companyApi = {
  register: (input: z.input<typeof registerCompanySchema>) =>
    call(() => post<Company>("/company/register", input)),
  getProfile: () => call(() => get<Company>("/company/profile")),
  updateProfile: (input: z.input<typeof updateCompanySchema>) =>
    call(() => patch<Company>("/company/profile", input)),
  resubmit: () => call(() => post<Company>("/company/resubmit")),

  listMembers: () => call(() => get<CompanyMember[]>("/company/members")),
  removeMember: (id: string) => call(() => del<{ id: string }>(`/company/members/${id}`)),
  listInvitations: () => call(() => get<Invitation[]>("/company/invitations")),
  invite: (email: string) => call(() => post<Invitation>("/company/invitations", { email })),
  revokeInvitation: (id: string) => call(() => del<{ id: string }>(`/company/invitations/${id}`)),
  acceptInvitation: (token: string) =>
    call(() => post<{ id: string }>("/company/invitations/accept", { token })),

  listOpenings: (status?: OpeningStatus) =>
    callPage(() => get<Opening[]>("/company/openings", { status, limit: 100 })),
  getOpening: (id: string) => call(() => get<Opening>(`/company/openings/${id}`)),
  createOpening: (input: z.input<typeof createOpeningSchema>) =>
    call(() => post<Opening>("/company/openings", input)),
  updateOpening: (id: string, input: z.input<typeof updateOpeningSchema>) =>
    call(() => patch<Opening>(`/company/openings/${id}`, input)),
  setOpeningStatus: (id: string, status: OpeningStatus) =>
    call(() => post<Opening>(`/company/openings/${id}/status`, { status })),

  listMatches: () => callPage(() => get<CompanyMatch[]>("/company/matches", { limit: 100 })),
  getMatch: (id: string) => call(() => get<CompanyMatch>(`/company/matches/${id}`)),
  acceptMatch: (id: string, input: { startDate?: string; supervisorId?: string } = {}) =>
    call(() => post<Placement>(`/company/matches/${id}/accept`, input)),
  rejectMatch: (id: string, reason: string) =>
    call(() => post<{ id: string }>(`/company/matches/${id}/reject`, { reason })),
  getMatchCv: (id: string) =>
    call(() => get<{ url: string; expiresAt: string }>(`/company/matches/${id}/cv`)),

  listInterns: () => callPage(() => get<Placement[]>("/company/interns", { limit: 100 })),
  getIntern: (id: string) => call(() => get<Placement>(`/company/interns/${id}`)),
  assignSupervisor: (id: string, supervisorId: string) =>
    call(() => post<Placement>(`/company/interns/${id}/supervisor`, { supervisorId })),
  listInternCheckIns: (id: string) => call(() => get<CheckIn[]>(`/company/interns/${id}/check-ins`)),
  submitCheckIn: (id: string, input: z.input<typeof checkInSchema>) =>
    call(() => post<CheckIn>(`/company/interns/${id}/check-ins`, input)),
  getEvaluation: (id: string) => call(() => get<Evaluation | null>(`/company/interns/${id}/evaluation`)),
  submitEvaluation: (id: string, input: z.input<typeof evaluationSchema>) =>
    call(() => post<Evaluation>(`/company/interns/${id}/evaluation`, input)),
  recordOffer: (id: string, notes?: string) =>
    call(() => post<Placement>(`/company/interns/${id}/permanent-offer`, { notes })),
};
