import { BadgeCheck, ClipboardCheck, FileCheck2, GitMerge, MessageSquareText, UserCheck } from "lucide-react";
import type { Metadata } from "next";
import { CtaButton } from "@/components/marketing/chrome";
import { Reveal } from "@/components/marketing/motion";
import { PhotoSlot } from "@/components/marketing/photo-slot";

export const metadata: Metadata = {
  title: "For companies",
  description:
    "Partner with SIIP to host trained, assessed Nigerian graduates as three-month interns. Free to join.",
};

const WHY = [
  {
    icon: UserCheck,
    title: "Graduates who are ready",
    body: "Every candidate has passed screening, finished practical training and passed a final assessment.",
  },
  {
    icon: GitMerge,
    title: "Matches you can understand",
    body: "Each proposal shows a score and the reasons behind it: skills, discipline, location and availability.",
  },
  {
    icon: BadgeCheck,
    title: "Free to partner",
    body: "No recruitment fees. You only commit your time to supervise and give feedback.",
  },
];

const EXPECT = [
  {
    icon: ClipboardCheck,
    title: "Post clear openings",
    body: "Tell us the role, the skills you need, slots, location and schedule.",
  },
  {
    icon: UserCheck,
    title: "Decide within three days",
    body: "Review proposed graduates and accept or decline with a short reason.",
  },
  {
    icon: MessageSquareText,
    title: "A monthly check-in",
    body: "A few lines from the supervisor each month of the three-month internship.",
  },
  {
    icon: FileCheck2,
    title: "One final evaluation",
    body: "Rate five areas at the end. It's required before the certificate is issued.",
  },
];

export default function CompaniesPage() {
  return (
    <>
      <section className="relative isolate m-2.5 overflow-hidden rounded-[32px] bg-night px-6 pt-40 pb-24 text-white sm:rounded-[40px]">
        <div className="absolute inset-0 -z-10 bg-[image:var(--night-texture),var(--night-fill)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div>
            <p className="text-sm font-semibold text-orange">For companies</p>
            <h1 className="mt-3 text-[44px] leading-[1.03] break-words sm:text-7xl">
              Host interns who are ready to work.
            </h1>
            <p className="mt-6 max-w-lg text-lg text-[var(--grey-200)]">
              We train and assess Nigerian graduates, then match them to your openings.
            </p>
            <div className="mt-8">
              <CtaButton href="/sign-up">Become a partner</CtaButton>
            </div>
          </div>
          <PhotoSlot label="Supervisor working with an intern" className="aspect-[4/3] rounded-xl" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24" aria-labelledby="why-title">
        <h2 id="why-title" className="max-w-xl text-4xl sm:text-5xl">
          Why partner with SIIP
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {WHY.map((w, i) => (
            <Reveal
              key={w.title}
              delay={i * 80}
              className="rounded-xl border border-border bg-surface p-7 shadow-sm"
            >
              <w.icon className="size-7 text-brand-text" />
              <h3 className="mt-5 text-xl">{w.title}</h3>
              <p className="mt-2 text-muted-foreground">{w.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section
        className="m-2.5 rounded-[32px] bg-surface-muted px-6 py-24 sm:rounded-[40px]"
        aria-labelledby="expect-title"
      >
        <div className="mx-auto max-w-6xl">
          <h2 id="expect-title" className="max-w-xl text-4xl sm:text-5xl">
            What we ask of you
          </h2>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2">
            {EXPECT.map((e, i) => (
              <Reveal
                as="li"
                key={e.title}
                delay={i * 60}
                className="flex gap-5 rounded-xl bg-surface p-6 shadow-sm"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-secondary font-display text-lg font-semibold text-secondary-foreground">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-xl">{e.title}</h3>
                  <p className="mt-1.5 text-muted-foreground">{e.body}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24" aria-labelledby="how-title">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <h2 id="how-title" className="text-4xl sm:text-5xl">
              How matching works
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Each qualified graduate gets a score out of 100 for your opening. You see the score and the
              reasons before you decide.
            </p>
          </div>
          <ul className="grid gap-3">
            {[
              ["Skills", 40, "The skills you asked for, at the level you need"],
              ["Final assessment", 20, "How well they did after training"],
              ["Discipline", 15, "Course of study against your preferred fields"],
              ["Location", 10, "Same state, or remote-friendly"],
              ["Availability", 10, "Full-time, part-time or weekends"],
              ["NYSC status", 5, "Available for the full three months"],
            ].map(([k, w, d]) => (
              <li
                key={k as string}
                className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4"
              >
                <span className="w-14 shrink-0 font-display text-2xl font-semibold tabular-nums">{w}</span>
                <span>
                  <span className="block font-semibold">{k}</span>
                  <span className="block text-sm text-muted-foreground">{d}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="m-2.5 rounded-[32px] bg-orange px-6 py-24 text-center text-[var(--grey-950)] sm:rounded-[40px]">
        <h2 className="mx-auto max-w-[16ch] text-5xl sm:text-6xl">Ready to host your first intern?</h2>
        <p className="mx-auto mt-4 max-w-md text-lg">
          Register your company. We verify it, then you can post openings.
        </p>
        <div className="mt-8 flex justify-center">
          <CtaButton href="/sign-up" tone="dark">
            Become a partner
          </CtaButton>
        </div>
      </section>
    </>
  );
}
