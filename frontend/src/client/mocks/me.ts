import type { Me } from "@/client/api/types";
import { companyById, db, personas, userById } from "./db";
import { computeCompleteness } from "@siip/shared/profile-completeness";

/** The mock "signed-in user" for a persona key. */
export function currentUserId(persona: string | null): string | null {
  return persona ? (personas[persona]?.userId ?? null) : null;
}

export function mockMe(persona: string | null): Me | null {
  const userId = currentUserId(persona);
  const user = userId ? userById(userId) : undefined;
  // Locked accounts (e.g. a profile SIIP removed) can't sign in, as on the server.
  if (!user || user.deletedAt) return null;
  const grad = db.graduates.find((g) => g.userId === user.id);
  const member = db.members.find((m) => m.userId === user.id);
  const company = member ? companyById(member.companyId) : undefined;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    emailVerified: user.emailVerified,
    consentAt: user.consentAt,
    graduateProfile: grad
      ? {
          id: grad.id,
          completenessScore: computeCompleteness({
            ...grad,
            cvPublicId: grad.cvUploadedAt,
            skillCount: grad.skills.length,
          }),
        }
      : null,
    companyMember:
      member && company
        ? {
            id: member.id,
            role: member.role,
            company: { id: company.id, name: company.name, verificationStatus: company.verificationStatus },
          }
        : null,
  };
}
