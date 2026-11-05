"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, CalendarDays, Mail, Phone } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { companyApi } from "@/client/api/company";
import { errorMessage } from "@/client/api/http";
import type { Placement } from "@/client/api/types";
import { useSession } from "@/client/session";
import { CheckInList, RatingScale } from "@/components/company/shared";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  Progress,
  StatusPill,
} from "@/components/ui/display";
import { Field } from "@/components/ui/field";
import { Select, Textarea } from "@/components/ui/form-controls";
import { ConfirmDialog, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { PLACEMENT_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

const DAY = 86_400_000;
function monthOf(start: string) {
  const s = new Date(start),
    n = new Date();
  if (n < s) return 0;
  const months = (n.getUTCFullYear() - s.getUTCFullYear()) * 12 + n.getUTCMonth() - s.getUTCMonth();
  return Math.min(3, months + (n.getUTCDate() >= s.getUTCDate() ? 0 : -1) + 1);
}

export default function InternDetailPage() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({ queryKey: ["company", "intern", id], queryFn: () => companyApi.getIntern(id) });
  return (
    <QueryState query={q}>
      {(p) => {
        const name = `${p.graduate.firstName} ${p.graduate.lastName}`;
        const pct = Math.round(
          Math.min(
            1,
            Math.max(
              0,
              (Date.now() - new Date(p.startDate).getTime()) /
                (new Date(p.endDate).getTime() - new Date(p.startDate).getTime()),
            ),
          ) * 100,
        );
        return (
          <>
            <PageHeader
              breadcrumbs={[{ label: "Interns", href: "/company/interns" }, { label: name }]}
              title={name}
              description={p.opening.title}
              actions={<StatusPill map={PLACEMENT_STATUS} value={p.status} />}
            />
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
              <div className="grid content-start gap-6">
                <Card>
                  <CardBody className="grid gap-4 text-[15px]">
                    <div className="flex items-center gap-3">
                      <Avatar name={name} size={52} />
                      <div>
                        <p className="font-semibold">{name}</p>
                        <p className="text-muted-foreground">
                          {p.graduate.courseOfStudy} · {p.graduate.institution}
                        </p>
                      </div>
                    </div>
                    <p className="flex items-center gap-3">
                      <Mail className="size-4 text-muted-foreground" />
                      <a
                        href={`mailto:${p.graduate.user?.email}`}
                        className="text-brand-text underline-offset-4 hover:underline"
                      >
                        {p.graduate.user?.email}
                      </a>
                    </p>
                    <p className="flex items-center gap-3">
                      <Phone className="size-4 text-muted-foreground" />
                      {p.graduate.phone ?? "Not provided"}
                    </p>
                    <p className="flex items-center gap-3">
                      <CalendarDays className="size-4 text-muted-foreground" />
                      {formatDate(p.startDate)} to {formatDate(p.endDate)}
                    </p>
                    <div>
                      <Progress value={pct} label="Internship progress" />
                      <p className="mt-1.5 text-sm text-muted-foreground">{pct}% through the internship</p>
                    </div>
                  </CardBody>
                </Card>
                <SupervisorCard p={p} />
                <OfferCard p={p} />
              </div>
              <Card>
                <CardBody>
                  <Tabs defaultValue="checkins">
                    <TabsList>
                      <TabsTrigger value="checkins">Check-ins</TabsTrigger>
                      <TabsTrigger value="evaluation">Final evaluation</TabsTrigger>
                    </TabsList>
                    <TabsContent value="checkins">
                      <CheckInsTab p={p} />
                    </TabsContent>
                    <TabsContent value="evaluation">
                      <EvaluationTab p={p} />
                    </TabsContent>
                  </Tabs>
                </CardBody>
              </Card>
            </div>
          </>
        );
      }}
    </QueryState>
  );
}

function useCanSupervise(p: Placement) {
  const { me } = useSession();
  return me?.companyMember?.role === "OWNER" || p.supervisor?.id === me?.companyMember?.id;
}

function SupervisorCard({ p }: { p: Placement }) {
  const qc = useQueryClient();
  const { me } = useSession();
  const isOwner = me?.companyMember?.role === "OWNER";
  const members = useQuery({
    queryKey: ["company", "members"],
    queryFn: companyApi.listMembers,
    enabled: isOwner,
  });
  const assign = useMutation({
    mutationFn: (sid: string) => companyApi.assignSupervisor(p.id, sid),
    onSuccess: (np) => {
      qc.setQueryData(["company", "intern", p.id], np);
      toast.success("Supervisor updated");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Card>
      <CardHeader title="Supervisor" />
      <CardBody>
        {isOwner ? (
          <Field label="Assigned supervisor">
            <Select
              value={p.supervisor?.id ?? ""}
              onChange={(e) => assign.mutate(e.target.value)}
              disabled={assign.isPending}
            >
              {members.data?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.user.name}
                  {m.jobTitle ? ` · ${m.jobTitle}` : ""}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <p className="text-[15px]">{p.supervisor?.user.name ?? "Not assigned"}</p>
        )}
      </CardBody>
    </Card>
  );
}

function OfferCard({ p }: { p: Placement }) {
  const qc = useQueryClient();
  const { me } = useSession();
  const [notes, setNotes] = useState("");
  const offer = useMutation({
    mutationFn: () => companyApi.recordOffer(p.id, notes.trim() || undefined),
    onSuccess: (np) => {
      qc.setQueryData(["company", "intern", p.id], np);
      toast.success("Permanent offer recorded");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (p.offeredPermanentRole) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-orange p-5 text-[var(--grey-950)]">
        <Award className="size-6" />
        <div>
          <p className="font-semibold">Permanent offer recorded</p>
          {p.permanentOfferDate ? <p className="text-sm">{formatDate(p.permanentOfferDate)}</p> : null}
        </div>
      </div>
    );
  }
  if (me?.companyMember?.role !== "OWNER" || p.status === "TERMINATED") return null;
  return (
    <Card>
      <CardHeader
        title="Permanent job offer"
        description="Offering this intern a permanent role? Record it here."
      />
      <CardBody>
        <ConfirmDialog
          trigger={
            <Button variant="outline" className="w-full">
              <Award /> Record a permanent offer
            </Button>
          }
          title="Record a permanent offer?"
          description="The intern will be notified. This can't be undone here."
          confirmLabel="Record offer"
          tone="primary"
          onConfirm={() => offer.mutateAsync()}
        >
          <Field label="Notes" optional hint="e.g. role title, start date">
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </ConfirmDialog>
      </CardBody>
    </Card>
  );
}

function CheckInsTab({ p }: { p: Placement }) {
  const qc = useQueryClient();
  const can = useCanSupervise(p);
  const list = useQuery({
    queryKey: ["company", "intern", p.id, "check-ins"],
    queryFn: () => companyApi.listInternCheckIns(p.id),
  });
  const month = monthOf(p.startDate);
  const done = new Set(list.data?.filter((c) => c.authorType === "SUPERVISOR").map((c) => c.month));
  const due = [1, 2, 3].find((m) => m <= month && !done.has(m));
  const [note, setNote] = useState("");
  const [rating, setRating] = useState(4);
  const submit = useMutation({
    mutationFn: () => companyApi.submitCheckIn(p.id, { month: due!, progressNote: note.trim(), rating }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company", "intern", p.id, "check-ins"] });
      setNote("");
      toast.success("Check-in sent");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="grid gap-6">
      {can && p.status === "ACTIVE" && due ? (
        <form
          className="grid gap-4 rounded-lg bg-surface-muted p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (note.trim().length >= 10) submit.mutate();
          }}
        >
          <p className="font-semibold">Month {due} check-in</p>
          <Field label="How is the intern doing?" hint="At least 10 characters." required>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div>
            <p className="mb-2 text-[15px] font-semibold">Rating this month</p>
            <RatingScale value={rating} onChange={setRating} label="Rating this month" />
          </div>
          <Button
            type="submit"
            loading={submit.isPending}
            disabled={note.trim().length < 10}
            className="justify-self-start"
          >
            Send check-in
          </Button>
        </form>
      ) : null}
      {list.data ? <CheckInList items={list.data} /> : null}
    </div>
  );
}

const AREAS = [
  ["punctuality", "Punctuality"],
  ["skill", "Skill"],
  ["communication", "Communication"],
  ["teamwork", "Teamwork"],
  ["initiative", "Initiative"],
] as const;

function EvaluationTab({ p }: { p: Placement }) {
  const qc = useQueryClient();
  const can = useCanSupervise(p);
  const existing = useQuery({
    queryKey: ["company", "intern", p.id, "evaluation"],
    queryFn: () => companyApi.getEvaluation(p.id),
  });
  const [scores, setScores] = useState<Record<(typeof AREAS)[number][0], number>>({
    punctuality: 0,
    skill: 0,
    communication: 0,
    teamwork: 0,
    initiative: 0,
  });
  const [comments, setComments] = useState("");
  const [wouldHire, setWouldHire] = useState<boolean | null>(null);
  const opens = new Date(new Date(p.endDate).getTime() - 14 * DAY);
  const open = p.status === "COMPLETED" || (p.status === "ACTIVE" && new Date() >= opens);
  const complete = Object.values(scores).every((v) => v > 0) && wouldHire !== null;
  const submit = useMutation({
    mutationFn: () =>
      companyApi.submitEvaluation(p.id, {
        ...scores,
        comments: comments.trim() || undefined,
        wouldHire: wouldHire!,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company", "intern", p.id, "evaluation"] });
      toast.success("Evaluation submitted. Thank you!");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (existing.data) {
    const e = existing.data;
    return (
      <div className="grid gap-4">
        <p className="font-display text-4xl font-semibold">
          {e.overallScore.toFixed(1)}
          <span className="text-lg text-muted-foreground"> / 5 overall</span>
        </p>
        <ul className="grid gap-2">
          {AREAS.map(([k, label]) => (
            <li key={k} className="flex justify-between text-[15px]">
              <span>{label}</span>
              <span className="font-semibold tabular-nums">{e[k]} / 5</span>
            </li>
          ))}
        </ul>
        <p className="text-[15px]">
          <b>Would hire:</b> {e.wouldHire ? "Yes" : "No"}
        </p>
        {e.comments ? <p className="rounded-md bg-surface-muted p-4 text-[15px]">{e.comments}</p> : null}
      </div>
    );
  }
  if (!open)
    return (
      <p className="text-[15px] text-muted-foreground">
        The final evaluation opens on {formatDate(opens)}, two weeks before the internship ends.
      </p>
    );
  if (!can)
    return (
      <p className="text-[15px] text-muted-foreground">
        The intern&apos;s supervisor or the company owner submits the evaluation.
      </p>
    );
  return (
    <form
      className="grid gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (complete) submit.mutate();
      }}
    >
      <p className="text-[15px] text-muted-foreground">
        Rate each area from 1 (poor) to 5 (excellent). SIIP needs this before issuing the certificate.
      </p>
      {AREAS.map(([k, label]) => (
        <div key={k} className="grid gap-2">
          <p className="font-semibold">{label}</p>
          <RatingScale value={scores[k]} onChange={(v) => setScores({ ...scores, [k]: v })} label={label} />
        </div>
      ))}
      <fieldset className="grid gap-2">
        <legend className="mb-2 font-semibold">Would you hire this intern?</legend>
        <div className="flex gap-2">
          {[true, false].map((v) => (
            <Button
              key={String(v)}
              type="button"
              variant={wouldHire === v ? "secondary" : "outline"}
              aria-pressed={wouldHire === v}
              onClick={() => setWouldHire(v)}
            >
              {v ? "Yes" : "No"}
            </Button>
          ))}
        </div>
      </fieldset>
      <Field label="Comments" optional>
        <Textarea rows={4} value={comments} onChange={(e) => setComments(e.target.value)} />
      </Field>
      <Button
        type="submit"
        size="lg"
        disabled={!complete}
        loading={submit.isPending}
        className="justify-self-start"
      >
        Submit evaluation
      </Button>
    </form>
  );
}
