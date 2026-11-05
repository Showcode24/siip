import { NextResponse } from "next/server";
import { env } from "@/server/env";
import { handle, parseQuery } from "@/server/lib/http";
import { verifyEmail } from "@/server/services/auth.service";
import { verifyEmailQuery } from "@/server/validators/auth";

// Opened from the link in the verification email, so it redirects to the web app.
export const GET = handle(async (req) => {
  const signInUrl = new URL("/sign-in", env().APP_URL);
  try {
    const { token } = parseQuery(req, verifyEmailQuery);
    await verifyEmail(token);
    signInUrl.searchParams.set("verified", "1");
  } catch {
    signInUrl.searchParams.set("verified", "0");
  }
  return NextResponse.redirect(signInUrl, 303);
});
