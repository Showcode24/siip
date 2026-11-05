import type { CompanyMemberRole, UserRole } from "@/generated/prisma/enums";
import { db } from "@/server/db";
import type { AuditActor } from "@/server/lib/audit";
import { AppError, errors } from "@/server/lib/errors";
import { getAuth } from "./auth";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  emailVerified: boolean;
}

export const ADMIN_ROLES: readonly UserRole[] = ["ADMIN", "SUPER_ADMIN"];

export function isAdmin(user: Pick<CurrentUser, "role">) {
  return ADMIN_ROLES.includes(user.role);
}

export function toAuditActor(user: Pick<CurrentUser, "id" | "role">): AuditActor {
  return { userId: user.id, role: user.role };
}

/** Reads the session from the request cookies. Returns null if signed out. */
export async function getCurrentUser(req: Request): Promise<CurrentUser | null> {
  const session = await getAuth().api.getSession({ headers: req.headers });
  if (!session) return null;
  const u = session.user as typeof session.user & { role?: string; deletedAt?: Date | null };
  if (u.deletedAt) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: (u.role ?? "GRADUATE") as UserRole,
    emailVerified: u.emailVerified,
  };
}

interface RequireOptions {
  roles?: readonly UserRole[];
}

export async function requireUser(req: Request, opts: RequireOptions = {}): Promise<CurrentUser> {
  const user = await getCurrentUser(req);
  if (!user) throw errors.unauthenticated();
  if (!user.emailVerified) {
    throw new AppError("EMAIL_NOT_VERIFIED", "Please verify your email address first");
  }
  if (opts.roles && !opts.roles.includes(user.role)) throw errors.forbidden();
  return user;
}

export function requireAdmin(req: Request) {
  return requireUser(req, { roles: ADMIN_ROLES });
}

export function requireSuperAdmin(req: Request) {
  return requireUser(req, { roles: ["SUPER_ADMIN"] });
}

export interface GraduateContext {
  user: CurrentUser;
  graduateId: string;
}

/** Signed-in graduate plus their profile id (profile is created on first access). */
export async function requireGraduate(req: Request): Promise<GraduateContext> {
  const user = await requireUser(req, { roles: ["GRADUATE"] });
  const profile = await ensureGraduateProfile(user);
  return { user, graduateId: profile.id };
}

export async function ensureGraduateProfile(user: Pick<CurrentUser, "id" | "name">) {
  const [firstName, ...rest] = user.name.trim().split(/\s+/);
  return db.graduateProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, firstName: firstName || user.name, lastName: rest.join(" ") || "-" },
    select: { id: true },
  });
}

export interface CompanyContext {
  user: CurrentUser;
  memberId: string;
  companyId: string;
  memberRole: CompanyMemberRole;
}

/**
 * Signed-in company member. Every company-scoped query must filter by the
 * returned companyId: that is how company A is kept out of company B's data.
 */
export async function requireCompanyMember(
  req: Request,
  opts: { ownerOnly?: boolean } = {},
): Promise<CompanyContext> {
  const user = await requireUser(req, { roles: ["COMPANY_MEMBER"] });
  const member = await db.companyMember.findUnique({
    where: { userId: user.id },
    select: { id: true, companyId: true, role: true },
  });
  if (!member) throw errors.forbidden("Register your company first");
  if (opts.ownerOnly && member.role !== "OWNER") {
    throw errors.forbidden("Only the company owner can do this");
  }
  return { user, memberId: member.id, companyId: member.companyId, memberRole: member.role };
}
