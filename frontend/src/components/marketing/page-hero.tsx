import type { ReactNode } from "react";

/** Light hero for secondary public pages (about, contact, legal, verify). */
export function PageHero({
  kicker,
  title,
  intro,
  children,
}: {
  kicker?: string;
  title: string;
  intro?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="mx-auto max-w-4xl px-6 pt-36 pb-12 sm:pt-44">
      {kicker ? <p className="text-sm font-semibold text-brand-text">{kicker}</p> : null}
      <h1 className="mt-3 text-[40px] leading-[1.05] break-words sm:text-6xl">{title}</h1>
      {intro ? <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{intro}</p> : null}
      {children}
    </section>
  );
}

/** Long-form legal text with a sticky table of contents on desktop. */
export function LegalPage({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: Array<{ id: string; heading: string; body: ReactNode }>;
}) {
  return (
    <>
      <PageHero
        kicker="Legal"
        title={title}
        intro={
          <>
            Last updated {updated}. This is placeholder text for review by SIIP&apos;s legal advisers before
            launch.
          </>
        }
      />
      <div className="mx-auto grid max-w-5xl gap-12 px-6 pb-24 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="On this page" className="hidden lg:block">
          <ol className="sticky top-28 grid gap-2 text-[15px]">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-muted-foreground hover:text-foreground">
                  {i + 1}. {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="grid max-w-[68ch] gap-10">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-28">
              <h2 className="text-2xl">
                {i + 1}. {s.heading}
              </h2>
              <div className="mt-3 grid gap-3 text-[17px] leading-relaxed text-muted-foreground">
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
