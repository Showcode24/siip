"use client";

import { Download, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { authApi } from "@/client/api/auth";
import { errorMessage } from "@/client/api/http";
import { useResetSession } from "@/client/session";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/display";
import { Field } from "@/components/ui/field";
import { Input, Switch } from "@/components/ui/form-controls";
import { ConfirmDialog } from "@/components/ui/overlays";
import { downloadFile } from "@/lib/csv";

/** NDPA tools: download my data, delete my account. Shared by every portal's settings. */
export function PrivacyCard({
  canDelete = true,
  cannotDeleteReason,
}: {
  canDelete?: boolean;
  cannotDeleteReason?: string;
}) {
  const [exporting, setExporting] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const router = useRouter();
  const reset = useResetSession();
  return (
    <Card>
      <CardHeader
        title="Your data"
        description="Under the Nigeria Data Protection Act 2023 you can download or delete your data at any time."
      />
      <CardBody className="grid gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Download my data</p>
            <p className="text-sm text-muted-foreground">A JSON file with everything SIIP holds about you.</p>
          </div>
          <Button
            variant="outline"
            loading={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                downloadFile(
                  `siip-my-data-${new Date().toISOString().slice(0, 10)}.json`,
                  await authApi.exportMyData(),
                );
              } catch (err) {
                toast.error(errorMessage(err));
              } finally {
                setExporting(false);
              }
            }}
          >
            <Download /> Download
          </Button>
        </div>
        <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-danger">Delete my account</p>
            <p className="text-sm text-muted-foreground">
              {canDelete
                ? "You'll be signed out. Your personal data is anonymised after 30 days."
                : cannotDeleteReason}
            </p>
          </div>
          {canDelete ? (
            <ConfirmDialog
              trigger={
                <Button variant="danger">
                  <Trash2 /> Delete account
                </Button>
              }
              title="Delete your account?"
              description="Your current application is withdrawn and you're signed out everywhere. After 30 days your personal data is permanently anonymised."
              confirmLabel="Delete my account"
              onConfirm={async () => {
                if (confirm !== "DELETE") {
                  toast.error('Type "DELETE" to confirm');
                  throw new Error("not confirmed");
                }
                try {
                  await authApi.deleteAccount(password);
                  reset();
                  toast.success("Your account has been deleted");
                  router.push("/");
                } catch (err) {
                  toast.error(errorMessage(err));
                  throw err;
                }
              }}
            >
              <div className="grid gap-4">
                <Field label="Your password" required>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
                <Field label='Type "DELETE" to confirm' required>
                  <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
                </Field>
              </div>
            </ConfirmDialog>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * Email preference toggles. Backend gap: there's no preferences endpoint yet,
 * so these are kept on this device only (see FRONTEND.md).
 */
export function NotificationSettingsCard({
  options,
}: {
  options: Array<{ key: string; label: string; hint: string }>;
}) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem("siip-notify-prefs") ?? "{}");
    } catch {
      return {};
    }
  });
  const set = (k: string, v: boolean) => {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    localStorage.setItem("siip-notify-prefs", JSON.stringify(next));
    toast.success("Preference saved");
  };
  return (
    <Card>
      <CardHeader
        title="Email notifications"
        description="Important account emails (like password resets) are always sent."
      />
      <CardBody className="grid gap-5">
        {options.map((o) => (
          <label key={o.key} className="flex items-center justify-between gap-4">
            <span>
              <span className="block font-semibold">{o.label}</span>
              <span className="block text-sm text-muted-foreground">{o.hint}</span>
            </span>
            <Switch checked={prefs[o.key] ?? true} onCheckedChange={(v) => set(o.key, v)} />
          </label>
        ))}
      </CardBody>
    </Card>
  );
}
