import type { Metadata } from "next";
import { CtaButton } from "@/components/marketing/chrome";
import { PageHero } from "@/components/marketing/page-hero";
import { PhotoSlot } from "@/components/marketing/photo-slot";

export const metadata: Metadata = {
  title: "About SIIP",
  description:
    "SIIP is a free programme by SkillzBridge Trades Africa that turns fresh Nigerian graduates into confident, employable professionals.",
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        kicker="About SIIP"
        title="Bridging the gap between graduation and a first job."
        intro="Every year, thousands of Nigerian graduates finish school with talent but no first job to prove it. SIIP builds that bridge: free training, a fair assessment and a real internship."
      />
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <PhotoSlot label="SIIP cohort at a training session" className="aspect-[16/7] rounded-xl" />
      </section>
      <section className="mx-auto grid max-w-6xl gap-10 px-6 pb-24 md:grid-cols-3">
        {[
          [
            "Free, always",
            "No graduate pays to take part. Not for training, tests, placement or the certificate.",
          ],
          [
            "Fair by design",
            "Assessments are timed and scored on our servers. Matching scores are shown with their reasons.",
          ],
          [
            "Your data, protected",
            "We follow the Nigeria Data Protection Act 2023. You can download or delete your data any time.",
          ],
        ].map(([t, b]) => (
          <div key={t}>
            <h2 className="text-2xl">{t}</h2>
            <p className="mt-3 text-muted-foreground">{b}</p>
          </div>
        ))}
      </section>
      <section className="m-2.5 rounded-[32px] bg-surface-muted px-6 py-20 sm:rounded-[40px]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl">Run by SkillzBridge Trades Africa</h2>
            <p className="mt-3 max-w-xl text-muted-foreground">
              SkillzBridge connects African talent with the skills and workplaces that build careers. SIIP is
              our graduate internship programme.
            </p>
          </div>
          <CtaButton href="/sign-up" tone="dark">
            Apply free
          </CtaButton>
        </div>
      </section>
      <div className="h-20" />
    </>
  );
}
