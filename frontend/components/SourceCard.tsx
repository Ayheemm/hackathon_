import { ExternalLink } from "lucide-react";

interface SourceCardProps {
  title: string;
  sourceName?: string;
  article?: string;
  url?: string;
  score: number;
  excerpt?: string;
  animationDelayMs?: number;
}

function scoreDotClass(score: number): string {
  if (score > 0.8) {
    return "bg-[var(--state-success)]";
  }
  if (score > 0.6) {
    return "bg-[var(--state-warning)]";
  }
  return "bg-[var(--state-danger)]";
}

function scoreBarClass(score: number): string {
  if (score > 0.8) {
    return "bg-[rgba(31,107,70,0.75)]";
  }
  if (score > 0.6) {
    return "bg-[rgba(166,90,0,0.75)]";
  }
  return "bg-[rgba(143,29,29,0.75)]";
}

function resolveSourceIcon(sourceName: string, url: string): string {
  const fingerprint = `${sourceName} ${url}`.toLowerCase();
  if (fingerprint.includes("justice.gov.tn")) {
    return "⚖️";
  }
  if (fingerprint.includes("legislation-securite.tn")) {
    return "📜";
  }
  if (fingerprint.includes("diwan.tn")) {
    return "🏛️";
  }
  return "📄";
}

function scorePercentage(score: number): number {
  return Math.round(Math.min(1, Math.max(0, score)) * 100);
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength).trimEnd()}...`;
}

export default function SourceCard({
  title,
  sourceName = "",
  article = "",
  url = "",
  score,
  excerpt,
  animationDelayMs = 0,
}: SourceCardProps) {
  const safeTitle = title.trim() || "Document sans titre";
  const safeSourceName = sourceName.trim() || "Source";
  const safeArticle = article.trim();
  const icon = resolveSourceIcon(safeSourceName, url);
  const scorePercent = scorePercentage(score);
  const tooltipExcerpt = excerpt?.trim() ? truncate(excerpt.trim(), 180) : "";

  return (
    <article
      className="source-in group relative w-full rounded-[12px] border border-[0.5px] border-[var(--border-gold)] bg-[var(--surface-2)] px-3 py-2 shadow-soft transition hover:bg-[var(--surface-0)]"
      style={{ animationDelay: `${animationDelayMs}ms` }}
      aria-label="Source documentaire / مصدر قانوني"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-[var(--text-muted)]">
            <span aria-hidden="true">{icon}</span> {safeSourceName}
          </p>
          <p className="truncate text-sm font-medium text-[var(--text-dark)]">{safeTitle}</p>
          {safeArticle ? <p className="truncate text-xs text-[var(--ink-soft)]">Art./Réf: {safeArticle}</p> : null}
        </div>

        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${scoreDotClass(score)}`} aria-label={`Score ${scorePercent}%`} />
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[rgba(212,160,80,0.2)]" aria-hidden="true">
        <div className={`h-full ${scoreBarClass(score)}`} style={{ width: `${scorePercent}%` }} />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-[var(--text-muted)]">Pertinence: {scorePercent}%</p>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--bg-mid)] hover:text-[var(--text-dark)]"
            aria-label="Ouvrir la source / فتح المصدر"
          >
            Lien
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        ) : null}
      </div>

      {tooltipExcerpt ? (
        <div className="pointer-events-none absolute left-2 right-2 top-full z-20 mt-2 rounded-[10px] border border-[0.5px] border-[var(--border-gold)] bg-[var(--surface-0)] p-2 text-xs text-[var(--text-dark)] opacity-0 shadow-lift transition group-hover:opacity-100">
          {tooltipExcerpt}
        </div>
      ) : null}
    </article>
  );
}
