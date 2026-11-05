import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { csvResponse } from "@/server/lib/csv";
import { handle, parseQuery } from "@/server/lib/http";
import { exportPlacements } from "@/server/services/export.service";
import { placementExportQuery } from "@/server/validators/admin";

// Returns text/csv (not the JSON envelope) so it downloads directly.
export const GET = handle(async (req) => {
  const admin = await requireAdmin(req);
  const csv = await exportPlacements(toAuditActor(admin), parseQuery(req, placementExportQuery));
  return csvResponse(`siip-placements-${new Date().toISOString().slice(0, 10)}.csv`, csv);
});
