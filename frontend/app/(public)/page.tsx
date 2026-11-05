import { Check, GraduationCap, Lock, ShieldCheck, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CtaButton } from "@/components/marketing/chrome";
import {
  CardArc,
  LightUpText,
  Reveal,
  StickySteps,
  Tilt,
  W,
  WordReveal,
} from "@/components/marketing/motion";
import { PhotoSlot } from "@/components/marketing/photo-slot";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "From graduate to hired",
  description:
    "Free training, assessment and three-month internships with verified Nigerian companies. Apply in about ten minutes.",
};

const SKILLS = [
  "Social Media Management",
  "Content Creation",
  "Smartphone Videography",
  "Video Editing",
  "Photo Editing",
  "Graphic Design",
  "Digital Marketing",
  "Customer Service",
  "Data Entry",
  "Microsoft Excel",
  "Copywriting",
  "Basic Web Design",
  "Sales",
  "Administration",
  "Research",
];

const STEPS = [
  {
    title: "Register and build your profile",
    body: "Sign up free, add your degree, NYSC status and skills, and upload your CV.",
  },
  {
    title: "Take the screening test",
    body: "A short, timed test that is scored instantly. Then our team reviews your application.",
  },
  { title: "Train for real work", body: "Practical courses you can follow on your phone, at your own pace." },
  { title: "Pass the final assessment", body: "Show what you've learned and qualify for placement." },
  {
    title: "Get matched to a company",
    body: "We match you on skills, discipline, location and availability.",
  },
  {
    title: "Do a three-month internship",
    body: "Work with a supervisor and share a short check-in every month.",
  },
  { title: "Earn a verified certificate", body: "Employers can confirm it is genuine in seconds." },
];

const FAQ = [
  [
    "Does SIIP cost anything?",
    "No. Training, assessments, placement and your certificate are completely free. We will never ask you to pay.",
  ],
  [
    "Can NYSC corps members apply?",
    "Yes. Tell us your NYSC status when you register. Many partner openings welcome serving corps members.",
  ],
  [
    "What do I need to apply?",
    "Your degree details, the state you live in, your availability, a PDF of your CV and at least one skill.",
  ],
  [
    "Is the internship paid?",
    "Each partner company sets its own terms. You'll see the details before you start.",
  ],
  [
    "I'm a company. How do we take part?",
    "Register your company, get verified, then post openings. We send you trained, assessed graduates.",
  ],
];

function MiniCard({
  children,
  tone = "light",
}: {
  children: React.ReactNode;
  tone?: "light" | "dark" | "orange";
}) {
  const tones = {
    light: "bg-white text-[var(--grey-900)]",
    dark: "bg-charcoal text-white",
    orange: "bg-orange text-[var(--grey-950)]",
  };
  return <div className={`rounded-lg p-4 shadow-lg ${tones[tone]}`}>{children}</div>;
}

function PhoneScreen({ i }: { i: number }) {
  const bars = Array.from({ length: 7 }, (_, k) => (
    <i
      key={k}
      className={`h-1.5 rounded-full ${k < i ? "bg-secondary" : k === i ? "bg-orange" : "bg-border"}`}
    />
  ));
  const screens = [
    ["Profile", "Build your profile", "Education, NYSC status, skills and CV.", "Profile strength 72%"],
    ["Screening", "Screening test", "Short questions, scored instantly.", "Start test"],
    ["Training", "Writing a great work email", "Lesson 7 of 10 · 12 min", "Continue lesson"],
    ["Result", "You passed: 84%", "You're qualified for placement.", "See what's next"],
    ["Matching", "Matched with a partner", "Social media intern · Hybrid", "Awaiting the company"],
    ["Internship", "Month 2 of 3", "Submit your monthly check-in.", "Submit check-in"],
    ["Certified", "Certificate issued", "Verification code K7QX-29MD", "Download PDF"],
  ][i];
  return (
    <div>
      <p className="font-display text-sm font-semibold">{screens[0]}</p>
      <div className="mt-2 mb-4 grid grid-cols-7 gap-1">{bars}</div>
      <div className="rounded-lg bg-surface p-4 shadow-md">
        <p className="font-display text-lg leading-tight font-semibold">{screens[1]}</p>
        <p className="mt-1 text-sm text-muted-foreground">{screens[2]}</p>
        <div className="mt-4 grid h-10 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {screens[3]}
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section
        className="relative isolate m-2.5 overflow-hidden rounded-[32px] bg-night pt-36 pb-10 text-white sm:rounded-[40px] sm:pt-40"
        aria-labelledby="hero-title"
      >
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(55%_45%_at_50%_100%,rgb(232_101_12/0.45),transparent_70%),radial-gradient(35%_30%_at_85%_8%,rgb(232_101_12/0.14),transparent_70%),repeating-linear-gradient(90deg,rgb(255_255_255/0.035)_0_1px,transparent_1px_72px),linear-gradient(180deg,var(--grey-950),var(--grey-900)_55%,var(--grey-800))]" />
        <div className="mx-auto max-w-5xl px-6 text-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 ring-1 ring-white/20">
            <ShieldCheck className="size-4 text-orange" /> Free for every Nigerian graduate
          </p>
          <WordReveal
            text="From graduate to hired in seven steps."
            accent="hired"
            className="mx-auto mt-6 max-w-[14ch] font-display text-[44px] leading-[1.02] font-semibold tracking-[-0.04em] break-words sm:text-[64px] lg:text-[92px]"
          />
          <p className="mx-auto mt-6 max-w-[46ch] text-lg text-[var(--grey-200)] sm:text-xl">
            Free training, then a three-month internship with a verified Nigerian company.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <CtaButton href="/sign-up">Start your application</CtaButton>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="text-white ring-1 ring-white/40 hover:bg-white/10"
            >
              <Link href="/companies">I&apos;m hiring interns</Link>
            </Button>
          </div>
        </div>
        <div className="mt-10">
          <CardArc
            cards={[
              {
                x: -560,
                z: -260,
                ry: 38,
                width: 160,
                hideOnMobile: true,
                node: (
                  <MiniCard>
                    <p className="text-xs font-semibold text-[var(--grey-500)]">Skill area</p>
                    <p className="mt-2 font-display text-xl font-semibold">Excel</p>
                  </MiniCard>
                ),
              },
              {
                x: -370,
                z: -110,
                ry: 26,
                width: 190,
                node: (
                  <MiniCard>
                    <p className="text-xs font-semibold text-[var(--grey-500)]">Application</p>
                    <p className="mt-3 flex items-center gap-2 font-semibold">
                      <span className="grid size-7 place-items-center rounded-full bg-[var(--success)] text-white">
                        <Check className="size-4" strokeWidth={3} />
                      </span>
                      Shortlisted
                    </p>
                  </MiniCard>
                ),
              },
              {
                x: -185,
                z: -20,
                ry: 13,
                width: 180,
                node: <PhotoSlot label="Graduate portrait" className="aspect-[4/5] rounded-lg shadow-lg" />,
              },
              {
                x: 0,
                z: 30,
                ry: 0,
                width: 210,
                node: (
                  <MiniCard>
                    <p className="text-xs font-semibold text-[var(--grey-500)]">Training</p>
                    <p className="mt-2 font-display text-3xl font-semibold">6 of 10</p>
                    <div className="mt-3 h-1.5 rounded-full bg-[var(--grey-100)]">
                      <div className="h-full w-3/5 rounded-full bg-orange-deep" />
                    </div>
                  </MiniCard>
                ),
              },
              {
                x: 185,
                z: -20,
                ry: -13,
                width: 180,
                node: (
                  <MiniCard tone="dark">
                    <p className="text-xs font-semibold text-[var(--grey-200)]">Match score</p>
                    <p className="mt-2 font-display text-3xl font-semibold">87%</p>
                    <p className="mt-1 text-xs text-[var(--grey-200)]">Skills, location, availability</p>
                  </MiniCard>
                ),
              },
              {
                x: 370,
                z: -110,
                ry: -26,
                width: 190,
                node: (
                  <MiniCard tone="orange">
                    <p className="text-xs font-semibold">Placed</p>
                    <p className="mt-2 font-display text-lg leading-tight font-semibold">
                      Three-month internship
                    </p>
                  </MiniCard>
                ),
              },
              {
                x: 560,
                z: -260,
                ry: -38,
                width: 160,
                hideOnMobile: true,
                node: (
                  <MiniCard>
                    <p className="text-xs font-semibold text-[var(--grey-500)]">Certificate</p>
                    <p className="mt-3 flex items-center gap-2 font-semibold">
                      <ShieldCheck className="size-5 text-[var(--success)]" />
                      Verified
                    </p>
                  </MiniCard>
                ),
              },
            ]}
          />
        </div>
      </section>

      {/* Skill areas marquee */}
      <section
        aria-label="Skill areas"
        className="overflow-hidden py-10 [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]"
      >
        <ul className="flex w-max gap-4 motion-safe:animate-marquee hover:[animation-play-state:paused]">
          {[...SKILLS, ...SKILLS].map((s, i) => (
            <li
              key={i}
              aria-hidden={i >= SKILLS.length || undefined}
              className="rounded-full border border-border bg-surface px-5 py-2.5 text-[15px] font-medium whitespace-nowrap text-muted-foreground"
            >
              {s}
            </li>
          ))}
        </ul>
      </section>

      {/* Statement */}
      <section className="mx-auto max-w-5xl px-6 py-24 text-center sm:py-32">
        <LightUpText className="mx-auto max-w-[22ch] font-display text-[32px] leading-[1.15] font-semibold sm:text-5xl lg:text-[60px]">
          <W>We build the bridge</W>
          <Chip tone="dark">
            <BridgeIcon />
          </Chip>{" "}
          <W>from the classroom</W>
          <Chip tone="dark">
            <GraduationCap />
          </Chip>{" "}
          <W>to real work</W>
          <Chip tone="orange">
            <Wrench />
          </Chip>{" "}
          <W>so talented graduates stop waiting and start working.</W>
        </LightUpText>
      </section>

      {/* Programme facts */}
      <section aria-labelledby="facts-title" className="mx-auto max-w-6xl px-6">
        <h2 id="facts-title" className="sr-only">
          The programme at a glance
        </h2>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <Reveal className="relative min-h-[420px] overflow-hidden rounded-xl md:row-span-2">
            <PhotoSlot label="Interns at a partner company" className="absolute inset-0" />
            <div className="absolute inset-x-5 bottom-5 rounded-lg bg-surface p-6 shadow-lg">
              <p className="font-display text-5xl font-semibold tracking-tight">7 steps</p>
              <p className="mt-2 text-muted-foreground">
                From sign-up to a verified certificate, with a clear next action at every stage.
              </p>
            </div>
          </Reveal>
          <Reveal
            delay={80}
            className="flex min-h-60 flex-col justify-between rounded-xl border border-border bg-surface p-7 shadow-sm"
          >
            <p className="text-sm font-semibold text-muted-foreground">What graduates pay</p>
            <p className="font-display text-6xl font-semibold tracking-tight">₦0</p>
            <p className="text-muted-foreground">Training, assessment, placement and certificate are free.</p>
          </Reveal>
          <Reveal
            delay={160}
            className="flex min-h-60 flex-col justify-between rounded-xl bg-orange p-7 text-[var(--grey-950)]"
          >
            <p className="text-sm font-semibold">Internship length</p>
            <p className="font-display text-6xl font-semibold tracking-tight">3 months</p>
            <p>With a supervisor, monthly check-ins and a final evaluation.</p>
          </Reveal>
          <Reveal
            delay={240}
            className="flex min-h-40 items-center justify-between gap-6 rounded-xl bg-night-2 p-7 text-white md:col-span-2"
          >
            <p className="max-w-xs text-[var(--grey-200)]">
              Apply from anywhere in Nigeria. Train on your phone.
            </p>
            <p className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">36 states + FCT</p>
          </Reveal>
        </div>
      </section>

      {/* Journey */}
      <section
        id="journey"
        aria-labelledby="journey-title"
        className="mx-auto max-w-6xl scroll-mt-24 px-6 pt-28 pb-12"
      >
        <Reveal className="text-center">
          <h2 id="journey-title" className="text-4xl sm:text-6xl">
            Seven steps. One clear path.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            You always know where you are and what to do next.
          </p>
        </Reveal>
        <div className="mt-12">
          <StickySteps
            steps={STEPS}
            screens={STEPS.map((_, i) => (
              <PhoneScreen key={i} i={i} />
            ))}
          />
        </div>
      </section>

      {/* For companies */}
      <section
        aria-labelledby="co-title"
        className="m-2.5 rounded-[32px] bg-surface-muted py-24 sm:rounded-[40px]"
      >
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 lg:grid-cols-2">
          <Reveal>
            <p className="text-sm font-semibold text-brand-text">For companies</p>
            <h2 id="co-title" className="mt-3 text-4xl sm:text-5xl">
              Trained graduates, matched to your openings.
            </h2>
            <p className="mt-5 max-w-lg text-lg text-muted-foreground">
              Post an opening with the skills you need. We send graduates who have passed screening, training
              and a final assessment, with a score that shows why they fit.
            </p>
            <ul className="mt-6 grid gap-3">
              {[
                "Free to partner. No recruitment fees.",
                "See exactly why each graduate was matched.",
                "Monthly check-ins and one final evaluation.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-brand-text">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <CtaButton href="/companies" tone="dark">
                Become a partner
              </CtaButton>
            </div>
          </Reveal>
          <Reveal delay={120} className="rounded-xl bg-surface p-7 shadow-lg">
            <p className="text-sm text-muted-foreground">Example of a proposed match</p>
            <div className="mt-3 flex items-center gap-5">
              <div
                className="relative grid size-24 shrink-0 place-items-center rounded-full"
                style={{
                  background: "conic-gradient(var(--orange-500) 0 87%, var(--surface-muted) 87% 100%)",
                }}
              >
                <div className="grid size-[76px] place-items-center rounded-full bg-surface font-display text-2xl font-semibold">
                  87%
                </div>
              </div>
              <div>
                <p className="font-display text-xl font-semibold">Graduate, Mass Communication</p>
                <p className="text-sm text-muted-foreground">University of Lagos · Second Class Upper</p>
              </div>
            </div>
            {[
              ["Skills", 95],
              ["Final assessment", 85],
              ["Discipline", 100],
              ["Location and availability", 85],
            ].map(([label, v]) => (
              <div key={label} className="mt-4">
                <div className="flex justify-between text-[15px]">
                  <span>{label}</span>
                  <span className="text-muted-foreground tabular-nums">{v}%</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-surface-muted">
                  <div className="h-full rounded-full bg-secondary" style={{ width: `${v}%` }} />
                </div>
              </div>
            ))}
            <p className="mt-6 flex items-center gap-2 rounded-md bg-surface-muted px-4 py-3 text-sm text-muted-foreground">
              <Lock className="size-4" /> Phone, email and CV are shared once you accept.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Certificate verification */}
      <section aria-labelledby="cert-title" className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid items-center gap-12 overflow-hidden rounded-[32px] bg-night-2 p-8 text-white sm:p-14 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-orange">For employers</p>
            <h2 id="cert-title" className="mt-3 text-4xl sm:text-5xl">
              Check any certificate in seconds.
            </h2>
            <p className="mt-4 max-w-md text-[var(--grey-200)]">
              Enter the code printed on a SIIP certificate to confirm the name, cohort and company.
            </p>
            <form action="/verify" className="mt-7 flex max-w-md gap-2 rounded-full bg-white/10 p-1.5">
              <label htmlFor="hero-code" className="sr-only">
                Verification code
              </label>
              <input
                id="hero-code"
                name="code"
                placeholder="e.g. K7QX-29MD"
                className="min-w-0 flex-1 bg-transparent px-4 tracking-wider text-white outline-none placeholder:tracking-normal placeholder:text-white/60"
              />
              <Button type="submit">Verify</Button>
            </form>
          </div>
          <Tilt className="rounded-lg">
            <div className="rounded-lg bg-[#FFFDF9] p-8 text-[var(--grey-900)] shadow-lg">
              <div className="rounded-md border border-[#E8DCC8] p-6">
                <p className="text-sm text-[var(--grey-500)]">Certificate of completion</p>
                <p className="mt-3 font-display text-3xl font-semibold">Graduate name</p>
                <p className="mt-2 text-[15px] text-[var(--grey-500)]">
                  Completed the SIIP programme and a three-month internship.
                </p>
                <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-[var(--success)]">
                  <ShieldCheck className="size-4" /> Verified genuine
                </p>
              </div>
            </div>
          </Tilt>
        </div>
      </section>

      {/* Stories (placeholder slots, no invented quotes) */}
      <section aria-labelledby="stories-title" className="mx-auto max-w-6xl px-6 pb-24">
        <Reveal>
          <h2 id="stories-title" className="text-4xl sm:text-5xl">
            Graduate stories
          </h2>
          <p className="mt-3 text-muted-foreground">
            Real stories from SIIP graduates will appear here after the first cohort finishes.
          </p>
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <Reveal
              key={n}
              delay={n * 80}
              className="overflow-hidden rounded-xl border border-dashed border-border-strong bg-surface"
            >
              <PhotoSlot label={`Story ${n}: graduate photo`} className="aspect-[4/3]" />
              <div className="p-5">
                <p className="text-sm font-semibold text-muted-foreground">
                  Placeholder · real story coming soon
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-title" className="mx-auto max-w-3xl px-6 pb-24">
        <h2 id="faq-title" className="text-4xl sm:text-5xl">
          Questions
        </h2>
        <div className="mt-8 divide-y divide-border border-y border-border">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                {q}
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-muted transition-transform duration-200 group-open:rotate-45"
                  aria-hidden
                >
                  +
                </span>
              </summary>
              <p className="pb-5 text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="m-2.5 rounded-[32px] bg-orange px-6 py-24 text-center text-[var(--grey-950)] sm:rounded-[40px] sm:py-32">
        <h2 className="mx-auto max-w-[14ch] text-5xl sm:text-7xl">
          Your career starts with one free application.
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-lg">
          It takes about ten minutes. Have your degree details and a PDF of your CV ready.
        </p>
        <div className="mt-9 flex justify-center">
          <CtaButton href="/sign-up" tone="dark">
            Start your application
          </CtaButton>
        </div>
      </section>
    </>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone: "dark" | "orange" }) {
  return (
    <span
      className={`mx-1 inline-grid h-[0.85em] w-[1.15em] place-items-center rounded-full align-[-0.08em] [&_svg]:size-[0.5em] ${tone === "dark" ? "bg-secondary text-secondary-foreground" : "bg-orange text-[var(--grey-950)]"}`}
      aria-hidden
    >
      {children}
    </span>
  );
}

function BridgeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M2 18 Q12 6 22 18M2 18h20" />
    </svg>
  );
}
