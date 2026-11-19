"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { contactSchema } from "@siip/shared/validators/auth";
import { authApi } from "@/client/api/auth";
import { errorMessage } from "@/client/api/http";
import { toast } from "sonner";
import { PageHero } from "@/components/marketing/page-hero";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/form-controls";

const schema = contactSchema;

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof schema>>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { topic: "graduate" },
  });
  const onSubmit = handleSubmit(async (values) => {
    try {
      await authApi.sendContactMessage(values);
      setSent(true);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  });

  return (
    <>
      <PageHero
        kicker="Contact"
        title="We're here to help"
        intro="Questions about applying, partnering or a certificate? Send us a message and we'll reply within two working days."
      />
      <section className="mx-auto grid max-w-5xl gap-12 px-6 pb-24 lg:grid-cols-[minmax(0,1fr)_280px]">
        {sent ? (
          <div
            className="flex flex-col items-start rounded-xl border border-border bg-surface p-8"
            role="status"
          >
            <CheckCircle2 className="size-10 text-muted-foreground" />
            <h2 className="mt-4 text-2xl">Message sent</h2>
            <p className="mt-2 text-muted-foreground">
              Thanks for getting in touch. We&apos;ll reply to your email within two working days.
            </p>
            <Button variant="outline" className="mt-6" onClick={() => setSent(false)}>
              Send another message
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Your name" error={errors.name?.message} required>
                <Input autoComplete="name" {...register("name")} />
              </Field>
              <Field label="Email address" error={errors.email?.message} required>
                <Input type="email" autoComplete="email" {...register("email")} />
              </Field>
            </div>
            <Field label="What's it about?" required>
              <Select {...register("topic")}>
                <option value="graduate">Applying as a graduate</option>
                <option value="company">Partnering as a company</option>
                <option value="certificate">Verifying a certificate</option>
                <option value="other">Something else</option>
              </Select>
            </Field>
            <Field label="Message" error={errors.message?.message} required>
              <Textarea rows={6} {...register("message")} />
            </Field>
            <Button type="submit" size="lg" loading={isSubmitting} className="justify-self-start">
              Send message
            </Button>
          </form>
        )}
        <aside className="grid content-start gap-6 text-[15px]">
          <div className="flex gap-3">
            <Mail className="mt-0.5 size-5 text-brand-text" />
            <div className="min-w-0">
              <p className="font-semibold">Email</p>
              <a
                href="mailto:skillzbridgeafrica@gmail.com"
                className="break-all text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                skillzbridgeafrica@gmail.com
              </a>
            </div>
          </div>
        </aside>
      </section>
    </>
  );
}
