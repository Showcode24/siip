import { handle, ok } from "@/server/lib/http";
import { listSkills } from "@/server/services/graduate.service";

// Public: the skill list is needed on profile and opening forms.
export const GET = handle(async () => ok(await listSkills()));
