import { handle, ok } from "@/server/lib/http";
import { listOpenCohorts } from "@/server/services/cohort.service";

// Public: cohorts currently accepting applications.
export const GET = handle(async () => ok(await listOpenCohorts()));
