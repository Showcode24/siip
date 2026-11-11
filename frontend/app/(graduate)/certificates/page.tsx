"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, Download, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { graduateApi } from "@/client/api/graduate";
import { USE_MOCKS, errorMessage } from "@/client/api/http";
import type { Certificate } from "@/client/api/types";
import { useSession } from "@/client/session";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { formatDate } from "@/lib/utils";

export default function CertificatesPage() {
  const q = useQuery({ queryKey: ["graduate", "certificates"], queryFn: graduateApi.listCertificates });
  return (
    <>
      <PageHeader
        title="Certificate"
        description="Download your certificate and share its verification link with employers."
      />
      <QueryState query={q}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState
              title="No certificate yet"
              description="Your certificate is issued after you complete your internship, your company submits its evaluation and SIIP approves it."
            />
          ) : (
            <div className="grid gap-10">
              {list.map((c) => (
                <CertificateCard key={c.id} cert={c} />
              ))}
            </div>
          )
        }
      </QueryState>
    </>
  );
}

function CertificateCard({ cert }: { cert: Certificate }) {
  const { me } = useSession();
  const download = useMutation({
    mutationFn: () => graduateApi.downloadCertificate(cert.id),
    onSuccess: ({ url }) =>
      USE_MOCKS
        ? toast.info("In demo mode there's no PDF to download.")
        : window.open(url, "_blank", "noopener"),
    onError: (err) => toast.error(errorMessage(err)),
  });
  const link =
    typeof window === "undefined" ? cert.verifyUrl : new URL(cert.verifyUrl, location.origin).toString();
  return (
    <div className="grid gap-6">
      {/* Preview of the PDF layout (landscape A4). */}
      <div className="overflow-hidden rounded-xl bg-paper-cert p-3 text-[var(--grey-900)] shadow-lg sm:p-5">
        <div className="relative flex aspect-[1.414] flex-col items-center justify-center rounded-lg border-2 border-orange p-6 text-center sm:p-12">
          <p className="font-display text-xl font-bold tracking-[0.2em] text-orange-deep sm:text-3xl">SIIP</p>
          <p className="text-[10px] text-[var(--grey-500)] sm:text-xs">by SkillzBridge Trades Africa</p>
          <p className="mt-4 font-display text-lg font-semibold sm:mt-8 sm:text-3xl">
            Certificate of Completion
          </p>
          <p className="mt-2 text-xs text-[var(--grey-500)] sm:mt-4 sm:text-sm">This certifies that</p>
          <p className="mt-1 font-display text-2xl font-semibold sm:text-5xl">{me?.name}</p>
          <p className="mt-2 max-w-xl text-[11px] text-[var(--grey-500)] sm:mt-4 sm:text-base">
            completed a SIIP internship with verified skills as{" "}
            {cert.placement.opening.title} at {cert.placement.company.name}.
          </p>
          <div className="absolute inset-x-4 bottom-3 flex justify-between text-[8px] text-[var(--grey-500)] sm:inset-x-10 sm:bottom-6 sm:text-xs">
            <span>
              Issued {formatDate(cert.issuedAt)}, {cert.serialNumber}
            </span>
            <span>Code {cert.verificationCode}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          size="lg"
          loading={download.isPending}
          onClick={() => download.mutate()}
          disabled={!cert.ready}
        >
          <Download /> Download PDF
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            toast.success("Verification link copied");
          }}
        >
          <Copy /> Copy verification link
        </Button>
      </div>
      <p className="flex items-start gap-2 text-[15px] text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" /> Employers can confirm your certificate
        at {link} using code <b className="text-foreground">{cert.verificationCode}</b>.
      </p>
    </div>
  );
}
