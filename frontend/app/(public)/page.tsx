import { Lock } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CtaButton } from "@/components/marketing/chrome";
import { ScreenSteps, type ScreenStep } from "@/components/marketing/motion";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Proven skills, put to work",
  description:
    "Prove your skills with certificates, get them verified by SIIP, and intern with companies that need exactly what you can do. Free.",
};

const STEPS: ScreenStep[] = [
  {
    title: "Show what you can do",
    body: "List your skills and the level you work at, with a certificate or link for each.",
    src: "/screens/skills-home-desktop.png",
    alt: "An intern's skills page: each skill with its level, its proof and SIIP's check",
  },
  {
    title: "SIIP checks every skill",
    body: "We check each skill against your proof, and confirm the level it supports.",
    src: "/screens/reviews-home-desktop.png",
    alt: "SIIP's review queue of interns waiting for their skills to be checked",
  },
  {
    title: "Get matched at your level",
    body: "Companies ask for a skill and a level. Only verified interns at that level are put forward.",
    src: "/screens/matching-home-desktop.png",
    alt: "The matching screen: a role's skills and levels, and verified interns ranked by fit",
  },
  {
    title: "Intern on real work",
    body: "Work with a supervisor, remote, on-site or hybrid, and share a short check-in every month.",
    src: "/screens/placement-home-desktop.png",
    alt: "The internship page with the placement and monthly check-ins",
  },
  {
    title: "Pass the SIIP test",
    body: "Short videos on working well with others, then a quiz, a couple of months in.",
    src: "/screens/tests-home-desktop.png",
    alt: "The SIIP test page: the videos to watch, then the quiz",
  },
  {
    title: "Earn a verified certificate",
    body: "Employers can confirm it is genuine in seconds.",
    src: "/screens/certificate-home-desktop.png",
    alt: "A SIIP certificate of completion with its verification code",
  },
];

const FIGURES = [
  ["Free", "What interns pay, from sign-up to certificate."],
  ["4 levels", "Beginner to Expert. Companies see the level SIIP verified."],
  ["6 steps", "From proof of your skills to a verified certificate."],
  ["1 test", "On workplace conduct, taken during your internship."],
] as const;

// Mirrors MATCH_WEIGHTS in shared/src/matching.ts (NYSC timing shown as "Other").
const FACTORS = [
  ["Verified skills", 50],
  ["Discipline", 15],
  ["Location", 15],
  ["Availability", 15],
  ["Other", 5],
] as const;

const FAQ = [
  [
    "Does SIIP cost anything?",
    "No. Verification, matching, the internship placement, the SIIP test and the certificate are free.",
  ],
  [
    "Who can join?",
    "Students, graduates and corps members with skills they can prove.",
  ],
  [
    "What counts as proof?",
    "A certificate file or a link, such as a Coursera or Udemy certificate or your portfolio.",
  ],
  ["Is the internship paid?", "Each company sets its own terms. You see them before you start."],
] as const;

export default function LandingPage() {
  return (
    <>
      {/* Hero: the intern's real home screen */}
      <section
        aria-labelledby="hero-title"
        className="relative isolate m-2.5 overflow-hidden rounded-[32px] bg-night text-white [--ring:var(--orange-500)] sm:rounded-[40px]"
      >
        <div className="absolute inset-0 -z-10 bg-[image:var(--night-texture),var(--night-fill)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 pt-32 pb-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10 lg:pt-36 lg:pb-24">
          <div className="min-w-0">
            <h1
              id="hero-title"
              className="max-w-[11ch] font-display text-[48px] leading-[1.02] font-semibold tracking-[-0.035em] break-words sm:text-[68px] xl:text-[80px]"
            >
              Proven skills, put to work.
            </h1>
            <p className="mt-6 max-w-[38ch] text-lg text-[var(--grey-200)] sm:text-xl">
              Prove your skills, get verified, and intern where they count.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <CtaButton href="/sign-up">Create your profile</CtaButton>
              <Button asChild size="lg" variant="ghost" className="text-white ring-1 ring-white/40 hover:bg-white/10">
                <Link href="/companies">I&apos;m hiring interns</Link>
              </Button>
            </div>
          </div>
          <div className="relative min-w-0 lg:-mr-24 xl:-mr-40">
            <Image
              src="/screens/dashboard-home-desktop.png"
              alt="An intern's SIIP home screen: the journey tracker, the next step and their verified skills"
              width={2880}
              height={1800}
              priority
              sizes="(min-width: 1024px) 66vw, 100vw"
              className="rounded-xl shadow-lg ring-1 ring-white/15"
            />
            <Image
              src="/screens/dashboard-home-phone.png"
              alt=""
              width={780}
              height={1688}
              sizes="180px"
              className="absolute -bottom-10 -left-6 hidden w-[180px] rounded-[28px] shadow-lg ring-4 ring-[var(--grey-950)] sm:block"
            />
          </div>
        </div>
      </section>

      {/* Journey: seven steps, real screens */}
      <section id="journey" aria-labelledby="journey-title" className="mx-auto max-w-7xl scroll-mt-24 px-6 pt-32">
        <h2 id="journey-title" className="max-w-[16ch] text-4xl sm:text-6xl">
          Six steps. One clear path.
        </h2>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          You always know where you are and what to do next.
        </p>
        <div className="mt-14">
          <ScreenSteps steps={STEPS} />
        </div>
      </section>

      {/* Figures */}
      <section aria-labelledby="facts-title" className="mx-auto max-w-7xl px-6 pt-32">
        <h2 id="facts-title" className="sr-only">
          The programme at a glance
        </h2>
        <dl className="grid border-t border-border sm:grid-cols-2 lg:grid-cols-4">
          {FIGURES.map(([figure, label]) => (
            <div key={figure} className="border-b border-border py-8 pr-8 lg:border-b-0">
              <dt className="sr-only">{label}</dt>
              <dd className="font-display text-6xl font-semibold tracking-tight tabular-nums">{figure}</dd>
              <dd className="mt-3 max-w-[30ch] text-muted-foreground">{label}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* For companies: the real matching screen and the real weights */}
      <section aria-labelledby="co-title" className="m-2.5 mt-32 rounded-[32px] bg-surface-muted py-28 sm:rounded-[40px]">
        <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="min-w-0">
            <h2 id="co-title" className="max-w-[16ch] text-4xl sm:text-5xl">
              Interns verified at the level you need.
            </h2>
            <p className="mt-5 max-w-md text-lg text-muted-foreground">
              Every skill is checked against real proof. Ask for Expert and you only get Experts. The score shows
              why each intern fits.
            </p>
            <dl className="mt-8 grid max-w-md gap-3">
              {FACTORS.map(([label, weight]) => (
                <div key={label} className="grid grid-cols-[9rem_minmax(0,1fr)_2.5rem] items-center gap-3">
                  <dt className="text-[15px]">{label}</dt>
                  <dd className="h-2 overflow-hidden rounded-full bg-surface" aria-hidden>
                    <span
                      className="block h-full origin-left rounded-full bg-secondary"
                      style={{ transform: `scaleX(${weight / 50})` }}
                    />
                  </dd>
                  <dd className="text-right text-[15px] text-muted-foreground tabular-nums">{weight}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm text-muted-foreground">Points out of 100 for each factor.</p>
            <div className="mt-9">
              <CtaButton href="/companies" tone="dark">
                Become a partner
              </CtaButton>
            </div>
          </div>
          <figure className="min-w-0">
            <Image
              src="/screens/matching-home-desktop.png"
              alt="SIIP's matching screen: a role's skills and levels, and verified interns ranked by score"
              width={2880}
              height={1800}
              sizes="(min-width: 1024px) 58vw, 100vw"
              className="rounded-xl border border-border shadow-lg"
            />
            <figcaption className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="size-4 shrink-0" aria-hidden /> Phone, email and CV are shared once you accept a
              match.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Certificate verification */}
      <section aria-labelledby="cert-title" className="mx-auto max-w-7xl px-6 pt-32">
        <div className="grid items-center gap-12 overflow-hidden rounded-[32px] bg-night-2 p-8 text-white [--ring:var(--orange-500)] sm:p-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="min-w-0">
            <h2 id="cert-title" className="max-w-[14ch] text-4xl sm:text-5xl">
              Check any certificate in seconds.
            </h2>
            <p className="mt-4 max-w-md text-[var(--grey-200)]">
              Enter the code printed on a SIIP certificate to confirm the name, internship and company.
            </p>
            <form action="/verify" className="mt-7 flex max-w-md gap-2">
              <label htmlFor="hero-code" className="sr-only">
                Verification code
              </label>
              <input
                id="hero-code"
                name="code"
                placeholder="e.g. K7QX-29MD"
                autoComplete="off"
                className="h-12 min-w-0 flex-1 rounded-full border border-white/45 bg-white/5 px-5 text-white placeholder:text-white/60 focus-visible:border-orange focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-orange"
              />
              <Button type="submit" size="lg">Verify</Button>
            </form>
          </div>
          <div className="relative aspect-[16/10] min-w-0 overflow-hidden rounded-xl">
            <Image
              src="/screens/certificate-home-desktop.png"
              alt="A SIIP certificate of completion, with its issue number and verification code"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="scale-[1.25] object-cover object-[50%_75%]"
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-title" className="mx-auto grid max-w-7xl gap-10 px-6 py-32 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <h2 id="faq-title" className="text-4xl sm:text-5xl">
          Questions
        </h2>
        <div className="divide-y divide-border border-y border-border">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 rounded-md py-4 text-lg font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                {q}
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-muted text-xl leading-none transition-transform duration-200 ease-out group-open:rotate-45 motion-reduce:transition-none"
                  aria-hidden
                >
                  +
                </span>
              </summary>
              <p className="max-w-prose pb-5 text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Close */}
      <section aria-labelledby="close-title" className="m-2.5 rounded-[32px] bg-orange text-[var(--grey-950)] sm:rounded-[40px]">
        <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-24 lg:flex-row lg:items-end lg:justify-between lg:py-28">
          <div>
            <h2 id="close-title" className="max-w-[14ch] text-5xl sm:text-7xl">
              Show us what you can do.
            </h2>
            <p className="mt-5 max-w-lg text-lg">
              About ten minutes. Have your CV and certificates ready.
            </p>
          </div>
          <div className="shrink-0">
            <CtaButton href="/sign-up" tone="dark">
              Create your profile
            </CtaButton>
          </div>
        </div>
      </section>
    </>
  );
}
