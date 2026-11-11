"use client";

import { SkillLevel } from "@siip/shared/enums";
import { SKILL_LEVEL_ORDER, levelRank } from "@siip/shared/validators/review";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  FileText,
  Link2,
  RotateCcw,
  Send,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { adminApi } from "@/client/api/admin";
import { ApiError, errorMessage } from "@/client/api/http";
import type { GraduateSkill, ReviewDetail, ReviewHistoryItem, SkillDocument } from "@/client/api/types";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, PageHeader, StatusPill } from "@/components/ui/display";
import { Field } from "@/components/ui/field";
import { Select, Textarea } from "@/components/ui/form-controls";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/overlays";
import {
  AVAILABILITY,
  DEGREE_CLASS,
  INTERN_TYPE,
  PROFILE_REVIEW,
  SKILL_LEVEL,
  SKILL_STATUS,
  WORK_MODE,
  formatLocation,
} from "@/lib/labels";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

const fieldError = (err: unknown) => {
  const details = err instanceof ApiError && Array.isArray(err.details) ? err.details : [];
  return (details[0] as { message?: string } | undefined)?.message ?? errorMessage(err);
};

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({ queryKey: ["admin", "review", id], queryFn: () => adminApi.getReview(id) });
  return (
    <QueryState query={q}>
      {(r) => <Review review={r} />}
    </QueryState>
  );
}

function Review({ review: r }: { review: ReviewDetail }) {
  const qc = useQueryClient();
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["admin", "review", r.id] }),
      qc.invalidateQueries({ queryKey: ["admin", "reviews"] }),
    ]);
  const removed = Boolean(r.removedAt);
  const pending = r.skills.filter((s) => s.status === "PENDING").length;
  const verified = r.skills.filter((s) => s.status === "VERIFIED").length;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Skill reviews", href: "/admin/reviews" }, { label: `${r.firstName} ${r.lastName}` }]}
        title={`${r.firstName} ${r.lastName}`}
        description={r.user.email}
        actions={removed ? <Badge tone="danger">Removed</Badge> : <StatusPill map={PROFILE_REVIEW} value={r.reviewStatus} />}
      />

      {removed ? <RemovedBanner review={r} onDone={refresh} /> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Facts review={r} />

        <div className="grid min-w-0 gap-6">
          <section aria-labelledby="skills-title" className="grid gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="skills-title" className="text-xl">
                Skills
              </h2>
              <p className="text-sm text-muted-foreground">
                {pending ? `${pending} to check` : "All decided"}, {verified} verified
              </p>
            </div>
            {r.skills.length ? (
              <ul className="grid gap-3">
                {r.skills.map((s) => (
                  <SkillReview key={s.id} graduateId={r.id} skill={s} disabled={removed} onDone={refresh} />
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-border-strong p-5 text-[15px] text-muted-foreground">
                This intern hasn&apos;t listed any skills.
              </p>
            )}
          </section>

          {removed ? null : (
            <ProfileDecision review={r} pending={pending} verified={verified} onDone={refresh} />
          )}
          <History items={r.history} />
        </div>
      </div>
    </>
  );
}

// ─── The intern's details ─────────────────────────────────────────────────────

function Facts({ review: r }: { review: ReviewDetail }) {
  const openCv = async () => {
    try {
      const { url } = await adminApi.getGraduateCv(r.id);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const rows: Array<[string, ReactNode]> = [
    ["Intern type", INTERN_TYPE[r.internType].label],
    ["Location", [formatLocation(r), r.stateOfResidence].filter(Boolean).join(", ") || "Not given"],
    ["Works", r.workPreference ? WORK_MODE[r.workPreference] : "Not given"],
    ["Availability", r.availability ? AVAILABILITY[r.availability] : "Not given"],
    ["Phone", r.phone ?? "Not given"],
    ["Studied", [r.courseOfStudy, r.institution].filter(Boolean).join(", ") || "Not given"],
    [
      r.internType === "UNDERGRADUATE" ? "Graduates" : "Degree",
      r.internType === "UNDERGRADUATE"
        ? (r.graduationYear ?? "Not given")
        : [r.degreeClass ? DEGREE_CLASS[r.degreeClass] : null, r.graduationYear].filter(Boolean).join(", ") || "Not given",
    ],
    ...(r.internType === "NYSC_CORPS_MEMBER"
      ? ([
          ["NYSC state code", r.nyscStateCode ?? "Not given"],
          ["NYSC batch", r.nyscBatch ?? "Not given"],
        ] as Array<[string, ReactNode]>)
      : []),
    ["Sent for review", r.submittedAt ? formatDate(r.submittedAt) : "Not sent"],
    ["Joined", formatDate(r.user.createdAt)],
  ];
  return (
    <Card className="self-start lg:sticky lg:top-24">
      <CardHeader title="About the intern" />
      <CardBody className="grid gap-4">
        <dl className="grid gap-3 text-[15px]">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-semibold break-words">{v}</dd>
            </div>
          ))}
        </dl>
        {r.bio ? <p className="text-[15px] text-muted-foreground">{r.bio}</p> : null}
        {r.hasCv ? (
          <Button type="button" variant="outline" className="justify-self-start" onClick={() => void openCv()}>
            <FileText /> Open CV
          </Button>
        ) : null}
      </CardBody>
    </Card>
  );
}

// ─── One skill ────────────────────────────────────────────────────────────────

function SkillReview({
  graduateId,
  skill,
  disabled,
  onDone,
}: {
  graduateId: string;
  skill: GraduateSkill;
  disabled: boolean;
  onDone: () => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(skill.status === "PENDING");
  const [level, setLevel] = useState<SkillLevel>(skill.verifiedLevel ?? skill.level);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState(skill.rejectionReason ?? "");
  const [error, setError] = useState<string | null>(null);
  const allowed = SKILL_LEVEL_ORDER.filter((l) => levelRank(l) <= levelRank(skill.level));

  const decide = useMutation({
    mutationFn: (body: Parameters<typeof adminApi.decideSkill>[2]) => adminApi.decideSkill(graduateId, skill.id, body),
    onSuccess: async (s) => {
      setError(null);
      setRejecting(false);
      setEditing(false);
      await onDone();
      toast.success(
        s.status === "VERIFIED"
          ? `${s.name} verified as ${SKILL_LEVEL[s.verifiedLevel!]}`
          : `${s.name} not verified`,
      );
    },
    onError: (err) => setError(fieldError(err)),
  });

  return (
    <li className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold">{skill.name}</p>
          <p className="text-sm text-muted-foreground">
            {skill.category}
            {skill.issuingBody ? `, from ${skill.issuingBody}` : ""}
            {skill.issuedAt ? `, issued ${formatDate(skill.issuedAt)}` : ""}
          </p>
        </div>
        <StatusPill map={SKILL_STATUS} value={skill.status} />
      </div>
      <p className="mt-2 text-[15px]">
        Claims <span className="font-semibold">{SKILL_LEVEL[skill.level]}</span>
        {skill.status === "VERIFIED" && skill.verifiedLevel ? (
          <>
            , verified as <span className="font-semibold text-success">{SKILL_LEVEL[skill.verifiedLevel]}</span>
          </>
        ) : null}
      </p>
      {skill.status === "REJECTED" && skill.rejectionReason ? (
        <p className="mt-2 text-sm text-danger">Reason given: {skill.rejectionReason}</p>
      ) : null}

      <div className="mt-4 grid gap-1.5">
        <p className="text-sm font-semibold">Proof</p>
        {skill.documents.length ? (
          <ul className="grid gap-1.5">
            {skill.documents.map((d) => (
              <DocLink key={d.id} doc={d} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-warning">No documents.</p>
        )}
      </div>

      {disabled ? null : editing ? (
        <div className="mt-4 grid gap-3 border-t border-border pt-4">
          {rejecting ? (
            <Field label="Why isn't this skill verified?" hint="The intern sees this." error={error ?? undefined} required>
              <Textarea
                rows={3}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. The certificate is in someone else's name."
              />
            </Field>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Verify at" className="w-48" error={error ?? undefined}>
                <Select value={level} onChange={(e) => setLevel(e.target.value as SkillLevel)}>
                  {allowed
                    .slice()
                    .reverse()
                    .map((l) => (
                      <option key={l} value={l}>
                        {SKILL_LEVEL[l]}
                        {l === skill.level ? " (claimed)" : ""}
                      </option>
                    ))}
                </Select>
              </Field>
              {level !== skill.level ? (
                <p className="pb-3 text-sm text-muted-foreground">Lower than claimed.</p>
              ) : null}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {rejecting ? (
              <>
                <Button
                  type="button"
                  variant="danger"
                  loading={decide.isPending}
                  onClick={() => decide.mutate({ decision: "REJECT", reason })}
                >
                  <XCircle /> Don&apos;t verify
                </Button>
                <Button type="button" variant="ghost" onClick={() => (setRejecting(false), setError(null))}>
                  Back
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  loading={decide.isPending}
                  disabled={!skill.documents.length}
                  onClick={() => decide.mutate({ decision: "VERIFY", level })}
                >
                  <CheckCircle2 /> Verify as {SKILL_LEVEL[level]}
                </Button>
                <Button type="button" variant="outline" onClick={() => (setRejecting(true), setError(null))}>
                  <XCircle /> Reject
                </Button>
                {skill.status !== "PENDING" ? (
                  <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Change decision
          </Button>
        </div>
      )}
    </li>
  );
}

function DocLink({ doc }: { doc: SkillDocument }) {
  const open = async () => {
    const win = window.open("", "_blank", "noopener");
    try {
      const { url } = await adminApi.getSkillDocumentUrl(doc.id);
      if (win) win.location.href = url;
      else window.open(url, "_blank", "noopener");
    } catch (err) {
      win?.close();
      toast.error(errorMessage(err));
    }
  };
  let label = doc.fileName ?? "Document";
  if (doc.kind === "LINK") {
    try {
      label = doc.url ? new URL(doc.url).href.replace(/^https?:\/\/(www\.)?/, "") : "Link";
    } catch {
      label = doc.url ?? "Link";
    }
  }
  const Icon = doc.kind === "FILE" ? FileText : Link2;
  return (
    <li>
      <button
        type="button"
        onClick={() => void open()}
        className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-[15px] transition-colors duration-150 hover:border-border-strong"
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{formatDate(doc.createdAt)}</span>
        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    </li>
  );
}

// ─── The profile decision ─────────────────────────────────────────────────────

function ProfileDecision({
  review: r,
  pending,
  verified,
  onDone,
}: {
  review: ReviewDetail;
  pending: number;
  verified: number;
  onDone: () => Promise<unknown>;
}) {
  const decided = r.reviewStatus === "SUBMITTED" || r.reviewStatus === "APPROVED";
  const approve = useMutation({
    mutationFn: () => adminApi.decideProfile(r.id, { action: "APPROVE" }),
    onSuccess: async () => {
      await onDone();
      toast.success("Profile approved", { description: "The intern has been told by email." });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const blocker = !decided
    ? r.reviewStatus === "CHANGES_REQUESTED"
      ? "Waiting for the intern to send more documents."
      : "The intern hasn't sent their profile for review yet."
    : pending
      ? `Decide every skill first (${pending} still to check).`
      : !verified
        ? "Verify at least one skill to approve."
        : null;

  return (
    <Card>
      <CardHeader
        title="Decision"
        description={
          r.reviewStatus === "APPROVED"
            ? `Approved ${r.reviewedAt ? formatDate(r.reviewedAt) : ""}. Approved interns can be matched with companies.`
            : "Only approved interns are ever shown to companies."
        }
      />
      <CardBody className="grid gap-4">
        {r.reviewStatus === "CHANGES_REQUESTED" && r.reviewNote ? (
          <p className="rounded-lg bg-warning-soft px-4 py-3 text-[15px]">
            <span className="font-semibold">Note sent to the intern: </span>
            {r.reviewNote}
          </p>
        ) : null}
        {blocker && r.reviewStatus !== "APPROVED" ? (
          <p className="flex items-center gap-2 text-[15px] text-muted-foreground">
            <CircleAlert className="size-4 shrink-0" aria-hidden /> {blocker}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {r.reviewStatus !== "APPROVED" || pending ? (
            <Button
              type="button"
              disabled={Boolean(blocker)}
              loading={approve.isPending}
              onClick={() => approve.mutate()}
            >
              <ShieldCheck /> Approve profile
            </Button>
          ) : null}
          {decided ? (
            <NoteDialog
              trigger={
                <Button type="button" variant="outline">
                  <Send /> Ask for more documents
                </Button>
              }
              title="Ask for more documents"
              description="The intern gets this note by email and on their profile. Their profile leaves the queue until they send it again."
              label="What should they add?"
              placeholder="e.g. Please upload the certificate for Video Editing that shows your name."
              confirmLabel="Send to intern"
              onConfirm={(note) => adminApi.decideProfile(r.id, { action: "REQUEST_CHANGES", note })}
              onDone={async () => {
                await onDone();
                toast.success("Sent to the intern");
              }}
            />
          ) : null}
          <NoteDialog
            trigger={
              <Button type="button" variant="ghost" className="text-danger">
                <Trash2 /> Remove profile
              </Button>
            }
            title={`Remove ${r.firstName} ${r.lastName}'s profile?`}
            description="Use this when the intern can't back up their claims. Their account is locked now, they're emailed your reason, and the profile and documents are deleted permanently after 30 days. You can reopen it until then."
            label="Reason (the intern sees this)"
            placeholder="e.g. None of the certificates could be confirmed with the issuer."
            confirmLabel="Remove profile"
            danger
            onConfirm={(reason) => adminApi.decideProfile(r.id, { action: "REMOVE", reason })}
            onDone={async () => {
              await onDone();
              toast.success("Profile removed", { description: "The intern has been emailed the reason." });
            }}
          />
        </div>
      </CardBody>
    </Card>
  );
}

function RemovedBanner({ review: r, onDone }: { review: ReviewDetail; onDone: () => Promise<unknown> }) {
  return (
    <div className="mb-6 grid gap-3 rounded-xl border border-danger/30 bg-danger-soft p-5">
      <p className="flex items-center gap-2 font-semibold text-danger">
        <XCircle className="size-5" aria-hidden /> Removed {r.removedAt ? formatDate(r.removedAt) : ""}
      </p>
      {r.removalReason ? <p className="text-[15px]">Reason: {r.removalReason}</p> : null}
      <p className="text-[15px] text-muted-foreground">
        The account is locked. Everything is deleted permanently on {r.deleteAfter ? formatDate(r.deleteAfter) : "the deletion date"}.
      </p>
      <NoteDialog
        trigger={
          <Button type="button" variant="outline" className="justify-self-start">
            <RotateCcw /> Reopen profile
          </Button>
        }
        title="Reopen this profile?"
        description="The account is unlocked and the intern is asked for more documents with your note."
        label="Note to the intern"
        placeholder="e.g. We've reopened your profile. Please upload the issuer's confirmation letter."
        confirmLabel="Reopen"
        onConfirm={(note) => adminApi.decideProfile(r.id, { action: "RESTORE", note })}
        onDone={async () => {
          await onDone();
          toast.success("Profile reopened");
        }}
      />
    </div>
  );
}

/** A confirm dialog that needs a written reason or note (at least 10 characters). */
function NoteDialog({
  trigger,
  title,
  description,
  label,
  placeholder,
  confirmLabel,
  danger = false,
  onConfirm,
  onDone,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: (text: string) => Promise<unknown>;
  onDone: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const run = useMutation({
    mutationFn: () => onConfirm(text.trim()),
    onSuccess: async () => {
      setOpen(false);
      setText("");
      setError(null);
      await onDone();
    },
    onError: (err) => setError(fieldError(err)),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => (setOpen(o), setError(null))}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        title={title}
        description={description}
        footer={
          <>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant={danger ? "danger" : "primary"}
              loading={run.isPending}
              disabled={text.trim().length < 10}
              onClick={() => run.mutate()}
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        <Field label={label} hint="At least 10 characters." error={error ?? undefined} required>
          <Textarea rows={4} maxLength={1000} value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} />
        </Field>
      </DialogContent>
    </Dialog>
  );
}

// ─── History ──────────────────────────────────────────────────────────────────

const ACTION_LABEL: Record<string, string> = {
  "skill.verified": "verified",
  "skill.rejected": "didn't verify",
  "profile.submitted_for_review": "Sent for review",
  "profile.approved": "Approved the profile",
  "profile.changes_requested": "Asked for more documents",
  "profile.removed": "Removed the profile",
  "profile.restored": "Reopened the profile",
};

function History({ items }: { items: ReviewHistoryItem[] }) {
  if (!items.length) return null;
  return (
    <Card>
      <CardHeader title="History" description="Every review action, who took it and why." />
      <CardBody>
        <ol className="grid gap-4">
          {items.map((h) => {
            const meta = (h.metadata ?? {}) as Record<string, unknown>;
            const why = (meta.reason ?? meta.note) as string | undefined;
            const what = h.skillName
              ? `${ACTION_LABEL[h.action] ?? h.action} ${h.skillName}${
                  h.action === "skill.verified" && meta.lowerThanClaimed ? " at a lower level than claimed" : ""
                }`
              : (ACTION_LABEL[h.action] ?? h.action);
            return (
              <li key={h.id} className="grid gap-0.5 border-l-2 border-border pl-4">
                <p className="text-[15px]">
                  <span className="font-semibold">{h.actorName ?? "The intern"}</span>{" "}
                  <span className={cn(h.skillName ? "" : "lowercase")}>{what}</span>
                </p>
                {why ? <p className="text-sm text-muted-foreground">&ldquo;{why}&rdquo;</p> : null}
                <p className="text-xs text-muted-foreground">{formatDateTime(h.createdAt)}</p>
              </li>
            );
          })}
        </ol>
      </CardBody>
    </Card>
  );
}
