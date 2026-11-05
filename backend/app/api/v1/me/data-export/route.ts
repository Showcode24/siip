import { requireUser } from "@/server/auth/session";
import { handle } from "@/server/lib/http";
import { exportMyData } from "@/server/services/privacy.service";
import { enforceRateLimit } from "@/server/lib/rate-limit";

// NDPA right of access: the user's data as a downloadable JSON file.
export const GET = handle(async (req) => {
  const user = await requireUser(req);
  await enforceRateLimit("dataExport", user.id);
  const data = await exportMyData(user);
  return new Response(JSON.stringify({ data, error: null, meta: null }, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="siip-my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
});
