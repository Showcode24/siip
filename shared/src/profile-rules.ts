import type { UpdateProfileInput } from "./validators/graduate";

/**
 * Keeps location and NYSC fields consistent with the intern's country and type:
 * Nigerian state/LGA only exist for interns in Nigeria, and NYSC details only
 * for corps members (who are, by definition, serving).
 */
export function normaliseProfileUpdate(
  current: { country: string | null; internType: string },
  input: UpdateProfileInput,
): UpdateProfileInput {
  const data: UpdateProfileInput = { ...input };
  const country = input.country ?? current.country;
  const internType = input.internType ?? current.internType;
  if (country !== "NG") {
    data.stateOfResidence = null;
    data.lga = null;
  }
  if (internType === "NYSC_CORPS_MEMBER") {
    data.nyscStatus = "SERVING";
  } else {
    data.nyscStateCode = null;
    data.nyscBatch = null;
    data.currentPpa = null;
    if (data.nyscStatus === "SERVING" || (input.internType && current.internType === "NYSC_CORPS_MEMBER")) {
      data.nyscStatus = "COMPLETED";
    }
  }
  return data;
}
