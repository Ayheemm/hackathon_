import Link from "next/link";

import InheritanceCalculator from "../../../components/calculators/InheritanceCalculator";

export default function InheritancePage() {
  return (
    <main className="min-h-screen bg-[var(--bg-main)] px-4 py-6 text-[var(--text-dark)] md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-fr text-2xl font-bold text-[var(--text-dark)]">Mirath Calculator</h1>
          <Link
            href="/calculators"
            className="rounded-lg border border-[rgba(212,160,80,0.33)] bg-[var(--bg-card)] px-3 py-2 text-sm font-semibold text-[var(--bg-dark)]"
          >
            Tous les calculateurs
          </Link>
        </div>
        <InheritanceCalculator />
      </div>
    </main>
  );
}
