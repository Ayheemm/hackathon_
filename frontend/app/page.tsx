import Link from "next/link";
import { ArrowRight, BookText, Calculator, Globe2, Scale } from "lucide-react";

const quickPillars = [
  {
    title: "Bilingue Ar/Fr",
    subtitle: "Questions et reponses fluides en arabe et en francais.",
    icon: Globe2,
  },
  {
    title: "Reponses justifiees",
    subtitle: "Avec sources et references juridiques tunisiennes.",
    icon: BookText,
  },
  {
    title: "Calculs juridiques",
    subtitle: "Succession, prescription et delais de recours.",
    icon: Calculator,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-[22px] border border-[0.5px] border-[var(--border-gold)] bg-[var(--surface-1)] p-6 shadow-lift md:p-10">
          <div className="pointer-events-none absolute -right-16 -top-24 h-60 w-60 rounded-full bg-[rgba(212,160,80,0.2)] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-8 h-56 w-56 rounded-full bg-[rgba(61,30,8,0.1)] blur-3xl" />

          <div className="relative z-10 grid gap-8 md:grid-cols-[1.2fr_0.8fr] md:items-center">
            <div>
              <p className="inline-flex items-center rounded-full border border-[rgba(212,160,80,0.33)] bg-[rgba(212,160,80,0.13)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Legal AI for Tunisia
              </p>

              <h1 className="mt-4 text-3xl font-semibold leading-tight text-[var(--text-dark)] md:text-5xl">
                9anouni / قانوني
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--ink-soft)] md:text-lg">
                Assistant juridique intelligent pour les professionnels du droit en Tunisie. Posez une question, recevez une
                reponse structuree, et naviguez rapidement vers les textes et references utiles.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/chat"
                  className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-[var(--bg-deep)] px-4 py-2.5 text-sm font-semibold text-[var(--text-light)] transition hover:bg-[var(--bg-dark)]"
                >
                  Ouvrir le chat
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/calculators"
                  className="inline-flex items-center gap-2 rounded-xl border border-[rgba(212,160,80,0.33)] bg-[var(--surface-2)] px-4 py-2.5 text-sm font-semibold text-[var(--text-dark)] transition hover:bg-[var(--surface-3)]"
                >
                  Ouvrir les calculatrices
                  <Scale className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="rounded-[18px] border border-[0.5px] border-[var(--border-gold)] bg-[var(--surface-2)] p-4 shadow-soft md:p-5">
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">Exemples rapides</p>
              <div className="mt-3 space-y-2 text-sm text-[var(--text-dark)]">
                <p className="rounded-lg border border-[rgba(212,160,80,0.24)] bg-[var(--surface-0)] px-3 py-2">
                  ما هي شروط عقد الشغل في تونس؟
                </p>
                <p className="rounded-lg border border-[rgba(212,160,80,0.24)] bg-[var(--surface-0)] px-3 py-2">
                  Quels sont les delais de recours apres un jugement ?
                </p>
                <p className="rounded-lg border border-[rgba(212,160,80,0.24)] bg-[var(--surface-0)] px-3 py-2">
                  Comment calculer les parts hereditaires selon la situation familiale ?
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-7 grid gap-4 md:grid-cols-3">
          {quickPillars.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="rounded-[16px] border border-[0.5px] border-[var(--border-gold)] bg-[var(--surface-2)] p-4 shadow-soft"
              >
                <div className="inline-flex rounded-xl border border-[rgba(212,160,80,0.27)] bg-[rgba(212,160,80,0.13)] p-2 text-[var(--bg-mid)]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="mt-3 text-base font-semibold text-[var(--text-dark)]">{item.title}</h2>
                <p className="mt-1 text-sm leading-6 text-[var(--ink-soft)]">{item.subtitle}</p>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
