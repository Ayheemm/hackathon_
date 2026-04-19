import { ExternalLink, FileText } from "lucide-react";

interface SourceCardProps {
  title: string;
  url: string;
  score: number;
  animationDelayMs?: number;
}

function scoreBadge(score: number) {
  if (score >= 0.7) {
    return {
      label: "Fiable / موثوق",
      className: "border border-[rgba(31,107,70,0.26)] bg-[rgba(31,107,70,0.14)] text-[var(--state-success)]",
    };
  }

  return {
    label: "Partiel / جزئي",
    className: "border border-[rgba(166,90,0,0.28)] bg-[rgba(166,90,0,0.12)] text-[var(--state-warning)]",
  };
}

export default function SourceCard({ title, url, score, animationDelayMs = 0 }: SourceCardProps) {
  const badge = scoreBadge(score);

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="source-in flex h-12 w-full items-center gap-2 rounded-[12px] border border-[0.5px] border-[var(--border-gold)] bg-[var(--surface-2)] px-3 shadow-soft transition hover:bg-[var(--surface-0)]"
      style={{ animationDelay: `${animationDelayMs}ms` }}
      aria-label="Ouvrir la source / فتح المصدر"
    >
      <div className="h-full w-[3px] shrink-0 rounded-sm bg-[var(--accent)]" aria-hidden="true" />
      <FileText className="h-4 w-4 shrink-0 text-[var(--bg-mid)]" aria-hidden="true" />
      <p className="flex-1 truncate text-sm text-[var(--text-dark)]">{title}</p>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}>{badge.label}</span>
      <ExternalLink className="h-4 w-4 shrink-0 text-[var(--bg-mid)]" aria-hidden="true" />
    </a>
  );
}
