interface StatusPillProps {
  status: "active" | "warning" | "expired";
}

export default function StatusPill({ status }: StatusPillProps) {
  if (status === "expired") {
    return <span className="rounded-full border border-[0.5px] border-[rgba(143,29,29,0.35)] bg-[rgba(143,29,29,0.13)] px-2 py-0.5 text-xs font-semibold text-[var(--state-danger)]">Expire</span>;
  }

  if (status === "warning") {
    return <span className="rounded-full border border-[0.5px] border-[rgba(166,90,0,0.34)] bg-[rgba(166,90,0,0.13)] px-2 py-0.5 text-xs font-semibold text-[var(--state-warning)]">Alerte</span>;
  }

  return <span className="rounded-full border border-[0.5px] border-[rgba(31,107,70,0.32)] bg-[rgba(31,107,70,0.11)] px-2 py-0.5 text-xs font-semibold text-[var(--state-success)]">Actif</span>;
}
