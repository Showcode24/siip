import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { csvResponse } from "@/server/lib/csv";
import { handle, parseQuery } from "@/server/lib/http";
import { exportApplications } from "@/server/services/export.service";
import { applicationExportQuery } from "@/server/validators/admin";

// Returns text/csv (not the JSON envelope) so it downloads directly.
export const GET = handle(async (req) => {
  const admin = await requireAdmin(req);
  const csv = await exportApplications(toAuditActor(admin), parseQuery(req, applicationExportQuery));
  return csvResponse(`siip-applications-${new Date().toISOString().slice(0, 10)}.csv`, csv);
});
