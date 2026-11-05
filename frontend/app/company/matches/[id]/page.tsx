"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Lock, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { companyApi } from "@/client/api/company";
import { USE_MOCKS, errorMessage } from "@/client/api/http";
import { useSession } from "@/client/session";
import { GraduateSummary, ScoreBreakdownList, ScoreRing } from "@/components/company/shared";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader, StatusPill } from "@/components/ui/display";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/form-controls";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/overlays";
import { MATCH_STATUS } from "@/lib/labels";

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { me } = useSession();
  const isOwner = me?.companyMember?.role === "OWNER";
  const q = useQuery({ queryKey: ["company", "match", id], queryFn: () => companyApi.getMatch(id) });
  const members = useQuery({
    queryKey: ["company", "members"],
    queryFn: companyApi.listMembers,
    enabled: isOwner,
  });
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [supervisorId, setSupervisorId] = useState("");
  const [reason, setReason] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["company"] });
  const accept = useMutation({
    mutationFn: () =>
      companyApi.acceptMatch(id, {
        startDate: new Date(startDate).toISOString(),
        supervisorId: supervisorId || undefined,
      }),
    onSuccess: (p) => {
      refresh();
      toast.success("Match accepted", {
        description: "The internship has been created. We've emailed the graduate.",
      });
      router.push(`/company/interns/${p.id}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const reject = useMutation({
    mutationFn: () => companyApi.rejectMatch(id, reason.trim()),
    onSuccess: () => {
      refresh();
      toast.success("Candidate declined");
      router.push("/company/matches");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <QueryState query={q}>
      {(m) => {
        const accepted = m.status === "COMPANY_ACCEPTED";
        return (
          <>
            <PageHeader
              breadcrumbs={[
                { label: "Candidates", href: "/company/matches" },
                { label: `${m.graduate.firstName} ${m.graduate.lastName}` },
              ]}
              title={`${m.graduate.firstName} ${m.graduate.lastName}`}
              description={`Proposed for ${m.opening.title}`}
              actions={<StatusPill map={MATCH_STATUS} value={m.status} />}
            />
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <div className="grid content-start gap-6">
                <Card>
                  <CardBody>
                    <GraduateSummary g={m.graduate} />
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title="Contact details" />
                  <CardBody>
                    {accepted ? (
                      <div className="grid gap-3 text-[15px]">
                        <p className="flex items-center gap-3">
                          <Mail className="size-5 text-muted-foreground" />{" "}
                          <a
                            className="text-brand-text underline-offset-4 hover:underline"
                            href={`mailto:${m.graduate.email}`}
                          >
                            {m.graduate.email}
                          </a>
                        </p>
                        <p className="flex items-center gap-3">
                          <Phone className="size-5 text-muted-foreground" />{" "}
                          <a
                            className="text-brand-text underline-offset-4 hover:underline"
                            href={`tel:${m.graduate.phone}`}
                          >
                            {m.graduate.phone ?? "Not provided"}
                          </a>
                        </p>
                        {m.graduate.hasCv ? (
                          <Button
                            variant="outline"
                            className="justify-self-start"
                            onClick={async () => {
                              try {
                                const { url } = await companyApi.getMatchCv(id);
                                if (USE_MOCKS) toast.info("In demo mode there's no CV file.");
                                else window.open(url, "_blank", "noopener");
                              } catch (e) {
                                toast.error(errorMessage(e));
                              }
                            }}
                          >
                            <FileText /> Open CV
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <p className="flex items-center gap-3 text-[15px] text-muted-foreground">
                        <Lock className="size-5" /> Phone, email and CV are shared once you accept this match.
                      </p>
                    )}
                  </CardBody>
                </Card>
                {m.decisionReason ? (
                  <Card>
                    <CardHeader title="Decision note" />
                    <CardBody>
                      <p className="text-[15px]">{m.decisionReason}</p>
                    </CardBody>
                  </Card>
                ) : null}
              </div>
              <div className="grid content-start gap-6">
                <Card>
                  <CardHeader title="Why this match" description="Each factor's points out of its weight." />
                  <CardBody className="grid gap-6">
                    <div className="flex items-center gap-4">
                      <ScoreRing score={m.score} />
                      <p className="text-[15px] text-muted-foreground">
                        Out of 100. Scores above 70 are a strong fit.
                      </p>
                    </div>
                    <ScoreBreakdownList breakdown={m.scoreBreakdown} />
                  </CardBody>
                </Card>
                {m.status === "PROPOSED" && isOwner ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="lg">Accept candidate</Button>
                      </DialogTrigger>
                      <DialogContent
                        title="Accept this candidate?"
                        description="This creates a three-month internship and shares the graduate's contact details with you."
                        footer={
                          <>
                            <DialogClose asChild>
                              <Button variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button loading={accept.isPending} onClick={() => accept.mutate()}>
                              Accept and create internship
                            </Button>
                          </>
                        }
                      >
                        <div className="grid gap-4">
                          <Field label="Start date" required>
                            <Input
                              type="date"
                              value={startDate}
                              min={new Date().toISOString().slice(0, 10)}
                              onChange={(e) => setStartDate(e.target.value)}
                            />
                          </Field>
                          <Field label="Supervisor" hint="You can change this later.">
                            <Select value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)}>
                              <option value="">Me</option>
                              {members.data
                                ?.filter((x) => x.user.email !== me?.email)
                                .map((x) => (
                                  <option key={x.id} value={x.id}>
                                    {x.user.name}
                                  </option>
                                ))}
                            </Select>
                          </Field>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="lg" variant="outline">
                          Decline
                        </Button>
                      </DialogTrigger>
                      <DialogContent
                        title="Decline this candidate?"
                        description="Tell SIIP why. It helps us send better matches. The graduate returns to the pool."
                        footer={
                          <>
                            <DialogClose asChild>
                              <Button variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button
                              variant="danger"
                              disabled={reason.trim().length < 3}
                              loading={reject.isPending}
                              onClick={() => reject.mutate()}
                            >
                              Decline
                            </Button>
                          </>
                        }
                      >
                        <Field label="Reason" required>
                          <Textarea
                            rows={3}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. We need stronger video editing skills"
                          />
                        </Field>
                      </DialogContent>
                    </Dialog>
                  </div>
                ) : m.status === "PROPOSED" ? (
                  <p className="rounded-lg bg-surface-muted p-4 text-[15px] text-muted-foreground">
                    Only the company owner can accept or decline candidates.
                  </p>
                ) : accepted ? (
                  <Button asChild variant="outline" size="lg">
                    <Link href="/company/interns">Go to interns</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </>
        );
      }}
    </QueryState>
  );
}
