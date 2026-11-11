"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { guessTimeZone } from "@siip/shared/timezones";
import { updateCompanySchema } from "@siip/shared/validators/company";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { companyApi } from "@/client/api/company";
import type { Company } from "@/client/api/types";
import { ChangePasswordCard } from "@/components/change-password";
import { NotificationSettingsCard, PrivacyCard } from "@/components/account-privacy";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader, StatusPill } from "@/components/ui/display";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/form-controls";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { COMPANY_STATUS, companyRegistration } from "@/lib/labels";
import { CompanyPlaceFields } from "@/components/company/company-fields";
import { handleFormError } from "@/lib/forms";

export default function CompanySettingsPage() {
  const q = useQuery({ queryKey: ["company", "profile"], queryFn: companyApi.getProfile });
  return (
    <>
      <PageHeader title="Company profile" description="Details SIIP and your interns see." />
      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="account">My account</TabsTrigger>
        </TabsList>
        <TabsContent value="company">
          <QueryState query={q}>{(c) => <CompanyForm company={c} />}</QueryState>
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationSettingsCard
            options={[
              { key: "matches", label: "New candidates", hint: "When SIIP proposes a graduate." },
              { key: "reminders", label: "Reminders", hint: "Pending decisions, check-ins and evaluations." },
            ]}
          />
        </TabsContent>
        <TabsContent value="account" className="grid gap-6">
          <ChangePasswordCard />
          <PrivacyCard
            canDelete={q.data?.myRole !== "OWNER"}
            cannotDeleteReason="You own this company account. Contact SIIP to transfer ownership first."
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

function CompanyForm({ company }: { company: Company }) {
  const qc = useQueryClient();
  const isOwner = company.myRole === "OWNER";
  const locked = company.verificationStatus === "VERIFIED" || company.verificationStatus === "SUSPENDED";
  const {
    register,
    control,
    watch,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<z.input<typeof updateCompanySchema>>({
    resolver: zodResolver(updateCompanySchema),
    defaultValues: {
      name: company.name,
      country: (company.country ?? undefined) as never,
      city: company.city ?? "",
      timeZone: company.timeZone ?? guessTimeZone() ?? undefined,
      rcNumber: company.rcNumber,
      businessRegNumber: company.businessRegNumber,
      industry: company.industry,
      description: company.description ?? "",
      address: company.address,
      state: (company.state ?? null) as never,
      website: company.website ?? "",
    },
  });
  const save = useMutation({
    mutationFn: companyApi.updateProfile,
    onSuccess: (c) => {
      qc.setQueryData(["company", "profile"], c);
      toast.success("Company profile saved");
    },
  });
  return (
    <Card>
      <CardHeader
        title={company.name}
        description={companyRegistration(company)}
        action={<StatusPill map={COMPANY_STATUS} value={company.verificationStatus} />}
      />
      <CardBody>
        <form
          noValidate
          className="grid gap-5"
          onSubmit={handleSubmit(async (v) => {
            try {
              await save.mutateAsync({ ...v, website: v.website || null });
            } catch (err) {
              handleFormError(err, setError);
            }
          })}
        >
          <fieldset disabled={!isOwner} className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Company name"
                hint={locked ? "Locked after verification. Contact SIIP to change it." : undefined}
                error={errors.name?.message}
                required
              >
                <Input disabled={locked} {...register("name")} />
              </Field>
              <Field label="Industry" error={errors.industry?.message} required>
                <Input {...register("industry")} />
              </Field>
            </div>
            <CompanyPlaceFields
              control={control as never}
              register={register as never}
              errors={errors}
              country={watch("country")}
              locked={locked}
            />
            <Field label="Office address" error={errors.address?.message} required>
              <Input {...register("address")} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Website" optional error={errors.website?.message}>
                <Input type="url" {...register("website")} />
              </Field>
            </div>
            <Field label="About the company" optional>
              <Textarea rows={4} {...register("description")} />
            </Field>
          </fieldset>
          {isOwner ? (
            <Button type="submit" size="lg" loading={save.isPending} className="justify-self-start">
              Save changes
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Only the company owner can edit these details.</p>
          )}
        </form>
      </CardBody>
    </Card>
  );
}
