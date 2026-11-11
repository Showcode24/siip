"use client";

// Skills backed by proof. Every skill an intern lists needs at least one
// document (a certificate file or a link) before the profile goes to SIIP,
// and each skill is checked on its own. Companies only see verified skills.
import { SkillLevel } from "@siip/shared/enums";
import { SKILL_DOCS } from "@siip/shared/validators/graduate";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Plus,
  Send,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { graduateApi } from "@/client/api/graduate";
import { ApiError, errorMessage } from "@/client/api/http";
import type { GraduateProfile, GraduateSkill, Skill, SkillDocument } from "@/client/api/types";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/display";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/form-controls";
import { ConfirmDialog } from "@/components/ui/overlays";
import { PROFILE_REVIEW, SKILL_LEVEL, SKILL_LEVEL_HINT, SKILL_STATUS } from "@/lib/labels";
import { cn, formatDate } from "@/lib/utils";

export const profileKey = ["graduate", "profile"] as const;
const OTHER = "__other__";
const ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

const sizeLabel = (bytes: number | null) =>
  bytes === null ? "" : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const hostOf = (url: string | null) => {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : "Link";
  } catch {
    return "Link";
  }
};

/** Refreshes the profile after any skill change (status, documents and the review checklist). */
function useRefreshProfile() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: profileKey });
}

// ─── The list of skills ───────────────────────────────────────────────────────

export function SkillsWithProof({
  profile,
  onDone,
  doneLabel = "Continue",
  extra,
}: {
  profile: GraduateProfile;
  /** Wizard: move on once every skill has proof. */
  onDone?: () => void;
  doneLabel?: string;
  extra?: ReactNode;
}) {
  const catalogue = useQuery({ queryKey: ["skills"], queryFn: graduateApi.listSkills, staleTime: Infinity });
  const [adding, setAdding] = useState(profile.skills.length === 0);
  const missingProof = profile.skillsWithoutProof.length;

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <p className="text-[15px] text-muted-foreground">
          Add each skill you can offer, the level you work at, and proof of it. SIIP checks every skill
          before companies see it.
        </p>
        <p className="rounded-lg bg-primary-soft/50 px-4 py-3 text-[15px]">
          Don&apos;t have a certificate? Complete a certification course (e.g. Coursera, Udemy) and upload it
          here.
        </p>
      </div>

      {profile.skills.length ? (
        <ul className="grid gap-3">
          {profile.skills.map((s) => (
            <SkillCard key={s.id} skill={s} locked={profile.reviewStatus === "SUBMITTED"} />
          ))}
        </ul>
      ) : null}

      {adding ? (
        <AddSkillForm
          catalogue={catalogue.data ?? []}
          taken={profile.skills}
          onAdded={() => setAdding(false)}
          onCancel={profile.skills.length ? () => setAdding(false) : undefined}
        />
      ) : (
        <Button type="button" variant="outline" className="justify-self-start" onClick={() => setAdding(true)}>
          <Plus /> Add another skill
        </Button>
      )}

      {onDone ? (
        <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div>{extra}</div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            {missingProof ? (
              <p className="text-sm text-muted-foreground">
                {missingProof === 1 ? "1 skill still needs proof." : `${missingProof} skills still need proof.`}
              </p>
            ) : null}
            <Button
              type="button"
              size="lg"
              disabled={!profile.skills.length || missingProof > 0}
              onClick={onDone}
            >
              {doneLabel}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── One skill: level, status and its proof ───────────────────────────────────

function SkillCard({ skill, locked }: { skill: GraduateSkill; locked: boolean }) {
  const refresh = useRefreshProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const full = skill.documents.length >= SKILL_DOCS.maxPerSkill;

  const run = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => refresh(),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const upload = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!(SKILL_DOCS.formats as readonly string[]).includes(ext)) {
      return toast.error("Upload a PDF, JPG or PNG file");
    }
    if (file.size > SKILL_DOCS.maxBytes) return toast.error("That file is over 5 MB");
    run.mutate(() => graduateApi.addSkillFile(skill.id, file), {
      onSuccess: () => toast.success("Document added"),
    });
  };

  const addLink = async () => {
    setLinkError(null);
    try {
      await graduateApi.addSkillLink(skill.id, link.trim());
      setLink("");
      setLinkOpen(false);
      toast.success("Link added");
      refresh();
    } catch (err) {
      const details = err instanceof ApiError && Array.isArray(err.details) ? err.details : null;
      setLinkError((details?.[0] as { message?: string } | undefined)?.message ?? errorMessage(err));
    }
  };

  return (
    <li className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold">{skill.name}</p>
          <p className="text-sm text-muted-foreground">
            {skill.category}
            {skill.issuingBody ? `, from ${skill.issuingBody}` : ""}
            {skill.issuedAt ? `, ${formatDate(skill.issuedAt)}` : ""}
          </p>
        </div>
        <StatusPill map={SKILL_STATUS} value={skill.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor={`level-${skill.id}`}>
          Your level in {skill.name}
        </label>
        <Select
          id={`level-${skill.id}`}
          className="h-10 w-44"
          value={skill.level}
          disabled={run.isPending}
          onChange={(e) =>
            run.mutate(() => graduateApi.updateSkill(skill.id, { level: e.target.value as SkillLevel }), {
              onSuccess: () =>
                toast.success(
                  skill.status === "PENDING" ? "Level updated" : "Level updated. SIIP will check this skill again.",
                ),
            })
          }
        >
          {Object.values(SkillLevel).map((l) => (
            <option key={l} value={l}>
              {SKILL_LEVEL[l]}
            </option>
          ))}
        </Select>
        {skill.status === "VERIFIED" && skill.verifiedLevel ? (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-success">
            <CheckCircle2 className="size-4" aria-hidden /> Verified as {SKILL_LEVEL[skill.verifiedLevel]}
          </p>
        ) : null}
      </div>

      {skill.status === "REJECTED" && skill.rejectionReason ? (
        <p className="mt-3 flex gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {skill.rejectionReason} Add new proof and SIIP will look again.
          </span>
        </p>
      ) : null}

      <div className="mt-4 grid gap-2">
        <p className="text-sm font-semibold">Proof</p>
        {skill.documents.length ? (
          <ul className="grid gap-1.5">
            {skill.documents.map((d) => (
              <DocumentRow key={d.id} skillId={skill.id} doc={d} canRemove={!(locked && skill.documents.length === 1)} />
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-sm text-warning">
            <CircleAlert className="size-4" aria-hidden /> Add at least one document for this skill.
          </p>
        )}

        {linkOpen ? (
          <div className="grid gap-2 rounded-lg bg-surface-muted p-3">
            <Field label="Link to your certificate or work" error={linkError ?? undefined}>
              <Input
                type="url"
                inputMode="url"
                placeholder="https://www.coursera.org/verify/..."
                value={link}
                onChange={(e) => setLink(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addLink();
                  }
                }}
              />
            </Field>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={() => void addLink()} disabled={!link.trim()}>
                Add link
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setLinkOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-1">
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) upload(file);
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={full || run.isPending}
            onClick={() => fileRef.current?.click()}
          >
            {run.isPending ? <Loader2 className="animate-spin" /> : <UploadCloud />} Upload a file
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={full || linkOpen}
            onClick={() => setLinkOpen(true)}
          >
            <Link2 /> Add a link
          </Button>
          <ConfirmDialog
            trigger={
              <Button type="button" size="sm" variant="ghost" className="ml-auto text-danger">
                <Trash2 /> Remove skill
              </Button>
            }
            title={`Remove ${skill.name}?`}
            description="Its documents are removed too. You can add the skill again later."
            confirmLabel="Remove skill"
            onConfirm={() => run.mutateAsync(() => graduateApi.removeSkill(skill.id))}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          PDF, JPG or PNG up to 5 MB, or a link. Up to {SKILL_DOCS.maxPerSkill} per skill.
        </p>
      </div>
    </li>
  );
}

function DocumentRow({ skillId, doc, canRemove }: { skillId: string; doc: SkillDocument; canRemove: boolean }) {
  const refresh = useRefreshProfile();
  const [busy, setBusy] = useState(false);
  const open = async () => {
    // Files open through a short-lived signed link; fetch it at click time.
    const win = window.open("", "_blank", "noopener");
    try {
      const { url } = await graduateApi.getSkillDocumentUrl(doc.id);
      if (win) win.location.href = url;
      else window.open(url, "_blank", "noopener");
    } catch (err) {
      win?.close();
      toast.error(errorMessage(err));
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await graduateApi.removeSkillDocument(skillId, doc.id);
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const Icon = doc.kind === "FILE" ? FileText : Link2;
  return (
    <li className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <button
        type="button"
        onClick={() => void open()}
        className="flex min-w-0 flex-1 items-center gap-1.5 rounded-sm text-left text-[15px] font-medium hover:underline"
      >
        <span className="truncate">{doc.kind === "FILE" ? doc.fileName : hostOf(doc.url)}</span>
        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </button>
      {doc.kind === "FILE" ? (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{sizeLabel(doc.bytes)}</span>
      ) : null}
      {canRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${doc.kind === "FILE" ? doc.fileName : "link"}`}
          disabled={busy}
          onClick={() => void remove()}
        >
          <X />
        </Button>
      ) : null}
    </li>
  );
}

// ─── Adding a skill ───────────────────────────────────────────────────────────

function AddSkillForm({
  catalogue,
  taken,
  onAdded,
  onCancel,
}: {
  catalogue: Skill[];
  taken: GraduateSkill[];
  onAdded: () => void;
  onCancel?: () => void;
}) {
  const refresh = useRefreshProfile();
  const [choice, setChoice] = useState("");
  const [otherName, setOtherName] = useState("");
  const [level, setLevel] = useState<SkillLevel | "">("");
  const [issuingBody, setIssuingBody] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Group the list by area, leaving out skills already added.
  const groups = useMemo(() => {
    const takenIds = new Set(taken.map((t) => t.skillId));
    const map = new Map<string, Skill[]>();
    for (const s of catalogue) {
      if (takenIds.has(s.id)) continue;
      const key = s.category ?? "More skills";
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [catalogue, taken]);

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!choice) next.skillId = "Choose a skill";
    if (choice === OTHER && otherName.trim().length < 2) next.otherName = "Name the skill";
    if (!level) next.level = "Choose your level";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await graduateApi.addSkill({
        ...(choice === OTHER ? { otherName: otherName.trim() } : { skillId: choice }),
        level: level as SkillLevel,
        issuingBody: issuingBody.trim() || null,
        issuedAt: issuedAt || null,
      });
      await refresh();
      toast.success("Skill added. Now add proof for it.");
      onAdded();
    } catch (err) {
      const details = err instanceof ApiError && Array.isArray(err.details) ? err.details : [];
      const fieldErrors = Object.fromEntries(
        (details as Array<{ path?: string; message?: string }>).map((d) => [d.path ?? "", d.message ?? ""]),
      );
      if (Object.keys(fieldErrors).length) setErrors(fieldErrors);
      else toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 rounded-xl border border-dashed border-border-strong p-4 sm:p-5">
      <p className="font-display text-lg font-semibold">Add a skill</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Skill" error={errors.skillId} required>
          <Select value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="">Choose a skill</option>
            {groups.map(([category, skills]) => (
              <optgroup key={category} label={category}>
                {skills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value={OTHER}>Other (not listed)</option>
          </Select>
        </Field>
        {choice === OTHER ? (
          <Field label="Name of the skill" error={errors.otherName} required>
            <Input value={otherName} maxLength={80} onChange={(e) => setOtherName(e.target.value)} />
          </Field>
        ) : null}
        <Field
          label="Your level"
          hint={level ? SKILL_LEVEL_HINT[level] : "Choose the level your proof supports."}
          error={errors.level}
          required
        >
          <Select value={level} onChange={(e) => setLevel(e.target.value as SkillLevel | "")}>
            <option value="">Choose</option>
            {Object.values(SkillLevel).map((l) => (
              <option key={l} value={l}>
                {SKILL_LEVEL[l]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Issued by" optional hint="e.g. Coursera, Udemy, a professional body" error={errors.issuingBody}>
          <Input value={issuingBody} maxLength={120} onChange={(e) => setIssuingBody(e.target.value)} />
        </Field>
        <Field label="Date issued" optional error={errors.issuedAt}>
          <Input
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={issuedAt}
            onChange={(e) => setIssuedAt(e.target.value)}
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" loading={busy} onClick={() => void submit()}>
          <Plus /> Add skill
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}

// ─── Sending the profile to SIIP ──────────────────────────────────────────────

/** Where the profile stands in SIIP's review, and the button to send it. */
export function ReviewSubmitCard({ profile, className }: { profile: GraduateProfile; className?: string }) {
  const refresh = useRefreshProfile();
  const send = useMutation({
    mutationFn: graduateApi.submitForReview,
    onSuccess: () => {
      refresh();
      toast.success("Sent to SIIP", { description: "We'll check your documents and let you know." });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const status = profile.reviewStatus;
  const todo = [
    ...profile.missingForApplication,
    ...profile.skillsWithoutProof.map((n) => `Proof for ${n}`),
  ];
  const canSend = (status === "DRAFT" || status === "CHANGES_REQUESTED") && todo.length === 0;

  return (
    <div className={cn("grid gap-4 rounded-xl border border-border bg-surface p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-display text-lg font-semibold">SIIP review</p>
        <StatusPill map={PROFILE_REVIEW} value={status} />
      </div>
      {status === "SUBMITTED" ? (
        <p className="text-[15px] text-muted-foreground">
          Sent {profile.submittedAt ? formatDate(profile.submittedAt) : ""}. SIIP is checking your documents.
          You&apos;ll hear from us by email.
        </p>
      ) : status === "APPROVED" ? (
        <p className="text-[15px] text-muted-foreground">
          Your skills are checked. You&apos;re on the list for matching with companies.
        </p>
      ) : (
        <>
          {status === "CHANGES_REQUESTED" && profile.reviewNote ? (
            <p className="rounded-lg bg-warning-soft px-4 py-3 text-[15px]">
              <span className="font-semibold">From SIIP: </span>
              {profile.reviewNote}
            </p>
          ) : null}
          {todo.length ? (
            <div>
              <p className="text-[15px]">Before you send your profile:</p>
              <ul className="mt-2 grid gap-1.5">
                {todo.map((t) => (
                  <li key={t} className="flex items-center gap-2 text-[15px] text-muted-foreground">
                    <CircleAlert className="size-4 shrink-0 text-warning" aria-hidden /> {t}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[15px] text-muted-foreground">
              Everything is ready. SIIP will check each skill against your documents.
            </p>
          )}
          <Button
            type="button"
            size="lg"
            className="justify-self-start"
            disabled={!canSend}
            loading={send.isPending}
            onClick={() => send.mutate()}
          >
            <Send /> {status === "CHANGES_REQUESTED" ? "Send again" : "Send for review"}
          </Button>
        </>
      )}
    </div>
  );
}
