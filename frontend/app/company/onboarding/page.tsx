"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { NIGERIAN_STATES } from "@siip/shared/nigeria";
import { registerCompanySchema } from "@siip/shared/validators/company";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, FileSearch, XCircle } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { companyApi } from "@/client/api/company";
import { errorMessage } from "@/client/api/http";
import { sessionKey, useSession } from "@/client/session";
import { Button } from "@/components/ui/button";
import { Card, CardBody, PageHeader, Skeleton } from "@/components/ui/display";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/form-controls";
import { handleFormError } from "@/lib/forms";
import { cn } from "@/lib/utils";

export default function CompanyOnboardingPage() {
  const { me, isLoading } = useSession();
  if (isLoading) return <Skeleton className="h-96 rounded-xl" />;
  return me?.companyMember ? <VerificationStatus /> : <RegisterCompany />;
}

function RegisterCompany() {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof registerCompanySchema>>({
    resolver: zodResolver(registerCompanySchema),
    mode: "onTouched",
    defaultValues: { state: "Lagos" },
  });
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Register your company"
        description="Tell us about your company. We verify every partner before they can host interns."
      />
      <Card>
        <CardBody>
          <form
            noValidate
            className="grid gap-5"
            onSubmit={handleSubmit(async (v) => {
              try {
                await companyApi.register(v);
                await qc.invalidateQueries({ queryKey: sessionKey });
                toast.success("Company registered", { description: "We'll review it shortly." });
              } catch (err) {
                handleFormError(err, setError);
              }
            })}
          >
            <Field label="Company name" error={errors.name?.message} required>
              <Input autoComplete="organization" {...register("name")} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="CAC registration number"
                hint="e.g. RC1234567 or BN1234567"
                error={errors.rcNumber?.message}
                required
              >
                <Input className="uppercase" {...register("rcNumber")} />
              </Field>
              <Field label="Industry" error={errors.industry?.message} required>
                <Input placeholder="e.g. Media, Fintech, FMCG" {...register("industry")} />
              </Field>
            </div>
            <Field label="Office address" error={errors.address?.message} required>
              <Input autoComplete="street-address" {...register("address")} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="State" required>
                <Select {...register("state")}>
                  {NIGERIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Website" optional error={errors.website?.message}>
                <Input
                  type="url"
                  placeholder="https://"
                  {...register("website", { setValueAs: (v) => (v === "" ? null : v) })}
                />
              </Field>
            </div>
            <Field label="Your job title" optional>
              <Input {...register("jobTitle")} />
            </Field>
            <Field label="About the company" optional error={errors.description?.message}>
              <Textarea rows={4} {...register("description")} />
            </Field>
            <Button type="submit" size="lg" loading={isSubmitting} className="justify-self-start">
              Submit for verification
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

function VerificationStatus() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["company", "profile"], queryFn: companyApi.getProfile });
  const resubmit = useMutation({
    mutationFn: companyApi.resubmit,
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Resubmitted for review");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  if (q.isPending) return <Skeleton className="h-96 rounded-xl" />;
  const c = q.data;
  if (!c) return null;
  const status = c.verificationStatus;
  const steps = [
    { icon: CheckCircle2, title: "Company registered", done: true },
    {
      icon: FileSearch,
      title: "SIIP checks your CAC details",
      done: status === "VERIFIED" || status === "SUSPENDED",
    },
    {
      icon: CheckCircle2,
      title: "Verified: publish openings and receive candidates",
      done: status === "VERIFIED",
    },
  ];
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={c.name} description={`${c.rcNumber}, ${c.industry}`} />
      <Card>
        <CardBody className="grid gap-6">
          <div
            className={cn(
              "flex items-start gap-4 rounded-lg p-5",
              status === "VERIFIED"
                ? "bg-success-soft text-success"
                : status === "PENDING"
                  ? "bg-warning-soft text-warning"
                  : "bg-danger-soft text-danger",
            )}
          >
            {status === "VERIFIED" ? (
              <CheckCircle2 className="size-6 shrink-0" />
            ) : status === "PENDING" ? (
              <Clock className="size-6 shrink-0" />
            ) : (
              <XCircle className="size-6 shrink-0" />
            )}
            <div>
              <p className="font-semibold">
                {status === "VERIFIED"
                  ? "Your company is verified"
                  : status === "PENDING"
                    ? "Verification in progress"
                    : status === "REJECTED"
                      ? "Verification was not approved"
                      : "Your company is suspended"}
              </p>
              <p className="mt-1 text-[15px]">
                {status === "PENDING"
                  ? "This usually takes one to two working days. You can draft openings while you wait."
                  : status === "VERIFIED"
                    ? "You can publish openings and we'll start sending you candidates."
                    : (c.statusReason ?? "Contact SIIP for details.")}
              </p>
            </div>
          </div>
          <ol className="grid gap-4">
            {steps.map((s, i) => (
              <li key={i} className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-9 place-items-center rounded-full",
                    s.done
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-surface-muted text-muted-foreground",
                  )}
                >
                  <s.icon className="size-5" />
                </span>
                <span className={cn("text-[15px]", s.done ? "font-semibold" : "text-muted-foreground")}>
                  {s.title}
                </span>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-3">
            {status === "REJECTED" ? (
              <>
                <Button asChild variant="outline">
                  <Link href="/company/settings">Fix company details</Link>
                </Button>
                <Button loading={resubmit.isPending} onClick={() => resubmit.mutate()}>
                  Resubmit for review
                </Button>
              </>
            ) : (
              <Button asChild>
                <Link href="/company/openings/new">
                  {status === "VERIFIED" ? "Post an opening" : "Draft an opening"}
                </Link>
              </Button>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
