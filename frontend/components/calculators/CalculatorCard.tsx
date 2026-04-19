import type { ReactNode } from "react";

interface CalculatorCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function CalculatorCard({ title, subtitle, children }: CalculatorCardProps) {
  return (
    <section className="rounded-[14px] border border-[0.5px] border-[var(--border-gold)] bg-[var(--surface-2)] p-4 shadow-soft md:p-5">
      <div className="mb-4">
        <h2 className="font-fr text-lg font-semibold text-[var(--text-dark)]">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-[var(--ink-soft)]">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
