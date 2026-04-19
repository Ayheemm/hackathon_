interface StatusPillProps {
  status: "active" | "warning" | "expired";
}

export default function StatusPill({ status }: StatusPillProps) {
  if (status === "expired") {
    return <span className="rounded-full border border-[0.5px] border-[rgba(212,160,80,0.27)] bg-[rgba(212,160,80,0.13)] px-2 py-0.5 text-xs font-semibold text-[var(--bg-dark)]">Expire</span>;
  }

  if (status === "warning") {
    return <span className="rounded-full border border-[0.5px] border-[rgba(212,160,80,0.27)] bg-[rgba(212,160,80,0.13)] px-2 py-0.5 text-xs font-semibold text-[var(--bg-mid)]">Alerte</span>;
  }

  return <span className="rounded-full border border-[0.5px] border-[rgba(212,160,80,0.27)] bg-[rgba(212,160,80,0.07)] px-2 py-0.5 text-xs font-semibold text-[var(--bg-deep)]">Actif</span>;
}
