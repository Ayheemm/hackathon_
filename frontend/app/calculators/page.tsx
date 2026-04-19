import Link from "next/link";
import { ArrowRight, Calculator, Gavel, Scale } from "lucide-react";

const cards = [
  {
    href: "/calculators/inheritance",
    title: "Mirath Calculator",
    subtitle: "Repartition des parts hereditaires avec hajb, awl et radd.",
    icon: Scale,
  },
  {
    href: "/calculators/prescription",
    title: "Prescription",
    subtitle: "Delais civils/penaux avec interruptions et suspensions.",
    icon: Calculator,
  },
  {
    href: "/calculators/appeal-deadlines",
    title: "Delais de recours",
    subtitle: "Appel, opposition et cassation avec calcul jour ouvrable.",
    icon: Gavel,
  },
];

export default function CalculatorsHomePage() {
  return (
    <main className="min-h-screen px-4 py-8 text-[var(--text-dark)] md:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-fr text-2xl font-bold text-[var(--text-dark)] md:text-3xl">Calculatrices Juridiques / الآلات القانونية</h1>
            <p className="mt-1 text-sm text-[var(--bg-dark)]">
              Outils deterministes de pre-calcul. Ils n'ont pas valeur de consultation juridique definitive.
            </p>
          </div>
          <Link
            href="/chat"
            className="inline-flex items-center gap-1 rounded-lg border border-[rgba(212,160,80,0.33)] bg-[var(--surface-2)] px-3 py-2 text-sm font-semibold text-[var(--text-dark)] transition hover:bg-[var(--surface-3)]"
          >
            Retour au chat
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {cards.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-[14px] border border-[0.5px] border-[var(--border-gold)] bg-[var(--surface-2)] p-5 shadow-soft transition hover:-translate-y-0.5 hover:bg-[var(--surface-0)] hover:shadow-lift"
              >
                <div className="mb-3 inline-flex rounded-[10px] border border-[0.5px] border-[var(--border-gold)] bg-[var(--surface-0)] p-2 text-[var(--bg-mid)]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="font-fr text-lg font-semibold text-[var(--text-dark)]">{item.title}</h2>
                <p className="mt-1 text-sm text-[var(--ink-soft)]">{item.subtitle}</p>
                <p className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)]">
                  Ouvrir
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
