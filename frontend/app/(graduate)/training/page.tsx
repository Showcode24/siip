import { redirect } from "next/navigation";

// Cohorts and training are retired: interns prove their skills, SIIP checks them,
// and approved interns join the waiting list. The dashboard shows where they are.
export default function Retired() {
  redirect("/dashboard");
}
