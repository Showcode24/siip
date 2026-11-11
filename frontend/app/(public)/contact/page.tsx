"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Mail, MessageCircle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PageHero } from "@/components/marketing/page-hero";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/form-controls";

const schema = z.object({
  name: z.string().trim().min(2, "Tell us your name"),
  email: z.email("Enter a valid email address"),
  topic: z.enum(["graduate", "company", "certificate", "other"]),
  message: z.string().trim().min(10, "Add a few more details").max(2000),
});

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
  // Backend gap: there's no contact endpoint yet; this simulates a successful send.
  const onSubmit = handleSubmit(async () => {
    await new Promise((r) => setTimeout(r, 600));
    setSent(true);
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
            <h2 className="mt-4 text-2xl">Your message is ready</h2>
            <p className="mt-2 text-muted-foreground">
              This form isn&apos;t connected yet, so nothing was sent. Once it is, we&apos;ll reply to your email.
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
          {[
            [Mail, "Email", "hello@siip.ng"],
            [MessageCircle, "WhatsApp", "+234 800 000 0000 (placeholder)"],
          ].map(([Icon, label, value]) => {
            const I = Icon as typeof Mail;
            return (
              <div key={label as string} className="flex gap-3">
                <I className="mt-0.5 size-5 text-brand-text" />
                <div>
                  <p className="font-semibold">{label as string}</p>
                  <p className="text-muted-foreground">{value as string}</p>
                </div>
              </div>
            );
          })}
        </aside>
      </section>
    </>
  );
}
