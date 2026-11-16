"use client";

import { useState } from "react";
import { toast } from "sonner";
import { authApi } from "@/client/api/auth";
import { errorMessage } from "@/client/api/http";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/display";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";

/** Changing the password also signs out every other device. */
export function ChangePasswordCard() {
  const [show, setShow] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const weak = next.length > 0 && !(next.length >= 8 && /[A-Za-z]/.test(next) && /\d/.test(next));
  return (
    <Card>
      <CardHeader title="Change password" />
      <CardBody>
        <form
          className="grid max-w-md gap-5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (weak || !current) return;
            setBusy(true);
            try {
              const { message } = await authApi.changePassword(current, next);
              setCurrent("");
              setNext("");
              toast.success(message);
            } catch (err) {
              toast.error(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Current password" required>
            <PasswordInput
              show={show}
              onToggle={() => setShow(!show)}
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>
          <Field
            label="New password"
            hint="At least 8 characters, with a letter and a number."
            error={weak ? "Use at least 8 characters, with a letter and a number." : undefined}
            required
          >
            <PasswordInput
              show={show}
              onToggle={() => setShow(!show)}
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          <Button
            type="submit"
            loading={busy}
            disabled={!current || !next || weak}
            className="justify-self-start"
          >
            Update password
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
