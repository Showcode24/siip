"use client";

import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, SearchX, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { publicApi } from "@/client/api/admin";
import { ApiError } from "@/client/api/http";
import { PageHero } from "@/components/marketing/page-hero";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/display";
import { Input } from "@/components/ui/form-controls";
import { formatDate } from "@/lib/utils";

function Verify() {
  const params = useSearchParams();
  const router = useRouter();
  const code = (params.get("code") ?? "").trim().toUpperCase();
  const [value, setValue] = useState(code);
  const q = useQuery({
    queryKey: ["verify", code],
    queryFn: () => publicApi.verifyCertificate(code),
    enabled: code.length >= 6,
    retry: false,
  });
  const notFound = q.error instanceof ApiError && q.error.status === 404;

  return (
    <>
      <PageHero
        kicker="Certificate verification"
        title="Check a SIIP certificate"
        intro="Enter the verification code printed on the certificate. We'll confirm whether it's genuine."
      >
        <form
          className="mt-8 flex max-w-lg flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            router.replace(`/verify?code=${encodeURIComponent(value.trim().toUpperCase())}`);
          }}
        >
          <label htmlFor="code" className="sr-only">
            Verification code
          </label>
          <Input
            id="code"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. K7QX-29MD"
            autoComplete="off"
            autoCapitalize="characters"
            className="h-[52px] uppercase placeholder:normal-case"
          />
          <Button type="submit" size="lg" disabled={value.trim().length < 6}>
            Verify
          </Button>
        </form>
      </PageHero>
      <section className="mx-auto max-w-4xl px-6 pb-24" aria-live="polite">
        {!code ? null : q.isLoading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : notFound ? (
          <div className="flex flex-col items-center rounded-xl border border-border bg-surface px-6 py-12 text-center">
            <SearchX className="size-10 text-danger" />
            <h2 className="mt-4 text-2xl">No certificate matches {code}</h2>
            <p className="mt-2 max-w-md text-muted-foreground">
              Check the code for typos (letters O and I are never used). If it still doesn&apos;t match, the
              certificate may not be genuine.
            </p>
          </div>
        ) : q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : q.data ? (
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-md">
            <div
              className={
                q.data.valid
                  ? "flex items-center gap-3 bg-success-soft px-6 py-4 text-success"
                  : "flex items-center gap-3 bg-danger-soft px-6 py-4 text-danger"
              }
            >
              {q.data.valid ? <BadgeCheck className="size-6" /> : <ShieldCheck className="size-6" />}
              <p className="font-semibold">
                {q.data.valid ? "This certificate is genuine" : "This certificate has been revoked"}
              </p>
            </div>
            <dl className="grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
              {[
                ["Name", q.data.graduateName],
                ["Programme", q.data.cohortName],
                ["Internship", `${q.data.roleTitle} at ${q.data.companyName}`],
                ["Issued", formatDate(q.data.issuedAt, { day: "numeric", month: "long", year: "numeric" })],
                ["Serial number", q.data.serialNumber],
                ["Verification code", code],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-sm text-muted-foreground">{k}</dt>
                  <dd className="mt-1 text-lg font-semibold break-words">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </section>
    </>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <Verify />
    </Suspense>
  );
}
