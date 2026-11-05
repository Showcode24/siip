"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signInSchema } from "@siip/shared/validators/auth";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { authApi } from "@/client/api/auth";
import { USE_MOCKS } from "@/client/api/http";
import { homeFor, sessionKey } from "@/client/session";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/form-controls";
import { PasswordInput } from "@/components/ui/password-input";
import { handleFormError } from "@/lib/forms";
import { useQueryClient } from "@tanstack/react-query";
import type { Me } from "@/client/api/types";

type Values = z.input<typeof signInSchema>;

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [showPw, setShowPw] = useState(false);
  const verified = params.get("verified");
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(signInSchema), mode: "onTouched" });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await authApi.signIn(values);
      await qc.resetQueries();
      const me = await qc.fetchQuery<Me | null>({ queryKey: sessionKey });
      router.push(params.get("next") ?? homeFor(me));
    } catch (err) {
      handleFormError(err, setError);
    }
  });

  return (
    <>
      <h1 className="text-[32px]">Welcome back</h1>
      <p className="mt-2 text-muted-foreground">Sign in to continue your SIIP journey.</p>
      {verified === "1" ? (
        <p
          className="mt-6 flex items-center gap-2 rounded-lg bg-success-soft px-4 py-3 text-[15px] font-medium text-success"
          role="status"
        >
          <CheckCircle2 className="size-5" /> Email verified. You can sign in now.
        </p>
      ) : verified === "0" ? (
        <p
          className="mt-6 rounded-lg bg-danger-soft px-4 py-3 text-[15px] font-medium text-danger"
          role="alert"
        >
          That verification link is invalid or has expired. Sign in and we&apos;ll send a new one.
        </p>
      ) : null}
      {USE_MOCKS ? (
        <p className="mt-6 rounded-lg bg-info-soft px-4 py-3 text-sm text-info">
          Demo mode: use any demo email (e.g. <b>admin@siip.ng</b>) with any password, or the &quot;Switch
          role&quot; button.
        </p>
      ) : null}
      <form onSubmit={onSubmit} noValidate className="mt-8 grid gap-5">
        <Field label="Email address" error={errors.email?.message} required>
          <Input type="email" inputMode="email" autoComplete="email" {...register("email")} />
        </Field>
        <Field label="Password" error={errors.password?.message} required>
          <PasswordInput
            show={showPw}
            onToggle={() => setShowPw(!showPw)}
            autoComplete="current-password"
            {...register("password")}
          />
        </Field>
        <Link
          href="/forgot-password"
          className="-mt-2 justify-self-end text-sm font-semibold text-brand-text underline-offset-4 hover:underline"
        >
          Forgot password?
        </Link>
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-[15px] text-muted-foreground">
        New to SIIP?{" "}
        <Link href="/sign-up" className="font-semibold text-brand-text underline-offset-4 hover:underline">
          Create a free account
        </Link>
      </p>
    </>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
