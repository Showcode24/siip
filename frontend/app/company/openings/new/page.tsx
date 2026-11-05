"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { companyApi } from "@/client/api/company";
import { errorMessage } from "@/client/api/http";
import { OpeningForm } from "@/components/company/shared";
import { Card, CardBody, PageHeader } from "@/components/ui/display";

export default function NewOpeningPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const create = useMutation({
    mutationFn: companyApi.createOpening,
    onSuccess: (o) => {
      qc.invalidateQueries({ queryKey: ["company", "openings"] });
      toast.success("Opening saved as a draft", { description: "Publish it when you're ready." });
      router.push(`/company/openings/${o.id}`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        breadcrumbs={[{ label: "Openings", href: "/company/openings" }, { label: "New opening" }]}
        title="Post an opening"
        description="New openings start as drafts. Publish when you're ready."
      />
      <Card>
        <CardBody>
          <OpeningForm
            submitLabel="Save draft"
            busy={create.isPending}
            onSubmit={async (v) => {
              await create.mutateAsync(v);
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
