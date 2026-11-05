"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MailPlus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { companyApi } from "@/client/api/company";
import { errorMessage } from "@/client/api/http";
import { useSession } from "@/client/session";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/display";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/form-controls";
import { ConfirmDialog } from "@/components/ui/overlays";
import { formatDate } from "@/lib/utils";

export default function TeamPage() {
  const qc = useQueryClient();
  const { me } = useSession();
  const isOwner = me?.companyMember?.role === "OWNER";
  const members = useQuery({ queryKey: ["company", "members"], queryFn: companyApi.listMembers });
  const invites = useQuery({
    queryKey: ["company", "invitations"],
    queryFn: companyApi.listInvitations,
    enabled: isOwner,
  });
  const [email, setEmail] = useState("");
  const valid = z.email().safeParse(email.trim()).success;
  const refresh = () => qc.invalidateQueries({ queryKey: ["company"] });
  const invite = useMutation({
    mutationFn: () => companyApi.invite(email.trim()),
    onSuccess: () => {
      refresh();
      setEmail("");
      toast.success("Invitation sent", { description: "The link expires in 7 days." });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: companyApi.removeMember,
    onSuccess: () => {
      refresh();
      toast.success("Member removed");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const revoke = useMutation({
    mutationFn: companyApi.revokeInvitation,
    onSuccess: () => {
      refresh();
      toast.success("Invitation cancelled");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeader
        title="Team"
        description="Supervisors follow their interns, send monthly check-ins and complete evaluations."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Members" />
          <CardBody>
            <QueryState query={members}>
              {(list) => (
                <ul className="divide-y divide-border">
                  {list.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 py-3">
                      <Avatar name={m.user.name} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{m.user.name}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {m.user.email}
                          {m.jobTitle ? ` · ${m.jobTitle}` : ""}
                        </p>
                      </div>
                      <Badge tone={m.role === "OWNER" ? "dark" : "neutral"}>
                        {m.role === "OWNER" ? "Owner" : "Supervisor"}
                      </Badge>
                      {isOwner && m.role !== "OWNER" ? (
                        <ConfirmDialog
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label={`Remove ${m.user.name}`}>
                              <Trash2 />
                            </Button>
                          }
                          title={`Remove ${m.user.name}?`}
                          description="They'll lose access to your company. Interns they supervise will need a new supervisor."
                          confirmLabel="Remove"
                          onConfirm={() => remove.mutateAsync(m.id)}
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </QueryState>
          </CardBody>
        </Card>
        {isOwner ? (
          <div className="grid content-start gap-6">
            <Card>
              <CardHeader
                title="Invite a supervisor"
                description="They'll get an email link to join your company."
              />
              <CardBody>
                <form
                  className="grid gap-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (valid) invite.mutate();
                  }}
                >
                  <Field label="Work email" required>
                    <Input
                      type="email"
                      inputMode="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.ng"
                    />
                  </Field>
                  <Button
                    type="submit"
                    disabled={!valid}
                    loading={invite.isPending}
                    className="justify-self-start"
                  >
                    <MailPlus /> Send invitation
                  </Button>
                </form>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Pending invitations" />
              <CardBody>
                {!invites.data?.length ? (
                  <p className="text-[15px] text-muted-foreground">No pending invitations.</p>
                ) : (
                  <ul className="grid gap-3">
                    {invites.data.map((i) => (
                      <li key={i.id} className="flex items-center gap-3 text-[15px]">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{i.email}</p>
                          <p className="text-sm text-muted-foreground">Expires {formatDate(i.expiresAt)}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Cancel invitation to ${i.email}`}
                          onClick={() => revoke.mutate(i.id)}
                        >
                          <X />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
        ) : null}
      </div>
    </>
  );
}
