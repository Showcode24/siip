"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema } from "@siip/shared/validators/auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { authApi } from "@/client/api/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { handleFormError } from "@/lib/forms";

const formSchema = resetPasswordSchema
  .extend({ confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "The passwords don't match" });

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [show, setShow] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onTouched",
    defaultValues: { token },
  });

  const onSubmit = handleSubmit(async (v) => {
    try {
      const { message } = await authApi.resetPassword(v.token, v.newPassword);
      toast.success(message);
      router.push("/sign-in");
    } catch (err) {
      handleFormError(err, setError);
    }
  });

  if (!token) {
    return (
      <div className="text-center">
        <h1 className="text-[32px]">This link isn&apos;t complete</h1>
        <p className="mt-3 text-muted-foreground">
          Open the reset link from your email again, or request a new one.
        </p>
        <Button asChild size="lg" className="mt-8 w-full">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }
  return (
    <>
      <h1 className="text-[32px]">Choose a new password</h1>
      <p className="mt-2 text-muted-foreground">You&apos;ll be signed out on your other devices.</p>
      <form onSubmit={onSubmit} noValidate className="mt-8 grid gap-5">
        <Field
          label="New password"
          hint="At least 8 characters, with a letter and a number."
          error={errors.newPassword?.message}
          required
        >
          <PasswordInput
            show={show}
            onToggle={() => setShow(!show)}
            autoComplete="new-password"
            {...register("newPassword")}
          />
        </Field>
        <Field label="Confirm new password" error={errors.confirm?.message} required>
          <PasswordInput
            show={show}
            onToggle={() => setShow(!show)}
            autoComplete="new-password"
            {...register("confirm")}
          />
        </Field>
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          Reset password
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
