"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { authApi } from "@/client/api/auth";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/client/api/http";

function VerifyEmail() {
  const email = useSearchParams().get("email") ?? "";
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function resend() {
    setSending(true);
    try {
      const { message } = await authApi.resendVerification(email);
      toast.success(message);
      setCooldown(60);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="text-center">
      <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary-soft text-brand-text">
        <MailCheck className="size-8" />
      </span>
      <h1 className="mt-6 text-[32px]">Check your email</h1>
      <p className="mt-3 text-muted-foreground">
        We sent a verification link to {email ? <b className="text-foreground">{email}</b> : "your email"}.
        Open it to activate your account. The link expires in 24 hours.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Can&apos;t find it? Check your spam or promotions folder.
      </p>
      <div className="mt-8 grid gap-3">
        <Button
          size="lg"
          variant="outline"
          onClick={resend}
          loading={sending}
          disabled={!email || cooldown > 0}
        >
          {cooldown ? `Resend in ${cooldown}s` : "Resend the email"}
        </Button>
        <Button asChild size="lg" variant="ghost">
          <Link href="/sign-in">Back to sign in</Link>
        </Button>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}
