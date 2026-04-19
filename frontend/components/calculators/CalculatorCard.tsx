import type { ReactNode } from "react";

interface CalculatorCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function CalculatorCard({ title, subtitle, children }: CalculatorCardProps) {
  return (
    <section className="rounded-[12px] border border-[0.5px] border-[var(--border-gold)] bg-[var(--bg-card)] p-4 shadow-soft md:p-5">
      <div className="mb-4">
        <h2 className="font-fr text-lg font-semibold text-[var(--text-dark)]">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-[var(--bg-dark)]">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
